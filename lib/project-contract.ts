import { formatAppDateInput } from "@/lib/progress-report-compliance";

/** Regular Cleaning projects are treated as ongoing site contracts. */
export const CONTRACT_SUBCATEGORY = "REGULAR_CLEANING" as const;

export const DEFAULT_CONTRACT_DURATION_MONTHS = 12;

export const CONTRACT_DURATION_PRESETS = [6, 12, 24, 36] as const;

/** General / Facade cleaning job duration (days). */
export const MIN_PROJECT_DURATION_DAYS = 1;
export const MAX_PROJECT_DURATION_DAYS = 365;
export const DEFAULT_PROJECT_DURATION_DAYS = 7;

/** Dropdown values 1–365 (numbers only; UI shows a separate “days” unit label). */
export const PROJECT_DURATION_DAY_OPTIONS: readonly number[] = Array.from(
  { length: MAX_PROJECT_DURATION_DAYS - MIN_PROJECT_DURATION_DAYS + 1 },
  (_, index) => MIN_PROJECT_DURATION_DAYS + index
);

export function clampProjectDurationDays(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PROJECT_DURATION_DAYS;
  const days = Math.floor(value);
  if (days < MIN_PROJECT_DURATION_DAYS) return MIN_PROJECT_DURATION_DAYS;
  if (days > MAX_PROJECT_DURATION_DAYS) return MAX_PROJECT_DURATION_DAYS;
  return days;
}

export function isContractSubCategory(
  value: string | null | undefined
): boolean {
  return value === CONTRACT_SUBCATEGORY;
}

/** Today's calendar date (YYYY-MM-DD) in Asia/Jakarta. */
export function todayDateInput(instant: Date = new Date()): string {
  return formatAppDateInput(instant);
}

/** Format a date for `<input type="date">` (YYYY-MM-DD, Asia/Jakarta). */
export function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  if (typeof date === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "";
    return formatAppDateInput(parsed);
  }
  if (Number.isNaN(date.getTime())) return "";
  return formatAppDateInput(date);
}

/** Add whole months to a YYYY-MM-DD date string. */
export function addMonthsToDateInput(
  startDate: string,
  months: number
): string {
  if (!startDate || !Number.isFinite(months) || months < 1) return "";
  const parts = startDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return "";

  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  const originalDay = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + months);

  // Clamp end-of-month overflow (e.g. Jan 31 + 1 month → Feb 28/29).
  if (date.getUTCDate() < originalDay) {
    date.setUTCDate(0);
  }

  return date.toISOString().split("T")[0];
}

/** Add whole days to a YYYY-MM-DD date string. */
export function addDaysToDateInput(startDate: string, days: number): string {
  if (!startDate || !Number.isFinite(days) || days < 1) return "";
  const parts = startDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return "";

  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

/** Best-effort month count between two dates for edit form defaults. */
export function monthsBetweenDates(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): number {
  if (!start || !end) return DEFAULT_CONTRACT_DURATION_MONTHS;
  const startDate = typeof start === "string" ? new Date(start) : start;
  const endDate = typeof end === "string" ? new Date(end) : end;
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return DEFAULT_CONTRACT_DURATION_MONTHS;
  }

  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());

  if (months < 1) return DEFAULT_CONTRACT_DURATION_MONTHS;
  return months;
}

/**
 * Whole calendar days from start → end (same convention as `addDaysToDateInput`:
 * Jan 1 → Jan 8 = 7 days). Returns null when either side is missing/invalid.
 */
export function daysBetweenDates(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): number | null {
  const startInput = toDateInputValue(start);
  const endInput = toDateInputValue(end);
  if (!startInput || !endInput) return null;

  const startParts = startInput.split("-").map(Number);
  const endParts = endInput.split("-").map(Number);
  if (
    startParts.length !== 3 ||
    endParts.length !== 3 ||
    startParts.some((n) => Number.isNaN(n)) ||
    endParts.some((n) => Number.isNaN(n))
  ) {
    return null;
  }

  const startUtc = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);
  const endUtc = Date.UTC(endParts[0], endParts[1] - 1, endParts[2]);
  const diff = Math.round((endUtc - startUtc) / 86_400_000);
  if (diff < 0) return null;
  return diff;
}

/** Best-effort day count between two dates for General/Facade edit defaults. */
export function daysBetweenDatesOrDefault(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
  fallback: number = DEFAULT_PROJECT_DURATION_DAYS
): number {
  const days = daysBetweenDates(start, end);
  if (days == null) return clampProjectDurationDays(fallback);
  return clampProjectDurationDays(days);
}
