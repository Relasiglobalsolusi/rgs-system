/** HH:mm local time helpers for staff assignment shifts. */

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeHHmm(value: string | null | undefined): boolean {
  if (!value) return false;
  return TIME_RE.test(value.trim());
}

export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value || !isValidTimeHHmm(value)) return null;
  const [h, m] = value.trim().split(":").map(Number);
  return h * 60 + m;
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
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
  return minutesOfDay(checkIn) >= expected;
}

export type ProjectShiftInput = {
  projectId: string;
  shiftStart: string | null;
  shiftEnd: string | null;
};

/** Parse per-project `shiftStart_<id>` / `shiftEnd_<id>` fields from employee forms. */
export function parseProjectShiftsFromForm(
  formData: FormData,
  projectIds: string[]
): ProjectShiftInput[] {
  return projectIds.map((projectId) => {
    const start =
      String(formData.get(`shiftStart_${projectId}`) ?? "").trim() || null;
    const end =
      String(formData.get(`shiftEnd_${projectId}`) ?? "").trim() || null;

    if ((start && !end) || (!start && end)) {
      throw new Error("Each assigned site needs both shift start and end times.");
    }
    if (start && (!isValidTimeHHmm(start) || !isValidTimeHHmm(end!))) {
      throw new Error("Shift times must use HH:mm format (e.g. 05:30).");
    }

    return { projectId, shiftStart: start, shiftEnd: end };
  });
}
