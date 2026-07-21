import {
  isValidPhoneNumber as isValidPhoneNumberWithMeta,
  parsePhoneNumberFromString as parsePhoneNumberFromStringWithMeta,
  type CountryCode,
  type PhoneNumber,
} from "libphonenumber-js/core";
import metadata from "libphonenumber-js/metadata.max.json";

import {
  PHONE_COUNTRY_CODE_ENTRIES,
  type PhoneCountryEntry,
} from "@/lib/phone-country-codes";

/** Full Google libphonenumber metadata — country trunk / leading-0 rules live here. */
function parsePhoneNumberFromString(
  text: string,
  defaultCountry?: CountryCode | { defaultCountry?: CountryCode }
): PhoneNumber | undefined {
  return defaultCountry
    ? parsePhoneNumberFromStringWithMeta(text, defaultCountry, metadata)
    : parsePhoneNumberFromStringWithMeta(text, metadata);
}

function isValidPhoneNumber(
  text: string,
  defaultCountry?: CountryCode
): boolean {
  return defaultCountry
    ? isValidPhoneNumberWithMeta(text, defaultCountry, metadata)
    : isValidPhoneNumberWithMeta(text, metadata);
}

export type { PhoneCountryEntry };

export function stripPhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Preferred territory when several share one dial code (parse / restore). */
const PREFERRED_COUNTRY_ID_BY_CODE: Record<string, string> = {
  "+1": "US",
  "+7": "RU",
  "+44": "GB",
  "+61": "AU",
  "+39": "IT",
  "+47": "NO",
  "+212": "MA",
  "+262": "RE",
  "+590": "GP",
};

function comparePhoneCountryLabel(a: PhoneCountryEntry, b: PhoneCountryEntry) {
  return a.label.localeCompare(b.label, "en", { sensitivity: "base" });
}

/**
 * Indonesia (+62) pinned first; all other countries/territories A–Z by name.
 * Single source of truth for PhoneInput and Excel Country Code dropdowns.
 */
export const PHONE_COUNTRY_CODES: PhoneCountryEntry[] = (() => {
  const indonesia = PHONE_COUNTRY_CODE_ENTRIES.find((e) => e.id === "ID");
  const rest = PHONE_COUNTRY_CODE_ENTRIES.filter((e) => e.id !== "ID").sort(
    comparePhoneCountryLabel
  );
  return indonesia ? [indonesia, ...rest] : rest;
})();

/** E.164 dial code string, e.g. "+62". */
export type PhoneCountryCode = string;

export const DEFAULT_COUNTRY_CODE: PhoneCountryCode = "+62";
export const DEFAULT_PHONE_COUNTRY_ID = "ID";

/** Unique dial codes, longest first — for parsing international prefixes. */
const DIAL_CODES_LONGEST_FIRST: string[] = (() => {
  const unique = [...new Set(PHONE_COUNTRY_CODES.map((e) => e.code))];
  return unique.sort(
    (a, b) => stripPhoneDigits(b).length - stripPhoneDigits(a).length
  );
})();

/**
 * Excel Lists / import dropdown label: "+62 Indonesia".
 * PhoneInput renders dial code + name in a fixed-width flex row instead.
 */
export function formatPhoneCountryDropdownLabel(
  entry: PhoneCountryEntry
): string {
  return `${entry.code} ${entry.label}`;
}

/**
 * Country Code list values for Excel Lists sheet and import dropdowns.
 * Order: Indonesia first, then alphabetical by country name.
 */
export function phoneCountryCodeDropdownValues(): string[] {
  return PHONE_COUNTRY_CODES.map(formatPhoneCountryDropdownLabel);
}

export function getPhoneCountryEntryById(
  id: string | null | undefined
): PhoneCountryEntry | undefined {
  if (!id) return undefined;
  return PHONE_COUNTRY_CODES.find((entry) => entry.id === id);
}

/** Resolve a dial code to a list entry (preferred territory when shared). */
export function getPhoneCountryEntryByDialCode(
  code: string | null | undefined
): PhoneCountryEntry | undefined {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return undefined;
  const preferredId = PREFERRED_COUNTRY_ID_BY_CODE[trimmed];
  if (preferredId) {
    const preferred = getPhoneCountryEntryById(preferredId);
    if (preferred && preferred.code === trimmed) return preferred;
  }
  return PHONE_COUNTRY_CODES.find((entry) => entry.code === trimmed);
}

function toLibCountry(id: string | null | undefined): CountryCode | undefined {
  if (!id) return undefined;
  return id as CountryCode;
}

function resolveCountryId(
  countryCode: string,
  countryId?: string | null
): string {
  if (countryId && getPhoneCountryEntryById(countryId)) return countryId;
  return (
    getPhoneCountryEntryByDialCode(countryCode)?.id ?? DEFAULT_PHONE_COUNTRY_ID
  );
}

