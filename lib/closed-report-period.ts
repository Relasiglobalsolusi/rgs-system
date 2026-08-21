import { parseDateInput } from "@/lib/invoice-period";
import { formatAppDateInput } from "@/lib/progress-report-compliance";
import {
  compareYearMonth,
  type YearMonth,
  toYearMonth,
} from "@/lib/report-period-bounds";

/** YYYY-MM-DD in Asia/Jakarta. */
function jakartaTodayInput(now: Date = new Date()): string {
  return formatAppDateInput(now);
}

/**
 * Last calendar month that has fully ended in Asia/Jakarta.
 * Example: 20 August → July.
 */
export function lastClosedYearMonth(now: Date = new Date()): YearMonth {
  const current = toYearMonth(parseDateInput(formatAppDateInput(now)));
  if (current.month <= 1) {
    return { year: current.year - 1, month: 12 };
  }
  return { year: current.year, month: current.month - 1 };
}

/** True when the calendar month has ended in Asia/Jakarta. */
export function isClosedCalendarMonth(
  year: number,
  month: number,
  now: Date = new Date()
): boolean {
  return compareYearMonth({ year, month }, lastClosedYearMonth(now)) <= 0;
}

/**
 * YYYY-MM-DD — downloadable after that Jakarta calendar day has ended.
 * Today and future dates are still open.
 */
export function isClosedCalendarDay(
  dateInput: string,
  now: Date = new Date()
): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(dateInput) && dateInput < jakartaTodayInput(now)
  );
}

export function yearMonthFromDateInput(dateInput: string): YearMonth | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return null;
  const [year, month] = dateInput.split("-").map(Number);
  if (!year || !month) return null;
  return { year, month };
}
