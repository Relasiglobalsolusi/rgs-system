/** HH:mm local time helpers for staff assignment shifts. */

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** ERP business timezone for shift wall-clock comparisons. */
const APP_TIMEZONE = "Asia/Jakarta";

export function isValidTimeHHmm(value: string | null | undefined): boolean {
  if (!value) return false;
  return TIME_RE.test(value.trim());
}

export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value || !isValidTimeHHmm(value)) return null;
  const [h, m] = value.trim().split(":").map(Number);
  return h * 60 + m;
}

/**
 * Minutes since local midnight in Asia/Jakarta for `instant`.
 * Used for late check-in notes and overnight shift windows.
 */
export function appMinutesOfDay(
  instant: Date,
  timeZone: string = APP_TIMEZONE
): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? NaN);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? NaN);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 0;
  }
  return ((hour % 24) * 60 + minute) % (24 * 60);
}

export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  if (!start || !end) return "—";
  return `${start} – ${end}`;
}

export type ShiftLike = {
  shiftStart: string | null;
  shiftEnd: string | null;
};

/** Expected clock-in time from the assignment shift only (never blocks CICO). */
export function resolveExpectedShiftStart(
  assignment: ShiftLike | null | undefined
): string | null {
  if (assignment?.shiftStart && isValidTimeHHmm(assignment.shiftStart)) {
    return assignment.shiftStart.trim();
  }
  return null;
}

/**
 * Returns true when check-in is at or after the expected start (late).
 * Returns null when no expected start is configured.
 * Does not block CICO — used for notes / attendance reporting only.
 */
export function isLateCheckIn(
  checkIn: Date,
  expectedStartHHmm: string | null | undefined
): boolean | null {
  const expected = parseTimeToMinutes(expectedStartHHmm);
  if (expected == null) return null;
  return appMinutesOfDay(checkIn) >= expected;
}

/**
 * True when check-out is before shift end (overnight-aware).
 * No grace — matches office early leave (before 17:00).
 * Returns null when no shift end is configured.
 */
export function isEarlyCheckOut(
  checkOut: Date,
  shiftStartHHmm: string | null | undefined,
  shiftEndHHmm: string | null | undefined
): boolean | null {
  const end = parseTimeToMinutes(shiftEndHHmm);
  if (end == null) return null;
  const start = parseTimeToMinutes(shiftStartHHmm);
  const minutes = appMinutesOfDay(checkOut);
  const overnight = start != null && end <= start;
  if (!overnight) {
    return minutes < end;
  }
  // Overnight: evening hours after start are still on shift; morning before end is early.
  if (minutes >= start) return false;
  return minutes < end;
}
