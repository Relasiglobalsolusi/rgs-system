/**
 * Default English locale that formats calendar dates as day–month–year
 * (e.g. "7 July 2026"), not US month–day–year.
 * Pass a BCP 47 tag (e.g. id-ID) when following the app language preference.
 */
export const DISPLAY_LOCALE = "en-GB";

/** Default ERP date display: day + full month name + year. */
export const DISPLAY_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

/** Default ERP date+time display, matching DISPLAY_DATE_OPTIONS. */
export const DISPLAY_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  ...DISPLAY_DATE_OPTIONS,
  hour: "numeric",
  minute: "2-digit",
};

function toDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDisplayDate(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale: string = DISPLAY_LOCALE
): string {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString(locale, {
    ...DISPLAY_DATE_OPTIONS,
    ...options,
  });
}

export function formatDisplayTime(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale: string = DISPLAY_LOCALE
): string {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleTimeString(locale, options);
}

export function formatDisplayDateTime(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale: string = DISPLAY_LOCALE
): string {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleString(locale, {
    ...DISPLAY_DATE_TIME_OPTIONS,
    ...options,
  });
}

/** Header / “today” chip — same day–month–year as the rest of the ERP. */
export function formatHeaderDate(
  value: Date | string | number,
  locale: string = DISPLAY_LOCALE
): string {
  return formatDisplayDate(value, undefined, locale);
}