/**
 * Soft UX only: strip a pasted dial code (+CC / CC) from the national field.
 *
 * Trunk / leading-0 handling is NOT done here. libphonenumber-js owns that:
 * most countries strip a national trunk 0 in E.164 (e.g. ID 0818… → +62818…),
 * while Italy keeps 0 in the national significant number (+39 06…).
 */
export function softStripPastedCountryCode(
  countryCode: string,
  rawDigits: string
): string {
  let digits = stripPhoneDigits(rawDigits);
  if (!digits) return "";

  const ccDigits = stripPhoneDigits(countryCode);
  if (
    ccDigits &&
    digits.startsWith(ccDigits) &&
    digits.length > ccDigits.length
  ) {
    digits = digits.slice(ccDigits.length);
  }
  return digits;
}

function tryParseWithCountry(
  raw: string,
  countryId: string,
  countryCode: string
): PhoneNumber | undefined {
  const country = toLibCountry(countryId);
  const soft = softStripPastedCountryCode(countryCode, raw);
  if (!soft && !raw.trim()) return undefined;

  const candidates = [
    raw.trim(),
    soft,
    soft ? `${countryCode}${soft}` : "",
    soft ? `+${stripPhoneDigits(countryCode)}${soft}` : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const parsed = country
      ? parsePhoneNumberFromString(candidate, country)
      : parsePhoneNumberFromString(candidate);
    if (parsed) return parsed;
  }
  return undefined;
}

/**
 * Parse using libphonenumber metadata for the selected ISO country.
 * Returns E.164 when the number is valid or possible for that country.
 */
export function parsePhoneWithCountry(
  raw: string,
  countryCode: string,
  countryId?: string | null
): PhoneNumber | undefined {
  const id = resolveCountryId(countryCode, countryId);
  return tryParseWithCountry(raw, id, countryCode);
}

export function isValidPhoneForCountry(
  raw: string,
  countryCode: string,
  countryId?: string | null
): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const parsed = parsePhoneWithCountry(trimmed, countryCode, countryId);
  return Boolean(parsed?.isValid());
}

/**
 * National digits for PhoneInput / import display.
 * Soft-strips pasted +CC/CC; when libphonenumber can parse, uses its
 * nationalNumber (correct trunk rules per country).
 *
 * Examples (via library): ID `0818…` → `818…`; IT `06…` stays `06…`.
 */
export function normalizeNationalDigitsForInput(
  countryCode: string,
  rawDigits: string,
  countryId?: string | null
): string {
  const soft = softStripPastedCountryCode(countryCode, rawDigits);
  if (!soft) return "";

  const parsed = parsePhoneWithCountry(soft, countryCode, countryId);
  if (parsed && (parsed.isValid() || parsed.isPossible())) {
    return parsed.nationalNumber;
  }
  return soft;
}

/** First group of 3 digits, then groups of 4 (e.g. 812 3456 7890 1). */
export function formatNationalDigits(digits: string): string {
  const cleaned = stripPhoneDigits(digits);
  if (!cleaned) return "";

  const groups: string[] = [cleaned.slice(0, 3)];
  for (let i = 3; i < cleaned.length; i += 4) {
    groups.push(cleaned.slice(i, i + 4));
  }
  return groups.filter((group) => group.length > 0).join(" ");
}

/**
 * Company / landline national format: 2-digit area code, then groups of 4
 * (e.g. 21 1234 5678 for Jakarta).
 */
export function formatLandlineDigits(digits: string): string {
  const cleaned = stripPhoneDigits(digits);
  if (!cleaned) return "";

  const groups: string[] = [cleaned.slice(0, 2)];
  for (let i = 2; i < cleaned.length; i += 4) {
    groups.push(cleaned.slice(i, i + 4));
  }
  return groups.filter((group) => group.length > 0).join(" ");
}

export type PhoneFormatVariant = "mobile" | "landline";

export function formatPhoneDigitsByVariant(
  digits: string,
  variant: PhoneFormatVariant = "mobile"
): string {
  return variant === "landline"
    ? formatLandlineDigits(digits)
    : formatNationalDigits(digits);
}

export function formatPhoneDisplay(
  countryCode: string,
  localDigits: string,
  countryId?: string | null
): string {
  const parsed = parsePhoneWithCountry(localDigits, countryCode, countryId);
  if (parsed && (parsed.isValid() || parsed.isPossible())) {
    return parsed.formatInternational();
  }
  const digits = normalizeNationalDigitsForInput(
    countryCode,
    localDigits,
    countryId
  );
  if (!digits) return "";
  return `${countryCode} ${formatNationalDigits(digits)}`;
}

export function formatPhoneForDisplay(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  const parsed = parsePhoneNumberFromString(trimmed);
  if (parsed) return parsed.formatInternational();
  const fallback = parsePhoneValue(trimmed);
  return formatPhoneDisplay(
    fallback.countryCode,
    fallback.localDigits,
    fallback.countryId
  );
}

