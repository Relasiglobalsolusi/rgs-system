import {
  addUtcDays,
  formatDateInput,
  parseDateInput,
} from "@/lib/invoice-period";
import { appMinutesOfDay, parseTimeToMinutes } from "@/lib/operating-hours";
import { formatAppDateInput } from "@/lib/progress-report-compliance";

/**
 * CICO / Progress work-day key (YYYY-MM-DD) in Asia/Jakarta.
 * Overnight early-morning hours belong to the previous calendar day
 * (the day the shift started), so once-in / once-out stays on one record.
 */
export function resolveCicoWorkDayInput(
  shiftStart: string | null | undefined,
  shiftEnd: string | null | undefined,
  now: Date = new Date()
): string {
  const todayInput = formatAppDateInput(now);
  const startMins = parseTimeToMinutes(shiftStart);
  const endMins = parseTimeToMinutes(shiftEnd);
  if (startMins == null || endMins == null) return todayInput;

  const overnight = endMins <= startMins;
  if (!overnight) return todayInput;

  // Still in the post-midnight tail of last night's shift → prior work day.
  if (appMinutesOfDay(now) < endMins) {
    return formatDateInput(addUtcDays(parseDateInput(todayInput), -1));
  }
  return todayInput;
}

/** UTC date-only Date for attendance / Progress Report keys. */
export function resolveCicoWorkDay(
  shiftStart: string | null | undefined,
  shiftEnd: string | null | undefined,
  now: Date = new Date()
): Date {
  return parseDateInput(resolveCicoWorkDayInput(shiftStart, shiftEnd, now));
}
