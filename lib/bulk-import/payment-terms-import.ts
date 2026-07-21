import type { AppLocale } from "@/lib/i18n/locale";
import {
  CASH_PAYMENT_TERMS_DAYS,
  DEFAULT_INVOICE_DUE_DAYS,
  normalizePaymentTermsDays,
  PAYMENT_TERMS_DAYS_OPTIONS,
  type PaymentTermsDaysOption,
} from "@/lib/invoice-period";

/** Same choices as Add Client / Add Vendor (`paymentTermsDays`). */
export const PAYMENT_TERMS_IMPORT_OPTIONS = PAYMENT_TERMS_DAYS_OPTIONS;

export type PaymentTermsImportDays = PaymentTermsDaysOption;

/** Create-form default when the cell is blank. */
export const DEFAULT_PAYMENT_TERMS_DAYS = DEFAULT_INVOICE_DUE_DAYS;

/**
 * Full option label matching Add Client / Add Vendor
 * (`pages.*.form.paymentTermsCash` / `paymentTermsNet`).
 */
export function paymentTermsOptionLabel(
  days: number,
  locale: AppLocale
): string {
  if (days === CASH_PAYMENT_TERMS_DAYS) {
    return locale === "id"
      ? "Tunai — jatuh tempo saat invoice dikirim"
      : "Cash — due when invoice is submitted";
  }
  return locale === "id"
    ? `Net ${days} — jatuh tempo dalam ${days} hari`
    : `Net ${days} — due within ${days} days of invoice`;
}

/** Excel dropdown values for the active ERP locale. */
export function paymentTermsDropdown(locale: AppLocale): string[] {
  return PAYMENT_TERMS_IMPORT_OPTIONS.map((days) =>
    paymentTermsOptionLabel(days, locale)
  );
}

function normalizePaymentTermsText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[—–−-]+/g, "-");
}

function isAllowedPaymentTermsDays(
  days: number
): days is PaymentTermsImportDays {
  return (PAYMENT_TERMS_IMPORT_OPTIONS as readonly number[]).includes(days);
}

/**
 * Parse Payment terms / Syarat pembayaran from Excel import.
 * Blank → default 14. Accepts days (0/7/14/30/45/60), Cash/Tunai,
 * "Net N", and full EN/ID labels.
 */
export function parsePaymentTermsImportValue(raw: unknown): number {
  const value = String(raw ?? "").trim();
  if (!value) {
    return normalizePaymentTermsDays(DEFAULT_PAYMENT_TERMS_DAYS);
  }

  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && isAllowedPaymentTermsDays(asNumber)) {
    return normalizePaymentTermsDays(asNumber);
  }

  const normalized = normalizePaymentTermsText(value);
  if (
    normalized === "cash" ||
    normalized === "tunai" ||
    normalized === "cash - due when invoice is submitted" ||
    normalized === "tunai - jatuh tempo saat invoice dikirim"
  ) {
    return normalizePaymentTermsDays(CASH_PAYMENT_TERMS_DAYS);
  }

  for (const days of PAYMENT_TERMS_IMPORT_OPTIONS) {
    if (days === CASH_PAYMENT_TERMS_DAYS) continue;
    const en = normalizePaymentTermsText(paymentTermsOptionLabel(days, "en"));
    const id = normalizePaymentTermsText(paymentTermsOptionLabel(days, "id"));
    const short = `net ${days}`;
    if (normalized === en || normalized === id || normalized === short) {
      return normalizePaymentTermsDays(days);
    }
  }

  const allowed = [
    "Cash",
    ...PAYMENT_TERMS_IMPORT_OPTIONS.filter((d) => d !== CASH_PAYMENT_TERMS_DAYS).map(
      (d) => `Net ${d}`
    ),
  ].join(", ");
  throw new Error(
    `Payment terms must be one of: ${allowed} (or blank for Net ${DEFAULT_PAYMENT_TERMS_DAYS}).`
  );
}

/**
 * Display label for import preview.
 * Uses English short forms (Cash / Net N); Tunai is accepted on parse.
 */
export function formatPaymentTermsImportDisplay(days: number): string {
  if (days === CASH_PAYMENT_TERMS_DAYS) return "Cash";
  return `Net ${days}`;
}