/**
 * Normalize to E.164 for storage using libphonenumber when the number is
 * valid/possible; otherwise a soft draft (`+{cc}{digits}`) for in-progress typing.
 */
export function normalizePhoneForStorage(
  countryCode: string,
  localDigits: string,
  countryId?: string | null
): string {
  const soft = softStripPastedCountryCode(countryCode, localDigits);
  if (!soft) return "";

  const parsed = parsePhoneWithCountry(soft, countryCode, countryId);
  if (parsed && (parsed.isValid() || parsed.isPossible())) {
    return parsed.format("E.164");
  }
  return `${countryCode}${soft}`;
}

/**
 * Best-effort normalize to E.164 (no throw). Empty → "".
 * Prefer {@link normalizeAndValidatePhone} for Add panels / import.
 */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const direct = parsePhoneNumberFromString(trimmed);
  if (direct && (direct.isValid() || direct.isPossible())) {
    return direct.format("E.164");
  }

  const parsed = parsePhoneValue(trimmed);
  return normalizePhoneForStorage(
    parsed.countryCode,
    parsed.localDigits,
    parsed.countryId
  );
}

/**
 * Normalize and accept only numbers libphonenumber considers valid for the
 * inferred/selected country. Empty input → "" (optional fields).
 */
export function normalizeAndValidatePhone(
  value: string,
  fieldLabel = "Phone"
): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const direct = parsePhoneNumberFromString(trimmed);
  if (direct?.isValid()) {
    return direct.format("E.164");
  }

  const parts = parsePhoneValue(trimmed);
  const parsed = parsePhoneWithCountry(
    parts.localDigits || trimmed,
    parts.countryCode,
    parts.countryId
  );
  if (parsed?.isValid()) {
    return parsed.format("E.164");
  }

  if (isValidPhoneNumber(trimmed)) {
    const again = parsePhoneNumberFromString(trimmed);
    if (again?.isValid()) return again.format("E.164");
  }

  throw new Error(`${fieldLabel} is invalid.`);
}

/**
 * Same as {@link normalizeAndValidatePhone} with explicit country (Excel / PhoneInput).
 */
export function normalizeAndValidatePhoneForCountry(
  countryCode: string,
  localOrFull: string,
  countryId?: string | null,
  fieldLabel = "Phone"
): string {
  const trimmed = localOrFull.trim();
  if (!trimmed) return "";

  const parsed = parsePhoneWithCountry(trimmed, countryCode, countryId);
  if (parsed?.isValid()) {
    return parsed.format("E.164");
  }

  throw new Error(`${fieldLabel} is invalid.`);
}

export function parsePhoneValue(value: string | null | undefined): {
  countryCode: PhoneCountryCode;
  localDigits: string;
  countryId: string;
} {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return {
      countryCode: DEFAULT_COUNTRY_CODE,
      localDigits: "",
      countryId: DEFAULT_PHONE_COUNTRY_ID,
    };
  }

  const libParsed = parsePhoneNumberFromString(trimmed);
  if (libParsed?.countryCallingCode) {
    const countryCode = `+${libParsed.countryCallingCode}`;
    const countryId =
      libParsed.country ??
      getPhoneCountryEntryByDialCode(countryCode)?.id ??
      DEFAULT_PHONE_COUNTRY_ID;
    return {
      countryCode,
      localDigits: libParsed.nationalNumber,
      countryId,
    };
  }

  const allDigits = stripPhoneDigits(trimmed);

  for (const code of DIAL_CODES_LONGEST_FIRST) {
    const codeDigits = stripPhoneDigits(code);
    if (
      allDigits.startsWith(codeDigits) &&
      allDigits.length > codeDigits.length
    ) {
      const entry = getPhoneCountryEntryByDialCode(code);
      const countryId = entry?.id ?? DEFAULT_PHONE_COUNTRY_ID;
      return {
        countryCode: code,
        localDigits: normalizeNationalDigitsForInput(
          code,
          allDigits.slice(codeDigits.length),
          countryId
        ),
        countryId,
      };
    }
  }

  return {
    countryCode: DEFAULT_COUNTRY_CODE,
    localDigits: normalizeNationalDigitsForInput(
      DEFAULT_COUNTRY_CODE,
      allDigits,
      DEFAULT_PHONE_COUNTRY_ID
    ),
    countryId: DEFAULT_PHONE_COUNTRY_ID,
  };
}

export function getCursorPositionAfterFormat(
  formatted: string,
  digitsBeforeCursor: number
): number {
  if (digitsBeforeCursor <= 0) return 0;

  let digitCount = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== " ") {
      digitCount++;
    }
    if (digitCount >= digitsBeforeCursor) {
      return i + 1;
    }
  }

  return formatted.length;
}
