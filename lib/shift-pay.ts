/** One assigned shift is 9 hours. Double shift is 18 hours on that project. */

export const COMPLETE_SHIFT_HOURS = 9;
export const DOUBLE_SHIFT_HOURS = 18;

export type ShiftPayDecisionStatus = "FULL_PAY" | "CUSTOM";

export type ShiftPayDecision = {
  status: ShiftPayDecisionStatus;
  paidAmount: number | null;
};

export type ResolvedShiftPay = {
  hours: number;
  requiredHours: number;
  multiplier: 1 | 2;
  metHours: boolean;
  needsDecision: boolean;
  daysWorked: number;
  wage: number;
};

export function jakartaWorkDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function attendanceHours(
  checkIn: Date | null | undefined,
  checkOut: Date | null | undefined
): number | null {
  if (!checkIn || !checkOut) return null;
  const ms = checkOut.getTime() - checkIn.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round((ms / 3_600_000) * 100) / 100;
}

export function sumAttendanceHours(
  rows: Array<{
    checkIn: Date | null | undefined;
    checkOut: Date | null | undefined;
  }>
): number {
  return rows.reduce((sum, row) => sum + (attendanceHours(row.checkIn, row.checkOut) ?? 0), 0);
}

export function formatHoursWorked(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

export function hoursMeetShift(hours: number, requiredHours: number): boolean {
  return hours + 1e-9 >= requiredHours;
}

export function resolveShiftPay(options: {
  hours: number;
  isDoubleShift: boolean;
  dailyRate: number;
  hasCompleteCico: boolean;
  decision?: ShiftPayDecision | null;
}): ResolvedShiftPay {
  const requiredHours = options.isDoubleShift
    ? DOUBLE_SHIFT_HOURS
    : COMPLETE_SHIFT_HOURS;
  const multiplier: 1 | 2 = options.isDoubleShift ? 2 : 1;
  const dailyRate = Math.max(0, Math.round(options.dailyRate) || 0);
  const hours = Math.max(0, options.hours);
  const metHours =
    options.hasCompleteCico && hoursMeetShift(hours, requiredHours);

  if (metHours) {
    return {
      hours,
      requiredHours,
      multiplier,
      metHours: true,
      needsDecision: false,
      daysWorked: multiplier,
      wage: dailyRate * multiplier,
    };
  }

  if (options.decision?.status === "FULL_PAY") {
    return {
      hours,
      requiredHours,
      multiplier,
      metHours: false,
      needsDecision: false,
      daysWorked: multiplier,
      wage: dailyRate * multiplier,
    };
  }

  if (
    options.decision?.status === "CUSTOM" &&
    options.decision.paidAmount != null &&
    Number.isFinite(options.decision.paidAmount)
  ) {
    return {
      hours,
      requiredHours,
      multiplier,
      metHours: false,
      needsDecision: false,
      daysWorked: 0,
      wage: Math.max(0, Math.round(options.decision.paidAmount)),
    };
  }

  return {
    hours,
    requiredHours,
    multiplier,
    metHours: false,
    needsDecision: options.hasCompleteCico,
    daysWorked: 0,
    wage: 0,
  };
}

export function shiftPayDecisionKey(employeeId: string, dateKey: string): string {
  return `${employeeId}:${dateKey}`;
}
