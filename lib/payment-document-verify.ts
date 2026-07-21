import { createHash } from "crypto";

import {
  bankAccountNumberSimilarity,
  type CompanyBankDetails,
} from "@/lib/company-bank";
import { stripNpwpDigits } from "@/lib/npwp";
import {
  DISPLAY_COMPANY_NAME,
  LEGAL_COMPANY_NAME,
} from "@/lib/company-identity";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Proof of payment: exact IDR match (±1 for float/OCR noise only).
 * Tax invoice: strict yes/no — only ±1–2 whole-rupiah rounding, never % fuzzy.
 */
const PROOF_AMOUNT_ABS_TOLERANCE = 1;
/** Tax invoice DPP+PPN / grand total vs commercial invoice (±2 IDR rounding only). */
const TAX_AMOUNT_ABS_TOLERANCE = 2;
/**
 * Dedup window for listing candidate amounts in failure details only
 * (not used to accept/reject tax invoices).
 */
const AMOUNT_LIST_ABS_TOLERANCE = 1;
const AMOUNT_LIST_REL_TOLERANCE = 0.01;

/**
 * Recipient accept threshold (account + name) — fail closed.
 * Combined = 0.75 × string similarity + 0.25 × AI confidence
 * (AI defaults to string similarity when missing).
 *
 * Accept only when clearly high (~88%). Borderline / unsure → reject
 * (`proof_recipient_unclear`). Truncation allows a small relief to 0.85,
 * still never below ~85%.
 */
export const PROOF_RECIPIENT_CONFIDENCE_THRESHOLD = 0.88;
/** Floor when AI marks truncation — still ≥85%; no deep discount. */
export const PROOF_RECIPIENT_TRUNCATED_THRESHOLD = 0.85;
/** Strong string evidence required; AI alone cannot force accept. */
const PROOF_RECIPIENT_STRING_FLOOR = 0.85;
const PROOF_RECIPIENT_TRUNCATED_STRING_FLOOR = 0.82;
/** Below this string similarity → clearly wrong (mismatch, not unclear). */
const PROOF_RECIPIENT_CLEAR_MISMATCH_BELOW = 0.5;

export type PaymentVerifyFailureCode =
  | "not_configured"
  | "invoice_amount_missing"
  | "invoice_date_missing"
  | "company_bank_missing"
  | "client_npwp_missing"
  | "client_name_missing"
  | "supplier_name_missing"
  | "proof_amount_mismatch"
  | "proof_recipient_mismatch"
  | "proof_recipient_unclear"
  | "proof_date_before_invoice"
  | "proof_status_not_success"
  | "proof_payer_name_mismatch"
  | "proof_reference_mismatch"
  | "tax_amount_mismatch"
  | "tax_npwp_mismatch"
  | "tax_buyer_name_mismatch"
  /** Keluaran: extracted pembeli looks like RGS / company — wrong side. */
  | "tax_buyer_is_company"
  /** Keluaran: extracted penjual looks like the ERP client — sides swapped. */
  | "tax_seller_is_client"
  /** Masukan: extracted pembeli looks like the supplier — sides swapped. */
  | "tax_buyer_is_supplier"
  /** Masukan: extracted penjual looks like RGS / company — sides swapped. */
  | "tax_seller_is_company"
  /** Penjual missing or does not match expected seller for this direction. */
  | "tax_seller_name_mismatch"
  | "tax_serial_missing"
  | "tax_serial_duplicate"
  | "tax_document_duplicate"
  | "tax_date_reuse"
  | "extract_failed"
  | "api_error";

/** Output VAT (RGS seller) vs input VAT (RGS buyer). */
export type TaxInvoiceDirection = "keluaran" | "masukan";

export type TaxInvoiceExtractStored = {
  serial: string;
  issuedDate: string | null;
  documentHash: string;
  buyerName: string | null;
  dpp: number | null;
  ppn: number | null;
  total: number | null;
};

export type PaymentDocumentVerifyResult =
  | { ok: true; tax?: TaxInvoiceExtractStored }
  | {
      ok: false;
      failures: PaymentVerifyFailureCode[];
      details?: {
        expectedAmount?: number;
        proofAmount?: number | null;
        taxAmountCandidates?: number[];
        expectedNpwp?: string;
        extractedNpwp?: string | null;
        expectedBuyerName?: string;
        extractedBuyerName?: string | null;
        expectedSellerName?: string;
        extractedSellerName?: string | null;
        taxSerial?: string | null;
        taxIssuedDate?: string | null;
        expectedRecipientAccount?: string;
        extractedRecipientAccount?: string | null;
        expectedBankName?: string | null;
        extractedBankName?: string | null;
        invoiceIssuedDate?: string;
        proofTransferDate?: string | null;
        proofStatus?: string | null;
        expectedPayerName?: string;
        extractedPayerName?: string | null;
        expectedReference?: string;
        extractedReference?: string | null;
      };
      tax?: TaxInvoiceExtractStored;
    };

type ExtractedPaymentProof = {
  amount: number | null;
  transferDate: string | null;
  recipientAccountNumber: string | null;
  /** AI self-reported confidence for recipient account (0–1), if provided. */
  recipientAccountConfidence: number | null;
  /** True when the slip visibly truncates/masks the account number. */
  recipientAccountTruncated: boolean;
  recipientBankName: string | null;
  recipientName: string | null;
  /** AI self-reported confidence for recipient name (0–1), if provided. */
  recipientNameConfidence: number | null;
  /** True when the slip visibly truncates the recipient name. */
  recipientNameTruncated: boolean;
  payerName: string | null;
  status: string | null;
  reference: string | null;
};

type ExtractedTaxInvoice = {
  buyerName: string | null;
  sellerName: string | null;
  npwp: string | null;
  dpp: number | null;
  ppn: number | null;
  total: number | null;
  invoiceDate: string | null;
  serial: string | null;
  amounts: number[];
};

