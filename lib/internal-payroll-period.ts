import { DISPLAY_LOCALE, formatEnglishOrdinalDate } from "@/lib/format-date";

/** Internal Payroll window: 16th of the previous month through 15th of this month. */

export const PAYROLL_PERIOD_START_DAY = 16;

export type PayrollPeriod = {
  year: number;
  month: number;
};

export type JakartaYearMonthDay = PayrollPeriod & { day: number };

export function jakartaYearMonthDay(
  now: Date = new Date()
): JakartaYearMonthDay {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

export function previousPayrollCalendarMonth(
  year: number,
  month: number
): PayrollPeriod {
  if (month <= 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

/**
 * CICO window for the payroll period labeled `year`/`month`
 * (16th of the previous month through 15th of this month).
 */
export function utcRangeForPayrollPeriod(
  year: number,
  month: number
): { start: Date; endExclusive: Date } {
  const prev = previousPayrollCalendarMonth(year, month);
  return {
    start: new Date(Date.UTC(prev.year, prev.month - 1, PAYROLL_PERIOD_START_DAY)),
    endExclusive: new Date(Date.UTC(year, month - 1, PAYROLL_PERIOD_START_DAY)),
  };
}

/** Payroll period that contains a Jakarta calendar date. */
export function payrollPeriodFromJakartaDate(date: Date): PayrollPeriod {
  const { year, month, day } = jakartaYearMonthDay(date);
  if (day >= PAYROLL_PERIOD_START_DAY) {
    if (month === 12) return { year: year + 1, month: 1 };
    return { year, month: month + 1 };
  }
  return { year, month };
}

/** True once Jakarta today is on or after the 16th of the period month. */
export function isPayrollPeriodReconciled(
  year: number,
  month: number,
  now: Date = new Date()
): boolean {
  const today = jakartaYearMonthDay(now);
  if (today.year !== year) return today.year > year;
  if (today.month !== month) return today.month > month;
  return today.day >= PAYROLL_PERIOD_START_DAY;
}

export function payrollPeriodsInUtcRange(
  from?: Date,
  toExclusive?: Date
): PayrollPeriod[] {
  if (!from && !toExclusive) return [];

  const start = from
    ? payrollPeriodFromJakartaDate(from)
    : { year: 2000, month: 1 };
  const lastIncluded = toExclusive
    ? new Date(toExclusive.getTime() - 1)
    : null;
  const last = lastIncluded
    ? payrollPeriodFromJakartaDate(lastIncluded)
    : { year: 2100, month: 12 };

  const periods: PayrollPeriod[] = [];
  let year = start.year;
  let month = start.month;
  while (year < last.year || (year === last.year && month <= last.month)) {
    periods.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    if (periods.length > 240) break;
  }
  return periods;
}

export function utcRangeForPayrollYear(year: number): {
  from: Date;
  toExclusive: Date;
} {
  return {
    from: utcRangeForPayrollPeriod(year, 1).start,
    toExclusive: utcRangeForPayrollPeriod(year, 12).endExclusive,
  };
}

export function payrollPeriodKey(period: PayrollPeriod): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

export function parsePayrollPeriodKey(value: string): PayrollPeriod | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/** Inclusive UTC date-only bounds: 16th previous month through 15th of this month. */
export function payrollPeriodInclusiveDates(
  year: number,
  month: number
): { start: Date; end: Date } {
  const { start, endExclusive } = utcRangeForPayrollPeriod(year, month);
  return {
    start,
    end: new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000),
  };
}

/** Payroll period that contains Jakarta today. */
export function currentPayrollPeriod(now: Date = new Date()): PayrollPeriod {
  return payrollPeriodFromJakartaDate(now);
}

/**
 * Next wage month for cash-advance / payroll deductions.
 * Take an advance on the 1st or the 24th — both hit this calendar month's pay
 * unless that month is already locked.
 */
export function upcomingWagePayrollPeriod(now: Date = new Date()): PayrollPeriod {
  const { year, month } = jakartaYearMonthDay(now);
  return { year, month };
}

/** Next calendar payroll period after `period`. */
export function nextPayrollPeriod(period: PayrollPeriod): PayrollPeriod {
  if (period.month === 12) return { year: period.year + 1, month: 1 };
  return { year: period.year, month: period.month + 1 };
}

/**
 * History options through the current cycle (newest first).
 * Always includes `selected` when it falls outside the default window.
 */
export function listPayrollPeriodChoices(options?: {
  now?: Date;
  historyMonths?: number;
  selected?: PayrollPeriod;
}): PayrollPeriod[] {
  const now = options?.now ?? new Date();
  const current = currentPayrollPeriod(now);
  const historyMonths = options?.historyMonths ?? 36;
  let year = current.year;
  let month = current.month;
  for (let i = 0; i < historyMonths - 1; i += 1) {
    const prev = previousPayrollCalendarMonth(year, month);
    year = prev.year;
    month = prev.month;
  }

  const periods = payrollPeriodsInUtcRange(
    utcRangeForPayrollPeriod(year, month).start,
    utcRangeForPayrollPeriod(current.year, current.month).endExclusive
  );

  const selected = options?.selected;
  if (
    selected &&
    !periods.some((period) => period.year === selected.year && period.month === selected.month)
  ) {
    periods.push(selected);
    periods.sort((a, b) => a.year - b.year || a.month - b.month);
  }

  return periods.slice().reverse();
}

/** Full-date label, e.g. "Thursday, 16th of July 2026 to Saturday, 15th of August 2026". */
export function formatPayrollPeriodRange(
  year: number,
  month: number,
  locale: string = DISPLAY_LOCALE
): string {
  const { start, end } = payrollPeriodInclusiveDates(year, month);
  const connector = locale.toLowerCase().startsWith("id") ? "sampai" : "to";
  return `${formatEnglishOrdinalDate(start, locale)} ${connector} ${formatEnglishOrdinalDate(end, locale)}`;
}
