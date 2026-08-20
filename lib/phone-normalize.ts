/**
 * Excel / form grey-cell hints treated as blank when reading phone fields.
 * Inventory templates still hit these when a cell carries leftover placeholder text.
 */

export const COUNTRY_CODE_PLACEHOLDER = "+62 Indonesia";

const COUNTRY_CODE_PLACEHOLDER_ALIASES = [
  COUNTRY_CODE_PLACEHOLDER,
  "+62",
] as const;

export const PHONE_FORMAT_PLACEHOLDER = "Please exclude country code";
export const PHONE_FORMAT_PLACEHOLDER_ID = "Jangan sertakan kode negara";

const PHONE_FORMAT_PLACEHOLDERS = [
  PHONE_FORMAT_PLACEHOLDER,
  PHONE_FORMAT_PLACEHOLDER_ID,
  "812 XXXX XXXX",
  "21 XXXX XXXX",
  "+62 XXXXXXXXXX",
  "+62 21 XXXXXX",
  "+62 81234567890",
  "+62 XXX XXXXXXXX",
] as const;

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