/** Prior period/purchase that already used this tax invoice identity. */
export type TaxInvoiceConflictKind =
  | "serial"
  | "document_hash"
  | "date_amount";

export type TaxInvoiceDuplicateLookup = (query: {
  serial: string | null;
  documentHash: string;
  issuedDate: string | null;
  invoiceAmount: number;
  /** Exclude current period or purchase invoice row when re-checking. */
  excludeId: string;
}) => Promise<TaxInvoiceConflictKind | null>;

function openaiApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key || null;
}

let warnedMissingOpenAiInProduction = false;

function warnIfOpenAiMissingInProduction(): void {
  if (warnedMissingOpenAiInProduction) return;
  if (process.env.NODE_ENV !== "production") return;
  if (openaiApiKey()) return;
  warnedMissingOpenAiInProduction = true;
  console.warn(
    "[payment-verify] OPENAI_API_KEY is not set. Payment proof and tax invoice " +
      "AI verification will fail closed until the key is configured on the host."
  );
}

export function isPaymentDocumentVerifyConfigured(): boolean {
  warnIfOpenAiMissingInProduction();
  return Boolean(openaiApiKey());
}

/** Exact IDR for proof of payment (±1 rupiah only). */
export function proofAmountsMatch(expected: number, actual: number): boolean {
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) return false;
  return Math.abs(expected - actual) <= PROOF_AMOUNT_ABS_TOLERANCE;
}

/**
 * Relative tolerance helper for listing tax-invoice amount candidates in
 * failure details only — never used as a tax-invoice pass criterion.
 */
export function amountsCloseEnough(expected: number, actual: number): boolean {
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) return false;
  const tol = Math.max(
    AMOUNT_LIST_ABS_TOLERANCE,
    Math.abs(expected) * AMOUNT_LIST_REL_TOLERANCE
  );
  return Math.abs(expected - actual) <= tol;
}

/** Strict tax-invoice amount equality (±TAX_AMOUNT_ABS_TOLERANCE rupiah only). */
function taxAmountsMatchExact(expected: number, actual: number): boolean {
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) return false;
  return Math.abs(expected - actual) <= TAX_AMOUNT_ABS_TOLERANCE;
}

export function normalizeExtractedAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(/\.(?=.*\.)/g, "");
    const normalized = cleaned.includes(",")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function uniqueFiniteAmounts(values: Array<number | null | undefined>): number[] {
  const out: number[] = [];
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue;
    if (!out.some((existing) => amountsCloseEnough(existing, value))) {
      out.push(value);
    }
  }
  return out;
}

/**
 * Commercial invoices include tax. Tax invoice must match via DPP+PPN
 * (and/or printed grand total), not DPP alone.
 * Strict: ±2 IDR rounding only — no relative/% fuzzy pass.
 * Missing/unreadable DPP+PPN and total → reject (fail closed).
 */
export function taxInvoiceAmountMatches(
  invoiceAmount: number,
  extracted: Pick<ExtractedTaxInvoice, "dpp" | "ppn" | "total">
): boolean {
  const dppPlusPpn =
    extracted.dpp != null && extracted.ppn != null
      ? extracted.dpp + extracted.ppn
      : null;
  if (dppPlusPpn != null && taxAmountsMatchExact(invoiceAmount, dppPlusPpn)) {
    return true;
  }
  if (
    extracted.total != null &&
    taxAmountsMatchExact(invoiceAmount, extracted.total)
  ) {
    return true;
  }
  return false;
}

/**
 * Strict NPWP digit match after normalize (strip punctuation).
 * Exact digits only; 15↔16 digit NIK-based format overlap is allowed as
 * structural equivalence, not fuzzy similarity.
 * Missing/unreadable extracted NPWP → false (fail closed).
 */
export function npwpDigitsMatch(
  expected: string | null | undefined,
  extracted: string | null | undefined
): boolean {
  const a = stripNpwpDigits(expected ?? "");
  const b = stripNpwpDigits(extracted ?? "");
  if (!a || !b) return false;
  if (a === b) return true;
  // 16-digit NIK-based vs classic 15-digit: compare overlapping suffix/prefix
  if (a.length === 16 && b.length === 15) return a.endsWith(b) || a.startsWith(b);
  if (a.length === 15 && b.length === 16) return b.endsWith(a) || b.startsWith(a);
  return false;
}

/**
 * Normalize Indonesian company names: case, punctuation, legal suffixes
 * (PT/CV/Tbk/etc.). Used by both strict tax buyer match and proof fuzzy match.
 */
