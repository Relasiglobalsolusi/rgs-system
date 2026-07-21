import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";

/**
 * Excel number format for NPWP / Company Tax ID columns.
 * Text (`@`) keeps full 15–16 digit IDs (no scientific notation, no `.00`).
 * Numeric formats cannot safely hold 16-digit integers in Excel.
 */
export const IMPORT_NPWP_EXCEL_FORMAT = "@";

/** Classic NPWP length (still in use). */
export const NPWP_MIN_DIGITS = 15;
/** NIK-based / newer NPWP length. */
export const NPWP_MAX_DIGITS = 16;

/**
 * Strip Excel/float display artifacts before digit extraction.
 * e.g. "12345678901234.00", "12345678901234,0", "1.23456E+13"
 * Does NOT alter classic NPWP punctuation (multiple dots / dashes).
 */
export function sanitizeNpwpRawInput(value: string): string {
  let text = value.trim();
  if (!text) return "";

  // Scientific notation from Excel number cells
  if (/^\d+(\.\d+)?e[+-]?\d+$/i.test(text)) {
    const asNumber = Number(text);
    if (Number.isFinite(asNumber)) {
      return Math.trunc(asNumber).toLocaleString("en-US", {
        useGrouping: false,
        maximumFractionDigits: 0,
      });
    }
  }

  // Plain decimal / Excel general format trailing fraction zeros:
  // "12345678901234.00" or "12345678901234,00" — not NPWP dotted form.
  if (/^\d+[.,]0+$/.test(text)) {
    return text.replace(/[.,]0+$/, "");
  }

  return text;
}

/** Strip formatting; keep digits only. */
export function stripNpwpDigits(value: string): string {
  return sanitizeNpwpRawInput(value).replace(/\D/g, "");
}

/** Digit count after sanitizing Excel artifacts and stripping punctuation. */
export function npwpDigitCount(value: string): number {
  return stripNpwpDigits(value).length;
}

/**
 * Indonesian NPWP is exactly 15 digits (classic) or 16 digits (NIK-based).
 * Accept formatted input (dots/dashes/spaces) or digits-only.
 * Empty string is not valid here — callers treat empty as optional separately.
 */
export function isValidNpwp(value: string): boolean {
  const digits = stripNpwpDigits(value);
  return digits.length === NPWP_MIN_DIGITS || digits.length === NPWP_MAX_DIGITS;
}

/**
 * HTML custom-validity message for optional NPWP inputs.
 * Empty → "" (valid). Non-empty invalid → localized message.
 */
export function npwpFieldCustomValidity(
  raw: string,
  invalidMessage: string
): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  return isValidNpwp(trimmed) ? "" : invalidMessage;
}

export type NpwpMessageVariant = "company" | "client";

/** Localized invalid-NPWP message (forms, server actions, Excel import). */
export function npwpInvalidMessage(
  locale: AppLocale = DEFAULT_LOCALE,
  foundDigits?: number,
  variant: NpwpMessageVariant = "company"
): string {
  const found =
    typeof foundDigits === "number" && foundDigits > 0
      ? locale === "id"
        ? ` (ditemukan ${foundDigits} digit)`
        : ` (found ${foundDigits} digits)`
      : "";
  if (variant === "client") {
    if (locale === "id") {
      return `NPWP Atau NIK Klien harus 15 atau 16 digit (titik, strip, dan spasi opsional).${found}`;
    }
    return `Client NPWP Or NIK must be 15 or 16 digits (formatting optional).${found}`;
  }
  if (locale === "id") {
    return `NPWP / NPWP Perusahaan harus 15 atau 16 digit (titik, strip, dan spasi opsional).${found}`;
  }
  return `Company Tax ID (NPWP) must be 15 or 16 digits (formatting optional).${found}`;
}

/**
 * Normalize for storage: digits only when valid; otherwise trimmed input.
 * Callers should validate with isValidNpwp when required.
 */
export function normalizeNpwp(value: string): string {
  const trimmed = sanitizeNpwpRawInput(value);
  if (!trimmed) return "";
  const digits = stripNpwpDigits(trimmed);
  if (digits.length === NPWP_MIN_DIGITS || digits.length === NPWP_MAX_DIGITS) {
    return digits;
  }
  return trimmed;
}

/**
 * Optional NPWP from a form or spreadsheet cell.
 * Empty → null. Non-empty invalid → throws localized Error.
 */
export function parseOptionalNpwpValue(
  raw: string | null | undefined,
  locale: AppLocale = DEFAULT_LOCALE,
  variant: NpwpMessageVariant = "company"
): string | null {
  const trimmed = sanitizeNpwpRawInput(String(raw ?? ""));
  if (!trimmed) return null;
  const digits = stripNpwpDigits(trimmed);
  if (digits.length !== NPWP_MIN_DIGITS && digits.length !== NPWP_MAX_DIGITS) {
    throw new Error(
      npwpInvalidMessage(locale, digits.length || undefined, variant)
    );
  }
  return digits;
}

/** Parse FormData NPWP; required when with-tax. Throws on missing/invalid. */
export function parseRequiredNpwp(
  formData: FormData,
  locale: AppLocale = DEFAULT_LOCALE
): string {
  const raw = sanitizeNpwpRawInput(String(formData.get("npwp") ?? ""));
  if (!raw) {
    throw new Error(
      locale === "id"
        ? "NPWP perusahaan wajib untuk proyek dengan Faktur Pajak."
        : "Company Tax ID (NPWP) is required for projects with Tax Invoice."
    );
  }
  const digits = stripNpwpDigits(raw);
  if (digits.length !== NPWP_MIN_DIGITS && digits.length !== NPWP_MAX_DIGITS) {
    throw new Error(npwpInvalidMessage(locale, digits.length || undefined));
  }
  return digits;
}

/** Client is tax-registered when a Company Tax ID (NPWP) is stored. */
export function clientHasCompanyTaxId(
  npwp: string | null | undefined
): boolean {
  return Boolean(npwp?.trim());
}

/**
 * Project tax-invoice defaults from the selected client (source of truth).
 * Trimmed non-empty NPWP → With tax + autofilled NPWP; otherwise Without tax.
 * Project create/edit UI is read-only; NPWP is only edited in the Client directory.
 */
export function taxInvoiceDefaultsFromClient(
  client: { npwp?: string | null } | null | undefined
): { requiresTaxInvoice: boolean; npwp: string } {
  const npwp = client?.npwp?.trim() ?? "";
  if (!clientHasCompanyTaxId(npwp)) {
    return { requiresTaxInvoice: false, npwp: "" };
  }
  return { requiresTaxInvoice: true, npwp };
}
