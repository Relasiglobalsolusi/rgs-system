import { DISPLAY_LOCALE, formatEnglishOrdinalDate } from "@/lib/format-date";

/**
 * Two Internal Payroll runs per month, same shape: the window opens on day D of
 * the previous month and closes the day before D of this month.
 *
 * - `PROJECT_CYCLE` — regular project staff, 16th through the 15th.
 * - `HEAD_OFFICE_MONTHLY` — head office, corporate, directors and GC staff,
 *   26th through the 25th, paid on the 25th.
 *
 * Every function here defaults to `PROJECT_CYCLE` so existing callers keep the
 * 16th–15th window they were written against.
 */
export type PayrollRunKind = "PROJECT_CYCLE" | "HEAD_OFFICE_MONTHLY";

export const PAYROLL_RUN_KINDS = [
  "PROJECT_CYCLE",
  "HEAD_OFFICE_MONTHLY",
] as const satisfies readonly PayrollRunKind[];

export const DEFAULT_PAYROLL_RUN: PayrollRunKind = "PROJECT_CYCLE";

/** Day of the previous month each window opens on. */
export const PAYROLL_RUN_START_DAY: Record<PayrollRunKind, number> = {
  PROJECT_CYCLE: 16,
  HEAD_OFFICE_MONTHLY: 26,
};

/**
 * Day of the period month the run may be generated from. Project staff
 * reconcile the day after their window closes; head office is paid on the 25th,
 * the closing day itself.
 */
export const PAYROLL_RUN_PAYABLE_DAY: Record<PayrollRunKind, number> = {
  PROJECT_CYCLE: 16,
  HEAD_OFFICE_MONTHLY: 25,
};

export function isPayrollRunKind(value: unknown): value is PayrollRunKind {
  return (PAYROLL_RUN_KINDS as readonly string[]).includes(String(value));
}

export function parsePayrollRunKind(value: unknown): PayrollRunKind {
  return isPayrollRunKind(value) ? value : DEFAULT_PAYROLL_RUN;
}

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
 * CICO window for the payroll period labeled `year`/`month`: day D of the
 * previous month through the day before D of this month.
 */
export function utcRangeForPayrollPeriod(
  year: number,
  month: number,
  run: PayrollRunKind = DEFAULT_PAYROLL_RUN
): { start: Date; endExclusive: Date } {
  const startDay = PAYROLL_RUN_START_DAY[run];
  const prev = previousPayrollCalendarMonth(year, month);
  return {
    start: new Date(Date.UTC(prev.year, prev.month - 1, startDay)),
    endExclusive: new Date(Date.UTC(year, month - 1, startDay)),
  };
}

/** Payroll period that contains a Jakarta calendar date. */
export function payrollPeriodFromJakartaDate(
  date: Date,
  run: PayrollRunKind = DEFAULT_PAYROLL_RUN
): PayrollPeriod {
  const { year, month, day } = jakartaYearMonthDay(date);
  if (day >= PAYROLL_RUN_START_DAY[run]) {
    if (month === 12) return { year: year + 1, month: 1 };
    return { year, month: month + 1 };
  }
  return { year, month };
}

/** True once Jakarta today has reached the day this run may be generated. */
export function isPayrollPeriodReconciled(
  year: number,
  month: number,
  now: Date = new Date(),
  run: PayrollRunKind = DEFAULT_PAYROLL_RUN
): boolean {
  const today = jakartaYearMonthDay(now);
  if (today.year !== year) return today.year > year;
  if (today.month !== month) return today.month > month;
  return today.day >= PAYROLL_RUN_PAYABLE_DAY[run];
}

export function payrollPeriodsInUtcRange(
  from?: Date,
  toExclusive?: Date,
  run: PayrollRunKind = DEFAULT_PAYROLL_RUN
): PayrollPeriod[] {
  if (!from && !toExclusive) return [];

  const start = from
    ? payrollPeriodFromJakartaDate(from, run)
    : { year: 2000, month: 1 };
  const lastIncluded = toExclusive
    ? new Date(toExclusive.getTime() - 1)
    : null;
  const last = lastIncluded
    ? payrollPeriodFromJakartaDate(lastIncluded, run)
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

export function utcRangeForPayrollYear(
  year: number,
  run: PayrollRunKind = DEFAULT_PAYROLL_RUN
): {
  from: Date;
  toExclusive: Date;
} {
  return {
    from: utcRangeForPayrollPeriod(year, 1, run).start,
    toExclusive: utcRangeForPayrollPeriod(year, 12, run).endExclusive,
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

/** Inclusive UTC date-only bounds, e.g. the 16th previous through the 15th. */
export function payrollPeriodInclusiveDates(
  year: number,
  month: number,
  run: PayrollRunKind = DEFAULT_PAYROLL_RUN
): { start: Date; end: Date } {
  const { start, endExclusive } = utcRangeForPayrollPeriod(year, month, run);
  return {
    start,
    end: new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000),
  };
}

/** Payroll period that contains Jakarta today. */
export function currentPayrollPeriod(
  now: Date = new Date(),
  run: PayrollRunKind = DEFAULT_PAYROLL_RUN
): PayrollPeriod {
  return payrollPeriodFromJakartaDate(now, run);
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
  run?: PayrollRunKind;
}): PayrollPeriod[] {
  const now = options?.now ?? new Date();
  const run = options?.run ?? DEFAULT_PAYROLL_RUN;
  const current = currentPayrollPeriod(now, run);
  const historyMonths = options?.historyMonths ?? 36;
  let year = current.year;
  let month = current.month;
  for (let i = 0; i < historyMonths - 1; i += 1) {
    const prev = previousPayrollCalendarMonth(year, month);
    year = prev.year;
    month = prev.month;
  }

  const periods = payrollPeriodsInUtcRange(
    utcRangeForPayrollPeriod(year, month, run).start,
    utcRangeForPayrollPeriod(current.year, current.month, run).endExclusive,
    run
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
  locale: string = DISPLAY_LOCALE,
  run: PayrollRunKind = DEFAULT_PAYROLL_RUN
): string {
  const { start, end } = payrollPeriodInclusiveDates(year, month, run);
  const connector = locale.toLowerCase().startsWith("id") ? "sampai" : "to";
  return `${formatEnglishOrdinalDate(start, locale)} ${connector} ${formatEnglishOrdinalDate(end, locale)}`;
}

const PAYROLL_FILE_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
] as const;

function payrollFileDayMonth(date: Date, withYear: boolean): string {
  const day = date.getUTCDate();
  const month = PAYROLL_FILE_MONTHS[date.getUTCMonth()];
  if (!withYear) return `${day} ${month}`;
  return `${day} ${month} ${date.getUTCFullYear()}`;
}

/** Short range for downloads, e.g. "16 Aug - 15 Sept 2026". */
export function formatPayrollPeriodShortRange(
  year: number,
  month: number,
  run: PayrollRunKind = DEFAULT_PAYROLL_RUN
): string {
  const { start, end } = payrollPeriodInclusiveDates(year, month, run);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  return `${payrollFileDayMonth(start, !sameYear)} - ${payrollFileDayMonth(end, true)}`;
}

/** Download title, e.g. "Internal Payroll (16 Aug - 15 Sept 2026)". */
export function formatInternalPayrollWorkbookTitle(
  year: number,
  month: number,
  run: PayrollRunKind = DEFAULT_PAYROLL_RUN
): string {
  const label =
    run === "HEAD_OFFICE_MONTHLY" ? "Head Office Payroll" : "Internal Payroll";
  return `${label} (${formatPayrollPeriodShortRange(year, month, run)})`;
}