export function normalizePartyName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(
      /\b(pt|p\.?\s*t\.?|cv|c\.?\s*v\.?|tbk|ud|pd|firma|perseroan|terbatas|ltd|llc|inc)\b/g,
      " "
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strict tax-invoice buyer (pembeli) vs ERP client name.
 * Exact match after normalize only — no substring, token subset, or
 * similarity/confidence thresholds (unlike proof-of-payment recipient).
 * Missing/unreadable extracted name → false (fail closed).
 */
export function taxBuyerNamesMatch(
  expected: string | null | undefined,
  extracted: string | null | undefined
): boolean {
  const a = normalizePartyName(expected);
  const b = normalizePartyName(extracted);
  if (!a || !b) return false;
  return a === b;
}

/**
 * Proof-of-payment payer name check — token/substring match allowed.
 * Do not use for tax invoices (use taxBuyerNamesMatch instead).
 */
export function partyNamesMatch(
  expected: string | null | undefined,
  extracted: string | null | undefined
): boolean {
  const a = normalizePartyName(expected);
  const b = normalizePartyName(extracted);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const tokensA = a.split(" ").filter((t) => t.length > 1);
  const tokensB = b.split(" ").filter((t) => t.length > 1);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const longer = tokensA.length <= tokensB.length ? tokensB : tokensA;
  return shorter.every((token) => longer.includes(token));
}

/** Known RGS / Relasi Global Solusi legal & display names (letterhead + aliases). */
const RGS_COMPANY_NAME_ALIASES = [
  LEGAL_COMPANY_NAME,
  DISPLAY_COMPANY_NAME,
  "PT Relasi Global Solusi",
  "PT. Relasi Global Solusi",
  "Relasi Global Solusi",
  "RGS",
] as const;

/**
 * Whether an extracted party name looks like RGS / the ERP Company record.
 * Uses token/substring match (not strict buyer equality) so OCR variants of
 * the seller (penjual) still resolve, and so RGS-as-buyer is caught early.
 */
export function looksLikeCompanyOrRgs(
  extracted: string | null | undefined,
  companyName?: string | null
): boolean {
  const normalized = normalizePartyName(extracted);
  if (!normalized) return false;

  if (normalized === "rgs" || normalized.includes("relasi global solusi")) {
    return true;
  }
  if (normalized.split(" ").includes("rgs")) {
    return true;
  }

  const candidates = [
    companyName,
    ...RGS_COMPANY_NAME_ALIASES,
  ].filter((value): value is string => Boolean(normalizePartyName(value)));

  for (const candidate of candidates) {
    if (taxBuyerNamesMatch(candidate, extracted)) return true;
    if (partyNamesMatch(candidate, extracted)) return true;
  }
  return false;
}

/**
 * Resolve the canonical RGS / Company party name for messages / compare:
 * Company.name from DB when present, else letterhead legal name.
 */
export function resolveTaxInvoiceCompanyName(
  companyName?: string | null
): string {
  const fromDb = (companyName ?? "").trim();
  return fromDb || LEGAL_COMPANY_NAME;
}

/** @deprecated Prefer resolveTaxInvoiceCompanyName (same value; keluaran seller). */
export function resolveTaxInvoiceSellerName(
  companyName?: string | null
): string {
  return resolveTaxInvoiceCompanyName(companyName);
}

/** Optional company Tax ID for PPN masukan buyer checks (env). */
export function resolveCompanyNpwpFromEnv(): string | null {
  const raw = process.env.COMPANY_NPWP?.trim() ?? "";
  const digits = stripNpwpDigits(raw);
  return digits || null;
}

/**
 * Conservative fuzzy name similarity (0–1) for proof-of-payment recipient.
 * Truncation only scores high when the visible fragment is substantial.
 */
export function partyNameSimilarity(
  expected: string | null | undefined,
  extracted: string | null | undefined
): number {
  const a = normalizePartyName(expected);
  const b = normalizePartyName(extracted);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  const ratio = shorter.length / longer.length;

  if (longer.includes(shorter)) {
    // Require a substantial fragment — short substrings stay low (fail closed).
    if (shorter.length >= 12 || ratio >= 0.7) {
      return Math.max(0.9, ratio);
    }
    if (shorter.length >= 10 || ratio >= 0.65) {
      return Math.max(0.85, ratio);
    }
    return ratio;
  }

  if (longer.startsWith(shorter) && shorter.length >= 10) {
    return Math.max(ratio, shorter.length >= 12 ? 0.9 : 0.85);
  }

  const tokensA = a.split(" ").filter((t) => t.length > 1);
  const tokensB = b.split(" ").filter((t) => t.length > 1);
  let tokenScore = 0;
  if (tokensA.length > 0 && tokensB.length > 0) {
    const setB = new Set(tokensB);
    const setA = new Set(tokensA);
    const overlap = tokensA.filter((t) => setB.has(t)).length;
    const overlapRev = tokensB.filter((t) => setA.has(t)).length;
    const denom = Math.max(tokensA.length, tokensB.length);
    tokenScore = Math.max(overlap, overlapRev) / denom;
    const shorterTokens =
      tokensA.length <= tokensB.length ? tokensA : tokensB;
    const longerSet =
      tokensA.length <= tokensB.length ? setB : setA;
    // All shorter tokens in longer, and at least 2 meaningful tokens.
    if (
      shorterTokens.length >= 2 &&
      shorterTokens.every((t) => longerSet.has(t))
    ) {
      tokenScore = Math.max(tokenScore, 0.9);
    }
  }

  const editScore = stringLevenshteinSimilarity(a, b);
  return Math.max(tokenScore, editScore);
}

function stringLevenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = stringLevenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

function stringLevenshteinDistance(a: string, b: string): number {
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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeConfidence(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Allow 0–100 style scores from the model.
    const n = value > 1 ? value / 100 : value;
    return clamp01(n);
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (!Number.isFinite(n)) return null;
    return clamp01(n > 1 ? n / 100 : n);
  }
  return null;
}

function asBooleanFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return false;
}

/**
 * Blend string evidence with AI self-confidence.
 * String dominates (0.75) so AI optimism cannot push a weak/borderline match over.
 */
export function combineRecipientConfidence(
  stringSimilarity: number,
  aiConfidence: number | null | undefined
): number {
  const s = clamp01(stringSimilarity);
  const ai =
    aiConfidence != null && Number.isFinite(aiConfidence)
      ? clamp01(aiConfidence)
      : s;
  return 0.75 * s + 0.25 * ai;
}

export type RecipientFieldVerdict = "accept" | "mismatch" | "unclear";

/**
 * Decide accept / clear mismatch / unclear for one recipient field
 * (account number or account name).
 */
export function verdictRecipientField(input: {
  stringSimilarity: number;
  aiConfidence?: number | null;
  truncated?: boolean;
  /** When false, missing extracted value → unclear (account). */
  required?: boolean;
  hasExtracted?: boolean;
}): RecipientFieldVerdict {
  const required = input.required !== false;
  if (required && input.hasExtracted === false) {
    return "unclear";
  }
  if (input.hasExtracted === false) {
    return "accept";
  }

  const truncated = Boolean(input.truncated);
  const stringSim = clamp01(input.stringSimilarity);
  const combined = combineRecipientConfidence(
    stringSim,
    input.aiConfidence ?? null
  );
  const threshold = truncated
    ? PROOF_RECIPIENT_TRUNCATED_THRESHOLD
    : PROOF_RECIPIENT_CONFIDENCE_THRESHOLD;
  const floor = truncated
    ? PROOF_RECIPIENT_TRUNCATED_STRING_FLOOR
    : PROOF_RECIPIENT_STRING_FLOOR;

  if (stringSim < PROOF_RECIPIENT_CLEAR_MISMATCH_BELOW) {
    return "mismatch";
  }
  if (combined >= threshold && stringSim >= floor) {
    return "accept";
  }
  return "unclear";
}

