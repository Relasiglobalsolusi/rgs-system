import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";

/** DJP placeholder when the buyer has no NPWP (still requires NIK or passport). */
export const DJP_PLACEHOLDER_NPWP = "00.000.000.0-000.000";

export function isPlaceholderNpwp(value: string | null | undefined): boolean {
  return stripNpwpDigits(String(value ?? "")) === "000000000000000";
}

export function isValidNik(value: string | null | undefined): boolean {
  return stripNpwpDigits(String(value ?? "")).length === 16;
}

export function isValidPassportNumber(value: string | null | undefined): boolean {
  const raw = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{6,12}$/.test(raw);
}

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
  const text = value.trim();
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
 * HTML custom-validity message for NPWP inputs.
 * Empty → "" when optional; requiredMessage when required.
 * Non-empty invalid → invalidMessage.
 */
export function npwpFieldCustomValidity(
  raw: string,
  invalidMessage: string,
  options?: { required?: boolean; requiredMessage?: string }
): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    if (options?.required) {
      return options.requiredMessage?.trim() || invalidMessage;
    }
    return "";
  }
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

/** Missing-NPWP message for client create/edit/import (Company vs Individual). */
export function npwpRequiredMessage(
  locale: AppLocale = DEFAULT_LOCALE,
  variant: NpwpMessageVariant = "company"
): string {
  if (variant === "client") {
    return locale === "id"
      ? "NPWP atau NIK wajib diisi."
      : "NPWP or NIK is required.";
  }
  return locale === "id" ? "NPWP wajib diisi." : "NPWP is required.";
}

/**
 * Required NPWP / NIK from a form or spreadsheet cell.
 * Empty or invalid → throws localized Error. Returns digits-only.
 */
export function parseRequiredClientNpwpValue(
  raw: string | null | undefined,
  locale: AppLocale = DEFAULT_LOCALE,
  variant: NpwpMessageVariant = "company"
): string {
  const trimmed = sanitizeNpwpRawInput(String(raw ?? ""));
  if (!trimmed) {
    throw new Error(npwpRequiredMessage(locale, variant));
  }
  const digits = stripNpwpDigits(trimmed);
  if (digits.length !== NPWP_MIN_DIGITS && digits.length !== NPWP_MAX_DIGITS) {
    throw new Error(
      npwpInvalidMessage(locale, digits.length || undefined, variant)
    );
  }
  return digits;
}

/**
 * Tax is always charged. A tax invoice file is always required.
 * Company Tax ID (NPWP) is copied when present; if missing, Head Office can
 * still issue a tax invoice using the client’s NIK-derived tax ID.
 */
export function taxInvoiceDefaultsFromClient(
  client: { npwp?: string | null } | null | undefined
): { requiresTaxInvoice: boolean; npwp: string } {
  const npwp = client?.npwp?.trim() ?? "";
  return { requiresTaxInvoice: true, npwp };
}
