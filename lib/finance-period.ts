import {
  daysInUtcMonth,
  jakartaYearMonth,
  utcRangeForJakartaDate,
  utcRangeForJakartaMonth,
  utcRangeForJakartaYear,
} from "@/lib/vat";

export type FinancePeriod = {
  year: number;
  /** `null` = whole year. */
  month: number | null;
  /** `null` = whole month (or ignored when month is null). */
  day: number | null;
};

const WHOLE_YEAR = "all";

function clampYear(raw: string | undefined, fallback: number): number {
  const year = Number(raw);
  if (!Number.isFinite(year)) return fallback;
  return Math.max(2000, Math.min(2100, year));
}

export function parseFinancePeriod(params: {
  year?: string;
  month?: string;
  day?: string;
}): FinancePeriod {
  const nowYm = jakartaYearMonth();
  const year = clampYear(params.year, nowYm.year);
  const monthRaw = String(params.month ?? "").trim().toLowerCase();
  const month =
    monthRaw === WHOLE_YEAR
      ? null
      : Math.max(1, Math.min(12, Number(params.month) || nowYm.month));
  if (month == null) {
    return { year, month: null, day: null };
  }
  const maxDay = daysInUtcMonth(year, month);
  const parsedDay = Number(params.day);
  const day =
    Number.isFinite(parsedDay) && parsedDay >= 1 && parsedDay <= maxDay
      ? parsedDay
      : null;
  return { year, month, day };
}

export function financePeriodRange(period: FinancePeriod): {
  start: Date;
  endExclusive: Date;
} {
  if (period.month == null) return utcRangeForJakartaYear(period.year);
  if (period.day != null) {
    return utcRangeForJakartaDate(period.year, period.month, period.day);
  }
  return utcRangeForJakartaMonth(period.year, period.month);
}

export function financePeriodSearchParams(
  period: FinancePeriod,
  extra?: Record<string, string | null | undefined>
): URLSearchParams {
  const params = new URLSearchParams({
    year: String(period.year),
  });
  if (period.month == null) {
    params.set("month", WHOLE_YEAR);
  } else {
    params.set("month", String(period.month));
    if (period.day != null) params.set("day", String(period.day));
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return params;
}

export function financePeriodFilenameStamp(period: FinancePeriod): string {
  if (period.month == null) return String(period.year);
  const monthPad = String(period.month).padStart(2, "0");
  if (period.day != null) {
    return `${period.year}-${monthPad}-${String(period.day).padStart(2, "0")}`;
  }
  return `${period.year}-${monthPad}`;
}
