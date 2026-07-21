import { formatDisplayDate } from "@/lib/format-date";
import {
  DEFAULT_LOCALE,
  getLocale,
  localeToBcp47,
  type AppLocale,
} from "@/lib/i18n/locale";

type TenureParts = {
  years: number;
  months: number;
  days: number;
};

function toStartOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

/**
 * Calendar-accurate years / months / days from `start` to `end` (inclusive of
 * whole calendar units only — remaining days are exact day count).
 */
export function getCalendarTenure(
  start: Date,
  end: Date = new Date()
): TenureParts {
  const from = toStartOfLocalDay(start);
  const to = toStartOfLocalDay(end);

  if (to < from) {
    return { years: 0, months: 0, days: 0 };
  }

  let years = to.getFullYear() - from.getFullYear();
  let cursor = new Date(from);
  cursor.setFullYear(cursor.getFullYear() + years);
  if (cursor > to) {
    years -= 1;
    cursor = new Date(from);
    cursor.setFullYear(cursor.getFullYear() + years);
  }

  let months =
    (to.getFullYear() - cursor.getFullYear()) * 12 +
    (to.getMonth() - cursor.getMonth());
  cursor.setMonth(cursor.getMonth() + months);
  if (cursor > to) {
    months -= 1;
    cursor = new Date(from);
    cursor.setFullYear(cursor.getFullYear() + years);
    cursor.setMonth(cursor.getMonth() + months);
  }

  const days = Math.round(
    (to.getTime() - cursor.getTime()) / (24 * 60 * 60 * 1000)
  );

  return { years, months, days };
}

function unitLabel(
  value: number,
  unit: "year" | "month" | "day",
  locale: AppLocale
): string {
  if (locale === "id") {
    const idLabels = { year: "tahun", month: "bulan", day: "hari" } as const;
    return `${value} ${idLabels[unit]}`;
  }

  const plural = value === 1 ? unit : `${unit}s`;
  return `${value} ${plural}`;
}

/**
 * Join units with commas (no "and" / "dan"):
 * "A", "A, B", "A, B, C".
 */
function joinTenureParts(parts: string[]): string {
  return parts.join(", ");
}

function resolveLocale(locale?: AppLocale): AppLocale {
  return locale ?? getLocale() ?? DEFAULT_LOCALE;
}

export function formatTenure(
  hiredAt: Date | string | null | undefined,
  referenceDate: Date = new Date(),
  locale?: AppLocale
): string {
  if (!hiredAt) {
    return "";
  }

  const start = hiredAt instanceof Date ? hiredAt : new Date(hiredAt);
  if (Number.isNaN(start.getTime())) {
    return "";
  }

  const { years, months, days } = getCalendarTenure(start, referenceDate);
  const lang = resolveLocale(locale);
  const parts: string[] = [];

  if (years > 0) {
    parts.push(unitLabel(years, "year", lang));
  }
  if (months > 0) {
    parts.push(unitLabel(months, "month", lang));
  }
  if (days > 0 || parts.length === 0) {
    parts.push(unitLabel(days, "day", lang));
  }

  return joinTenureParts(parts);
}

export function formatHiredAtLabel(
  hiredAt: Date | string | null | undefined,
  locale?: AppLocale
): string {
  if (!hiredAt) {
    return "";
  }

  return formatDisplayDate(
    hiredAt,
    undefined,
    localeToBcp47(resolveLocale(locale))
  );
}

export function formatDateForInput(
  value: Date | string | null | undefined
): string {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
