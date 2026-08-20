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

function isIndonesianLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith("id");
}

function dateFormatLocale(locale: string): string {
  return isIndonesianLocale(locale) ? "id-ID" : DISPLAY_LOCALE;
}

function englishDayOrdinal(day: number): string {
  const teens = day % 100;
  if (teens >= 11 && teens <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/**
 * Long payroll date with weekday.
 * English: "Monday, 15th of July 2026"
 * Indonesian: "Senin, 15 Juli 2026"
 * Asia/Jakarta.
 */
export function formatEnglishOrdinalDate(
  value: Date | string | number,
  locale: string = DISPLAY_LOCALE,
  timeZone: string = "Asia/Jakarta"
): string {
  const date = toDate(value);
  if (!date) return "";
  const intlLocale = dateFormatLocale(locale);
  const parts = new Intl.DateTimeFormat(intlLocale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;
  if (!weekday || !day || !month || !year) return "";
  if (isIndonesianLocale(locale)) {
    return `${weekday}, ${day} ${month} ${year}`;
  }
  return `${weekday}, ${englishDayOrdinal(day)} of ${month} ${year}`;
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

/** Elapsed work time from actual timestamps (handles overnight shifts). */
export function formatWorkDuration(
  checkIn: Date | string | number,
  checkOut: Date | string | number
): string | null {
  const start = toDate(checkIn);
  const end = toDate(checkOut);
  if (!start || !end) return null;

  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60_000);
  if (totalMinutes < 0) return null;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}
