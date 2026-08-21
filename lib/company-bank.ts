/**
 * RGS / company recipient bank for commercial invoices and payment-proof checks.
 *
 * Source priority:
 * 1. Explicit invoice / sale bank account (CompanyBankAccount)
 * 2. Company row (`bankAccountNumber`, `bankName`, `bankAccountName`)
 * 3. Env fallbacks: COMPANY_BANK_ACCOUNT_NUMBER, COMPANY_BANK_NAME,
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
  company?: CompanyBankSource | null,
  account?: CompanyBankSource | null
): CompanyBankDetails | null {
  const rawAccount =
    account?.bankAccountNumber?.trim() ||
    company?.bankAccountNumber?.trim() ||
    process.env.COMPANY_BANK_ACCOUNT_NUMBER?.trim() ||
    "";
  const accountNumber = normalizeBankAccountNumber(rawAccount);
  if (!accountNumber) return null;

  const bankName =
    account?.bankName?.trim() ||
    company?.bankName?.trim() ||
    process.env.COMPANY_BANK_NAME?.trim() ||
    null;
  const accountName =
    account?.bankAccountName?.trim() ||
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
