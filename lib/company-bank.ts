/**
 * RGS / company recipient bank for commercial invoices and payment-proof checks.
 *
 * Source priority:
 * 1. Company row (`bankAccountNumber`, `bankName`, `bankAccountName`)
 * 2. Env fallbacks: COMPANY_BANK_ACCOUNT_NUMBER, COMPANY_BANK_NAME,
 *    COMPANY_BANK_ACCOUNT_NAME
 */

export type CompanyBankSource = {
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
};

export type CompanyBankDetails = {
  /** Digits-only account number used for matching. */
  accountNumber: string;
  /** Display / original account string when available. */
  accountNumberDisplay: string;
  bankName: string | null;
  accountName: string | null;
};

/** Digits-only bank account; require a plausible length. */
export function normalizeBankAccountNumber(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 30) return null;
  return digits;
}

export function resolveCompanyBankDetails(
  company?: CompanyBankSource | null
): CompanyBankDetails | null {
  const rawAccount =
    company?.bankAccountNumber?.trim() ||
    process.env.COMPANY_BANK_ACCOUNT_NUMBER?.trim() ||
    "";
  const accountNumber = normalizeBankAccountNumber(rawAccount);
  if (!accountNumber) return null;

  const bankName =
    company?.bankName?.trim() ||
    process.env.COMPANY_BANK_NAME?.trim() ||
    null;
  const accountName =
    company?.bankAccountName?.trim() ||
    process.env.COMPANY_BANK_ACCOUNT_NAME?.trim() ||
    null;

  return {
    accountNumber,
    accountNumberDisplay: rawAccount.replace(/\s+/g, " ").trim() || accountNumber,
    bankName: bankName || null,
    accountName: accountName || null,
  };
}

export function bankAccountNumbersMatch(
  expected: string | null | undefined,
  extracted: string | null | undefined
): boolean {
  const a = normalizeBankAccountNumber(expected);
  const b = normalizeBankAccountNumber(extracted);
  if (!a || !b) return false;
  return a === b;
}

/**
 * Conservative minimum for any prefix/suffix credit.
 * Overlaps shorter than this stay on raw Levenshtein only (usually reject).
 */
const ACCOUNT_MIN_OVERLAP_DIGITS = 8;
/** Very strong unmasked tail/head (typical full visible account fragment). */
const ACCOUNT_STRONG_OVERLAP_DIGITS = 10;

/**
 * Digit-string similarity for truncated / partially masked account numbers.
 * Returns 0–1. Exact match → 1. Only ≥8 overlapping prefix/suffix digits
 * get a high affix score; shorter fragments fail closed via Levenshtein alone.
 */
export function bankAccountNumberSimilarity(
  expected: string | null | undefined,
  extracted: string | null | undefined
): number {
  const a = normalizeBankAccountNumber(expected);
  const b = normalizeBankAccountNumber(extracted);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  const isPrefixOrSuffix =
    longer.startsWith(shorter) || longer.endsWith(shorter);

  let overlap = 0;
  if (isPrefixOrSuffix) {
    overlap = shorter.length;
  } else {
    const maxN = Math.min(a.length, b.length);
    for (let n = maxN; n >= ACCOUNT_MIN_OVERLAP_DIGITS; n--) {
      if (
        a.slice(0, n) === b.slice(0, n) ||
        a.slice(-n) === b.slice(-n)
      ) {
        overlap = n;
        break;
      }
    }
  }

  let affixScore = 0;
  if (overlap >= ACCOUNT_STRONG_OVERLAP_DIGITS) {
    affixScore = Math.max(0.94, overlap / Math.max(a.length, b.length));
  } else if (overlap >= ACCOUNT_MIN_OVERLAP_DIGITS) {
    // 8–9 digit prefix/suffix — high but not automatic accept without length ratio.
    affixScore = Math.max(0.88, overlap / Math.max(a.length, b.length));
  }

  const editScore = digitLevenshteinSimilarity(a, b);
  return Math.max(affixScore, editScore);
}

function digitLevenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}