/** Digits-only Kode dan Nomor Seri Faktur Pajak. */
export function normalizeTaxInvoiceSerial(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, "");
  // Typical e-Faktur serial is 15–17 digits; accept 13–20 to tolerate variants.
  if (digits.length < 13 || digits.length > 20) return null;
  return digits;
}

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  januari: 1,
  january: 1,
  februari: 2,
  february: 2,
  maret: 3,
  march: 3,
  april: 4,
  mei: 5,
  may: 5,
  juni: 6,
  june: 6,
  juli: 7,
  july: 7,
  agustus: 8,
  august: 8,
  september: 9,
  oktober: 10,
  october: 10,
  november: 11,
  desember: 12,
  december: 12,
};

/** Parse AI / printed dates into YYYY-MM-DD (UTC calendar day). */
export function normalizeTaxInvoiceDate(
  value: unknown
): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const m = Number(iso[2]);
      const d = Number(iso[3]);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${iso[1]}-${iso[2]}-${iso[3]}`;
      }
    }

    const id = trimmed.match(
      /^(\d{1,2})\s+([A-Za-z.]+)\s+(\d{4})\b/
    );
    if (id) {
      const day = Number(id[1]);
      const monthKey = id[2].replace(/\./g, "").toLowerCase();
      const month = MONTH_NAME_TO_INDEX[monthKey];
      const year = Number(id[3]);
      if (month && day >= 1 && day <= 31 && year >= 2000) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    const dmy = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]);
      const year = Number(dmy[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }
  return null;
}

/** Alias — transfer / commercial invoice calendar dates use the same parser. */
export const normalizeDocumentDate = normalizeTaxInvoiceDate;

export function taxInvoiceDateToUtcDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** UTC calendar day YYYY-MM-DD from a Date (e.g. invoice submittedAt). */
export function utcCalendarDateString(value: Date | null | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Classify transfer status when the proof prints one.
 * null = unreadable / not present → do not fail closed on status alone.
 */
export function classifyTransferStatus(
  value: string | null | undefined
): "success" | "failed" | "pending" | null {
  if (value == null) return null;
  const s = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;

  if (
    /\b(gagal|failed|fail|reject|rejected|ditolak|batal|cancelled|canceled|error|tidak berhasil)\b/.test(
      s
    )
  ) {
    return "failed";
  }
  if (
    /\b(pending|menunggu|diproses|processing|in progress|antri|waiting|on hold)\b/.test(
      s
    )
  ) {
    return "pending";
  }
  if (
    /\b(berhasil|sukses|success|successful|completed|complete|lunas|settled|ok|done)\b/.test(
      s
    )
  ) {
    return "success";
  }
  return null;
}

export function normalizePaymentReference(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const cleaned = String(value)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return cleaned.length >= 3 ? cleaned : null;
}

export function paymentReferencesMatch(
  expected: string | null | undefined,
  extracted: string | null | undefined
): boolean {
  const a = normalizePaymentReference(expected);
  const b = normalizePaymentReference(extracted);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function bankNamesMatch(
  expected: string | null | undefined,
  extracted: string | null | undefined
): boolean {
  const a = normalizePartyName(expected);
  const b = normalizePartyName(extracted);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // Common short codes vs full names (BCA, BRI, etc.)
  const compactA = a.replace(/\s+/g, "");
  const compactB = b.replace(/\s+/g, "");
  return compactA.includes(compactB) || compactB.includes(compactA);
}

export async function hashUploadFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return createHash("sha256").update(buffer).digest("hex");
}

async function fileToDataUrl(file: File): Promise<{ mime: string; dataUrl: string }> {
  const mime = file.type || "application/octet-stream";
  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  return { mime, dataUrl };
}

function buildUserContent(
  prompt: string,
  mime: string,
  dataUrl: string,
  filename: string
): Array<Record<string, unknown>> {
  if (mime.startsWith("image/")) {
    return [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: dataUrl } },
    ];
  }
  return [
    { type: "text", text: prompt },
    {
      type: "file",
      file: {
        filename: filename || "document.pdf",
        file_data: dataUrl,
      },
    },
  ];
}

/** Shared OpenAI Vision/JSON extract used by payment verify and purchase soft-fill. */
export async function callOpenAiJsonExtract(
  file: File,
  prompt: string
): Promise<Record<string, unknown>> {
  const apiKey = openaiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const { mime, dataUrl } = await fileToDataUrl(file);
  const model =
    process.env.OPENAI_PAYMENT_VERIFY_MODEL?.trim() || DEFAULT_MODEL;

  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract structured fields from Indonesian financial documents. Reply with JSON only. Amounts must be plain numbers in IDR (no currency symbols, no thousand separators). Dates should be ISO YYYY-MM-DD when possible. If a field is unreadable, use null.",
        },
        {
          role: "user",
          content: buildUserContent(prompt, mime, dataUrl, file.name),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `OpenAI verification failed (${response.status}): ${body.slice(0, 300)}`
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = payload.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("OpenAI returned an empty verification response.");
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("OpenAI returned invalid JSON for document verification.");
  }
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function extractPaymentProofFields(
  file: File
): Promise<ExtractedPaymentProof> {
  const json = await callOpenAiJsonExtract(
    file,
    [
      "This is a proof of payment / transfer receipt / bank confirmation (Indonesian or general).",
      "Extract these general fields when present (do not assume a specific bank layout):",
      "- amount: transferred/paid amount in IDR (number).",
      "- transferDate: transaction / transfer / settlement date as YYYY-MM-DD.",
      "- recipientAccountNumber: destination / penerima rekening digits only (ignore spaces/dashes/masking chars like *). If partially masked or cropped, return the visible digits only.",
      "- recipientAccountConfidence: 0–1 how sure you are those digits are the true destination account (lower if masked/cropped/blurry).",
      "- recipientAccountTruncated: true if the account looks cut off, masked (****), or incomplete on the slip.",
      "- recipientBankName: destination bank name if shown (e.g. BCA, Mandiri), else null.",
      "- recipientName: destination account holder name (nama penerima) if shown; keep visible text even if truncated mid-word.",
      "- recipientNameConfidence: 0–1 confidence for recipientName.",
      "- recipientNameTruncated: true if the name is visibly cut off / ellipsis / incomplete.",
      "- payerName: sender / pengirim / from account name if shown.",
      "- status: transaction status text if shown (e.g. Berhasil, Success, Completed, Pending, Gagal).",
      "- reference: payment reference / berita / invoice number / keterangan if it looks like an invoice or transfer reference; else null.",
      'Return JSON: {"amount": number|null, "transferDate": string|null, "recipientAccountNumber": string|null, "recipientAccountConfidence": number|null, "recipientAccountTruncated": boolean, "recipientBankName": string|null, "recipientName": string|null, "recipientNameConfidence": number|null, "recipientNameTruncated": boolean, "payerName": string|null, "status": string|null, "reference": string|null}',
    ].join(" ")
  );

  return {
    amount: normalizeExtractedAmount(json.amount),
    transferDate: normalizeDocumentDate(json.transferDate),
    recipientAccountNumber: asTrimmedString(json.recipientAccountNumber),
    recipientAccountConfidence: normalizeConfidence(
      json.recipientAccountConfidence
    ),
    recipientAccountTruncated: asBooleanFlag(json.recipientAccountTruncated),
    recipientBankName: asTrimmedString(json.recipientBankName),
    recipientName: asTrimmedString(json.recipientName),
    recipientNameConfidence: normalizeConfidence(json.recipientNameConfidence),
    recipientNameTruncated: asBooleanFlag(json.recipientNameTruncated),
    payerName: asTrimmedString(json.payerName),
    status: asTrimmedString(json.status),
    reference: asTrimmedString(json.reference),
  };
}

async function extractTaxInvoiceFields(
  file: File
): Promise<ExtractedTaxInvoice> {
  const json = await callOpenAiJsonExtract(
    file,
    [
      "This is an Indonesian tax invoice (Faktur Pajak) issued by the service provider.",
      "Important party roles (do not swap):",
      "- sellerName (penjual / Pengusaha Kena Pajak / PKP) is the issuer — typically PT Relasi Global Solusi / Relasi Global Solusi / RGS.",
      "- buyerName (pembeli / Penerima Jasa Kena Pajak / lawan transaksi) is the customer/client — never RGS.",
      "Extract these fields carefully. Verification is strict yes/no — if a required field is unclear, truncated, guessed, or unreadable, return null (do not invent or approximate).",
      "- buyerName: full nama Pembeli Barang Kena Pajak / Penerima Jasa Kena Pajak (lawan transaksi pembeli), NOT the seller/PKP block. Full visible legal name only; null if cut off or uncertain.",
      "- sellerName: nama Pengusaha Kena Pajak (penjual / PKP / issuer), NOT the pembeli. Full visible legal name only; null if cut off or uncertain.",
      "- npwp: NPWP of the buyer (pembeli / lawan transaksi), not the seller. Digits as printed; null if incomplete/unclear.",
      "- dpp: Dasar Pengenaan Pajak (harga jual tanpa PPN); null if unreadable.",
      "- ppn: Jumlah PPN (Pajak Pertambahan Nilai); null if unreadable.",
      "- total: grand total including tax if printed (DPP + PPN); otherwise null.",
      "- invoiceDate: tanggal Faktur Pajak as YYYY-MM-DD (e.g. '04 Juli 2026' → 2026-07-04); null if unreadable.",
      "- serial: Kode dan Nomor Seri Faktur Pajak (digits, usually near the top); null if incomplete/unclear.",
      "Also list any other monetary totals under amounts.",
      'Return JSON: {"buyerName": string|null, "sellerName": string|null, "npwp": string|null, "dpp": number|null, "ppn": number|null, "total": number|null, "invoiceDate": string|null, "serial": string|null, "amounts": number[]}',
    ].join(" ")
  );

  const amountsRaw = Array.isArray(json.amounts) ? json.amounts : [];
  const amounts = uniqueFiniteAmounts(
    amountsRaw.map((value) => normalizeExtractedAmount(value))
  );

  const serialRaw =
    typeof json.serial === "string"
      ? json.serial
      : typeof json.nomorSeri === "string"
        ? json.nomorSeri
        : null;

  return {
    buyerName: typeof json.buyerName === "string" ? json.buyerName.trim() : null,
    sellerName:
      typeof json.sellerName === "string" ? json.sellerName.trim() : null,
    npwp: typeof json.npwp === "string" ? json.npwp : null,
    dpp: normalizeExtractedAmount(json.dpp),
    ppn: normalizeExtractedAmount(json.ppn),
    total: normalizeExtractedAmount(json.total),
    invoiceDate: normalizeTaxInvoiceDate(json.invoiceDate),
    serial: normalizeTaxInvoiceSerial(serialRaw),
    amounts,
  };
}

export type VerifyPaymentProofInput = {
  paymentProof: File;
  /** Commercial invoice amount (IDR), tax-inclusive. */
  invoiceAmount: number | null;
  /**
   * Commercial invoice issue / submitted date (UTC calendar day YYYY-MM-DD).
   * Proof transfer date must not be earlier than this.
   */
  invoiceIssuedDate: string | null;
  /** Company recipient bank (RGS) — required for proof recipient check. */
  companyBank: CompanyBankDetails | null;
  /** Commercial invoice number for optional reference cross-check. */
  invoiceNumber?: string | null;
  /** ERP client / organization name — optional proof payer check. */
  clientName: string | null;
};

export type VerifyTaxInvoiceDocumentInput = {
  taxInvoiceDocument: File;
  /** Commercial invoice amount (IDR), tax-inclusive. */
  invoiceAmount: number | null;
  /**
   * Keluaran (default): client NPWP (required).
   * Masukan: company NPWP — checked only when present (skip if null/empty).
   */
  clientNpwp: string | null;
  /**
   * Keluaran: ERP client name — tax buyer (pembeli).
   * Masukan: supplier/vendor name — tax seller (penjual).
   */
  clientName: string | null;
  /**
   * RGS / Company.name from Prisma.
   * Keluaran: tax seller (penjual). Masukan: tax buyer (pembeli).
   * Falls back to letterhead legal name when empty.
   */
  companyName?: string | null;
  /**
   * `keluaran` (default): RGS seller, client buyer.
   * `masukan`: RGS buyer, supplier seller.
   */
  direction?: TaxInvoiceDirection;
  /** Exclude current period/purchase when checking reused tax invoices. */
  excludeId: string;
  /** @deprecated Use excludeId */
  excludePeriodId?: string;
  /** DB lookup for prior rows that already used this tax invoice. */
  findTaxInvoiceConflict: TaxInvoiceDuplicateLookup;
};

export type VerifyPurchaseTaxInvoiceInput = {
  taxInvoiceDocument: File;
  /** Purchase amount (IDR), tax-inclusive when includes PPN. */
  invoiceAmount: number | null;
  /** Supplier / vendor name — tax seller (penjual). */
  supplierName: string | null;
  /**
   * RGS / Company.name — tax buyer (pembeli).
   * Falls back to letterhead legal name when empty.
   */
  companyName?: string | null;
  /**
   * Company Tax ID (NPWP) as buyer — checked only when present.
   * Prefer resolveCompanyNpwpFromEnv() when Company.npwp is not stored.
   */
  companyNpwp?: string | null;
  /** Exclude current purchase invoice when re-uploading. Empty on create. */
  excludePurchaseInvoiceId?: string;
  findTaxInvoiceConflict: TaxInvoiceDuplicateLookup;
};

/**
 * Server-side AI/OCR check for proof of payment before marking paid.
 * Fail-closed: missing API key, unreadable fields, or mismatches all reject.
 *
 * 1. Amount equals commercial invoice (exact IDR, ±1 noise only)
 * 2. Recipient account (+ optional name/bank) via fuzzy confidence
 *    (PROOF_RECIPIENT_CONFIDENCE_THRESHOLD = 0.88; truncated = 0.85).
 *    Unsure / borderline → reject (proof_recipient_unclear).
 * 3. Transfer date >= commercial invoice issue/submitted date
 * 4. Status, if extractable, must be success (reject failed/pending)
 * 5. Payer name, if clearly present, must fuzzy-match client name
 * 6. Reference, if present on proof, must match invoice number
 */
export async function verifyPaymentProof(
  input: VerifyPaymentProofInput
): Promise<PaymentDocumentVerifyResult> {
  if (!isPaymentDocumentVerifyConfigured()) {
    return { ok: false, failures: ["not_configured"] };
  }

  if (input.invoiceAmount == null || !Number.isFinite(input.invoiceAmount)) {
    return { ok: false, failures: ["invoice_amount_missing"] };
  }

  if (!input.invoiceIssuedDate) {
    return { ok: false, failures: ["invoice_date_missing"] };
  }

  if (!input.companyBank?.accountNumber) {
    return { ok: false, failures: ["company_bank_missing"] };
  }

  const failures: PaymentVerifyFailureCode[] = [];
  const details: NonNullable<
    Extract<PaymentDocumentVerifyResult, { ok: false }>["details"]
  > = {
    expectedAmount: input.invoiceAmount,
    expectedRecipientAccount: input.companyBank.accountNumberDisplay,
    expectedBankName: input.companyBank.bankName,
    invoiceIssuedDate: input.invoiceIssuedDate,
    expectedPayerName: input.clientName ?? undefined,
    expectedReference: input.invoiceNumber ?? undefined,
  };

  try {
    const proof = await extractPaymentProofFields(input.paymentProof);
    details.proofAmount = proof.amount;
    details.extractedRecipientAccount = proof.recipientAccountNumber;
    details.extractedBankName = proof.recipientBankName;
    details.proofTransferDate = proof.transferDate;
    details.proofStatus = proof.status;
    details.extractedPayerName = proof.payerName;
    details.extractedReference = proof.reference;

    if (
      proof.amount == null ||
      !proofAmountsMatch(input.invoiceAmount, proof.amount)
    ) {
      failures.push("proof_amount_mismatch");
    }

    const recipientFailure = evaluateProofRecipient({
      companyBank: input.companyBank,
      proof,
    });
    if (recipientFailure) {
      failures.push(recipientFailure);
    }

    if (!proof.transferDate) {
      failures.push("proof_date_before_invoice");
    } else if (proof.transferDate < input.invoiceIssuedDate) {
      failures.push("proof_date_before_invoice");
    }

    const statusKind = classifyTransferStatus(proof.status);
    if (statusKind === "failed" || statusKind === "pending") {
      failures.push("proof_status_not_success");
    }

    if (
      proof.payerName &&
      normalizePartyName(input.clientName) &&
      !partyNamesMatch(input.clientName, proof.payerName)
    ) {
      failures.push("proof_payer_name_mismatch");
    }

    if (
      proof.reference &&
      input.invoiceNumber &&
      !paymentReferencesMatch(input.invoiceNumber, proof.reference)
    ) {
      failures.push("proof_reference_mismatch");
    }
  } catch {
    return { ok: false, failures: ["api_error"] };
  }

  if (failures.length > 0) {
    return { ok: false, failures, details };
  }
  return { ok: true };
}

/**
 * Fuzzy recipient check for truncated bank slips (fail closed).
 * Returns null only when confidence is clearly high; mismatch or
 * unclear/borderline both reject (distinct EN/ID messages).
 */
function evaluateProofRecipient(input: {
  companyBank: CompanyBankDetails;
  proof: ExtractedPaymentProof;
}): "proof_recipient_mismatch" | "proof_recipient_unclear" | null {
  const { companyBank, proof } = input;

  const accountSim = bankAccountNumberSimilarity(
    companyBank.accountNumber,
    proof.recipientAccountNumber
  );
  const accountVerdict = verdictRecipientField({
    stringSimilarity: accountSim,
    aiConfidence: proof.recipientAccountConfidence,
    truncated: proof.recipientAccountTruncated,
    required: true,
    hasExtracted: Boolean(proof.recipientAccountNumber),
  });

  if (
    companyBank.bankName &&
    proof.recipientBankName &&
    !bankNamesMatch(companyBank.bankName, proof.recipientBankName)
  ) {
    // Wrong destination bank when both sides are readable → clear mismatch.
    return "proof_recipient_mismatch";
  }

  let nameVerdict: RecipientFieldVerdict = "accept";
  if (companyBank.accountName && proof.recipientName) {
    const nameSim = partyNameSimilarity(
      companyBank.accountName,
      proof.recipientName
    );
    nameVerdict = verdictRecipientField({
      stringSimilarity: nameSim,
      aiConfidence: proof.recipientNameConfidence,
      truncated: proof.recipientNameTruncated,
      required: false,
      hasExtracted: true,
    });
  }

  if (accountVerdict === "mismatch" || nameVerdict === "mismatch") {
    return "proof_recipient_mismatch";
  }
  if (accountVerdict === "unclear" || nameVerdict === "unclear") {
    return "proof_recipient_unclear";
  }
  return null;
}

/**
 * Server-side AI/OCR check for tax invoice (faktur).
 * Strict yes/no (fail closed) — no proof-of-payment fuzzy/confidence logic.
 *
 * ## Keluaran (default, PPN keluaran / output VAT)
 * RGS issues the faktur — RGS is penjual (seller), ERP client is pembeli (buyer).
 *
 * ## Masukan (`direction: "masukan"`, PPN masukan / input VAT)
 * Roles flipped — RGS is pembeli (buyer), supplier is penjual (seller).
 *
 * Shared checks: DPP+PPN/total ±2 IDR, unique serial, hash / date+amount reuse,
 * buyer NPWP when required/available. Unreadable required fields → reject.
 */
export async function verifyTaxInvoiceDocument(
  input: VerifyTaxInvoiceDocumentInput
): Promise<PaymentDocumentVerifyResult> {
  if (!isPaymentDocumentVerifyConfigured()) {
    return { ok: false, failures: ["not_configured"] };
  }

  if (input.invoiceAmount == null || !Number.isFinite(input.invoiceAmount)) {
    return { ok: false, failures: ["invoice_amount_missing"] };
  }

  const direction: TaxInvoiceDirection = input.direction ?? "keluaran";
  const companyDisplayName = resolveTaxInvoiceCompanyName(input.companyName);
  const counterpartyName = input.clientName;
  const buyerNpwpDigits = stripNpwpDigits(input.clientNpwp ?? "");

  if (direction === "keluaran") {
    if (!buyerNpwpDigits) {
      return { ok: false, failures: ["client_npwp_missing"] };
    }
    if (!normalizePartyName(counterpartyName)) {
      return { ok: false, failures: ["client_name_missing"] };
    }
  } else if (!normalizePartyName(counterpartyName)) {
    return { ok: false, failures: ["supplier_name_missing"] };
  }

  const expectedBuyerName =
    direction === "keluaran" ? (counterpartyName ?? undefined) : companyDisplayName;
  const expectedSellerName =
    direction === "keluaran"
      ? companyDisplayName
      : (counterpartyName ?? undefined);

  const failures: PaymentVerifyFailureCode[] = [];
  const details: NonNullable<
    Extract<PaymentDocumentVerifyResult, { ok: false }>["details"]
  > = {
    expectedAmount: input.invoiceAmount,
    expectedNpwp: buyerNpwpDigits || undefined,
    expectedBuyerName,
    expectedSellerName,
  };
  let taxStored: TaxInvoiceExtractStored | undefined;

  try {
    const [tax, documentHash] = await Promise.all([
      extractTaxInvoiceFields(input.taxInvoiceDocument),
      hashUploadFile(input.taxInvoiceDocument),
    ]);

    const dppPlusPpn =
      tax.dpp != null && tax.ppn != null ? tax.dpp + tax.ppn : null;
    details.taxAmountCandidates = uniqueFiniteAmounts([
      dppPlusPpn,
      tax.total,
      tax.dpp,
      tax.ppn,
    ]);
    details.extractedNpwp = tax.npwp ? stripNpwpDigits(tax.npwp) : null;
    details.extractedBuyerName = tax.buyerName;
    details.extractedSellerName = tax.sellerName;
    details.taxSerial = tax.serial;
    details.taxIssuedDate = tax.invoiceDate;

    if (!taxInvoiceAmountMatches(input.invoiceAmount, tax)) {
      failures.push("tax_amount_mismatch");
    }

    failures.push(
      ...evaluateTaxInvoiceParties({
        direction,
        counterpartyName,
        companyName: input.companyName,
        buyerName: tax.buyerName,
        sellerName: tax.sellerName,
      })
    );

    // Keluaran: client NPWP required. Masukan: company NPWP only when available.
    if (direction === "keluaran") {
      if (!npwpDigitsMatch(input.clientNpwp, tax.npwp)) {
        failures.push("tax_npwp_mismatch");
      }
    } else if (buyerNpwpDigits) {
      if (!npwpDigitsMatch(input.clientNpwp, tax.npwp)) {
        failures.push("tax_npwp_mismatch");
      }
    }

    if (!tax.serial) {
      failures.push("tax_serial_missing");
    }

    if (tax.serial) {
      taxStored = {
        serial: tax.serial,
        issuedDate: tax.invoiceDate,
        documentHash,
        buyerName: tax.buyerName,
        dpp: tax.dpp,
        ppn: tax.ppn,
        total: tax.total,
      };

      const excludeId =
        input.excludeId || input.excludePeriodId || "";
      const conflict = await input.findTaxInvoiceConflict({
        serial: tax.serial,
        documentHash,
        issuedDate: tax.invoiceDate,
        invoiceAmount: input.invoiceAmount,
        excludeId,
      });
      if (conflict === "serial") {
        failures.push("tax_serial_duplicate");
      } else if (conflict === "document_hash") {
        failures.push("tax_document_duplicate");
      } else if (conflict === "date_amount") {
        failures.push("tax_date_reuse");
      }
    }
  } catch {
    return { ok: false, failures: ["api_error"] };
  }

  if (failures.length > 0) {
    return { ok: false, failures, details, tax: taxStored };
  }
  return { ok: true, tax: taxStored };
}

/**
 * Purchases / PPN masukan: RGS is pembeli, supplier is penjual.
 * Reuses the same extract + compare path with roles flipped.
 */
export async function verifyPurchaseTaxInvoice(
  input: VerifyPurchaseTaxInvoiceInput
): Promise<PaymentDocumentVerifyResult> {
  return verifyTaxInvoiceDocument({
    taxInvoiceDocument: input.taxInvoiceDocument,
    invoiceAmount: input.invoiceAmount,
    clientNpwp: input.companyNpwp ?? null,
    clientName: input.supplierName,
    companyName: input.companyName,
    direction: "masukan",
    excludeId: input.excludePurchaseInvoiceId ?? "",
    findTaxInvoiceConflict: input.findTaxInvoiceConflict,
  });
}

/**
 * Party-side checks for keluaran (RGS seller) or masukan (RGS buyer).
 */
function evaluateTaxInvoiceParties(input: {
  direction: TaxInvoiceDirection;
  counterpartyName: string | null;
  companyName?: string | null;
  buyerName: string | null;
  sellerName: string | null;
}): PaymentVerifyFailureCode[] {
  if (input.direction === "masukan") {
    return evaluateMasukanTaxInvoiceParties(input);
  }
  return [
    ...evaluateKeluaranBuyerParties(input),
    ...evaluateKeluaranSellerParties(input),
  ];
}

/** Keluaran buyer (pembeli): ERP client; must never look like RGS. */
function evaluateKeluaranBuyerParties(input: {
  counterpartyName: string | null;
  companyName?: string | null;
  buyerName: string | null;
}): PaymentVerifyFailureCode[] {
  if (looksLikeCompanyOrRgs(input.buyerName, input.companyName)) {
    return ["tax_buyer_is_company"];
  }
  if (!taxBuyerNamesMatch(input.counterpartyName, input.buyerName)) {
    return ["tax_buyer_name_mismatch"];
  }
  return [];
}

/**
 * Keluaran seller (penjual): must look like RGS / Company; must never be the client.
 * When seller is missing, reject only if buyer already looks like the client.
 */
function evaluateKeluaranSellerParties(input: {
  counterpartyName: string | null;
  companyName?: string | null;
  buyerName: string | null;
  sellerName: string | null;
}): PaymentVerifyFailureCode[] {
  const sellerNorm = normalizePartyName(input.sellerName);
  const buyerLooksLikeClient =
    taxBuyerNamesMatch(input.counterpartyName, input.buyerName) ||
    partyNamesMatch(input.counterpartyName, input.buyerName);

  if (!sellerNorm) {
    if (buyerLooksLikeClient) {
      return ["tax_seller_name_mismatch"];
    }
    return [];
  }

  if (
    taxBuyerNamesMatch(input.counterpartyName, input.sellerName) ||
    partyNamesMatch(input.counterpartyName, input.sellerName)
  ) {
    return ["tax_seller_is_client"];
  }

  if (!looksLikeCompanyOrRgs(input.sellerName, input.companyName)) {
    return ["tax_seller_name_mismatch"];
  }

  return [];
}

/**
 * Masukan: RGS is pembeli; supplier is penjual.
 * Reject swapped parties (RGS as seller, or supplier as buyer).
 */
function evaluateMasukanTaxInvoiceParties(input: {
  counterpartyName: string | null;
  companyName?: string | null;
  buyerName: string | null;
  sellerName: string | null;
}): PaymentVerifyFailureCode[] {
  const failures: PaymentVerifyFailureCode[] = [];

  // Buyer must be RGS — not the supplier.
  if (
    taxBuyerNamesMatch(input.counterpartyName, input.buyerName) ||
    partyNamesMatch(input.counterpartyName, input.buyerName)
  ) {
    failures.push("tax_buyer_is_supplier");
  } else if (!looksLikeCompanyOrRgs(input.buyerName, input.companyName)) {
    failures.push("tax_buyer_name_mismatch");
  }

  const sellerNorm = normalizePartyName(input.sellerName);
  const buyerLooksLikeCompany = looksLikeCompanyOrRgs(
    input.buyerName,
    input.companyName
  );

  if (!sellerNorm) {
    // Seller unreadable: reject when buyer already looks like RGS (plausible sides).
    if (buyerLooksLikeCompany && !failures.includes("tax_buyer_is_supplier")) {
      failures.push("tax_seller_name_mismatch");
    }
    return failures;
  }

  if (looksLikeCompanyOrRgs(input.sellerName, input.companyName)) {
    failures.push("tax_seller_is_company");
    return failures;
  }

  if (!taxBuyerNamesMatch(input.counterpartyName, input.sellerName)) {
    failures.push("tax_seller_name_mismatch");
  }

  return failures;
}
