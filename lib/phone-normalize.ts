import type { AppLocale } from "@/lib/i18n/locale";
import {
  DEFAULT_COUNTRY_CODE,
  DEFAULT_PHONE_COUNTRY_ID,
  getPhoneCountryEntryByDialCode,
  normalizeAndValidatePhoneForCountry,
  normalizeNationalDigitsForInput,
  phoneCountryCodeDropdownValues,
  stripPhoneDigits,
  PHONE_COUNTRY_CODES,
  type PhoneCountryEntry,
} from "@/lib/phone";

/** Example shown in import errors and template instructions. */
export const PHONE_FORMAT_EXAMPLE = "081234567890";

/**
 * Excel dropdown label for Indonesia (pinned first in the list).
 * Older templates pre-filled this as a gray cell hint; import still treats it
 * (and bare "+62") as blank, then defaults to +62 when a phone is present.
 */
export const COUNTRY_CODE_PLACEHOLDER = "+62 Indonesia";

const COUNTRY_CODE_PLACEHOLDER_ALIASES = [
  COUNTRY_CODE_PLACEHOLDER,
  "+62",
] as const;

/** Grey phone-cell hint — national number only (English templates). */
export const PHONE_FORMAT_PLACEHOLDER = "Please exclude country code";

/** Grey phone-cell hint — national number only (Indonesian templates). */
export const PHONE_FORMAT_PLACEHOLDER_ID = "Jangan sertakan kode negara";

/** Company landline / contact / employee phone — same exclude-country-code hint. */
export const COMPANY_PHONE_FORMAT_PLACEHOLDER = PHONE_FORMAT_PLACEHOLDER;
export const CONTACT_PHONE_FORMAT_PLACEHOLDER = PHONE_FORMAT_PLACEHOLDER;

const PHONE_FORMAT_PLACEHOLDERS = [
  PHONE_FORMAT_PLACEHOLDER,
  PHONE_FORMAT_PLACEHOLDER_ID,
  COMPANY_PHONE_FORMAT_PLACEHOLDER,
  CONTACT_PHONE_FORMAT_PLACEHOLDER,
  // Legacy placeholders still treated as blank on import
  "812 XXXX XXXX",
  "21 XXXX XXXX",
  "+62 XXXXXXXXXX",
  "+62 21 XXXXXX",
  "+62 81234567890",
  "+62 XXX XXXXXXXX",
] as const;

/** Locale-aware grey hint for phone columns in Excel templates. */
export function localizedPhoneFormatPlaceholder(locale: AppLocale): string {
  return locale === "id"
    ? PHONE_FORMAT_PLACEHOLDER_ID
    : PHONE_FORMAT_PLACEHOLDER;
}

export function isPhoneFormatPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return PHONE_FORMAT_PLACEHOLDERS.some(
    (placeholder) => placeholder.toLowerCase() === normalized
  );
}

export function isCountryCodePlaceholder(value: string): boolean {
  const trimmed = value.trim();
  return COUNTRY_CODE_PLACEHOLDER_ALIASES.some(
    (alias) => alias.toLowerCase() === trimmed.toLowerCase()
  );
}

/** Excel list values for Country Code dropdowns. */
export function importCountryCodeDropdownValues(): string[] {
  return phoneCountryCodeDropdownValues();
}

/**
 * Resolve a Country Code cell to a list entry (+62 / 62 / "+62 Indonesia").
 */
export function resolveImportCountryEntry(
  raw: string | undefined | null
): PhoneCountryEntry | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || isCountryCodePlaceholder(trimmed)) return null;

  const sortedEntries = [...PHONE_COUNTRY_CODES].sort(
    (a, b) =>
      stripPhoneDigits(b.code).length - stripPhoneDigits(a.code).length
  );

  for (const entry of sortedEntries) {
    if (
      trimmed === entry.code ||
      trimmed.startsWith(`${entry.code} `) ||
      trimmed.toLowerCase().startsWith(entry.code.toLowerCase())
    ) {
      // Prefer exact "+62 Indonesia" style match on label when present.
      if (
        trimmed === `${entry.code} ${entry.label}` ||
        trimmed.startsWith(`${entry.code} `)
      ) {
        const labelPart = trimmed.slice(entry.code.length).trim().toLowerCase();
        if (!labelPart || labelPart === entry.label.toLowerCase()) {
          return entry;
        }
        const byLabel = PHONE_COUNTRY_CODES.find(
          (e) =>
            e.code === entry.code &&
            e.label.toLowerCase() === labelPart
        );
        if (byLabel) return byLabel;
      }
      return getPhoneCountryEntryByDialCode(entry.code) ?? entry;
    }
  }

  const digits = stripPhoneDigits(trimmed);
  if (!digits) return null;

  for (const entry of sortedEntries) {
    if (digits === stripPhoneDigits(entry.code)) {
      return getPhoneCountryEntryByDialCode(entry.code) ?? entry;
    }
  }

  if (trimmed.startsWith("+") && digits.length >= 1 && digits.length <= 4) {
    return getPhoneCountryEntryByDialCode(`+${digits}`) ?? null;
  }

  return null;
}

/**
 * Resolve a Country Code cell to a +NNN dial code.
 * Accepts "+62", "62", "+62 Indonesia", etc.
 */
export function resolveImportCountryCode(
  raw: string | undefined | null
): string | null {
  return resolveImportCountryEntry(raw)?.code ?? null;
}

/**
 * National digits for import — same helper as PhoneInput (libphonenumber).
 */
export function toNationalDigitsForImport(
  phoneRaw: string,
  countryCode: string,
  countryId?: string | null
): string {
  return normalizeNationalDigitsForInput(countryCode, phoneRaw, countryId);
}

/**
 * Normalize bulk-import phone with a separate country-code column.
 * Shared path with PhoneInput: libphonenumber-js validates and formats E.164
 * (correct trunk-0 rules per country — e.g. ID strips 0, IT keeps 0).
 */
export function normalizeImportPhoneWithCountryCode(
  countryCodeRaw: string | undefined | null,
  phoneRaw: string | undefined | null,
  fieldLabel = "Phone"
): string {
  const phone = (phoneRaw ?? "").trim();
  if (!phone || isPhoneFormatPlaceholder(phone)) return "";

  const entry = resolveImportCountryEntry(countryCodeRaw);
  const countryCode = entry?.code ?? DEFAULT_COUNTRY_CODE;
  const countryId = entry?.id ?? DEFAULT_PHONE_COUNTRY_ID;

  return normalizeAndValidatePhoneForCountry(
    countryCode,
    phone,
    countryId,
    fieldLabel
  );
}

/**
 * Normalize Indonesian phone numbers for bulk import storage (+62…).
 * Backward-compatible wrapper around {@link normalizeImportPhoneWithCountryCode}.
 */
export function normalizeIndonesianPhone(value: string): string {
  return normalizeImportPhoneWithCountryCode(DEFAULT_COUNTRY_CODE, value);
}
