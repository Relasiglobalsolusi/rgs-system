import {
  ATTENDANCE_HEAD_OFFICE_NAME,
  ATTENDANCE_WAREHOUSE_NAME,
} from "@/lib/attendance-internal-sites";
import { addUtcDays, toUtcDateOnly } from "@/lib/invoice-period";
import { utcRangeForPayrollPeriod } from "@/lib/internal-payroll-period";
import {
  jakartaWorkDateKey,
  resolveShiftPay,
  sumAttendanceHours,
  type ShiftPayDecision,
  type ShiftPayDecisionStatus,
} from "@/lib/shift-pay";

export type PayrollDayRow = {
  dateKey: string;
  sessionKey: string;
  siteName: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  earlyCheckOut: boolean;
  lateCheckIn: boolean;
  absent: boolean;
  complete: boolean;
  /** Assigned double shift that Jakarta work day. */
  doubleShift?: boolean;
  shiftLabel?: string | null;
  tookOverShiftLabel?: string | null;
  tookOverFromName?: string | null;
  shiftTakenOverByName?: string | null;
  sessionHours?: number | null;
  hoursWorked?: number | null;
  requiredHours?: number | null;
  needsPayDecision?: boolean;
  payDecision?: ShiftPayDecisionStatus | null;
  payAmount?: number | null;
};

export type PayrollDayAttendance = {
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  earlyCheckOut: boolean;
  lateCheckIn?: boolean;
  projectId?: string | null;
  projectName: string | null;
};

export type PayrollDayAssignment = {
  assignedAt: Date;
  projectName: string;
};

export type PayrollDayLeave = {
  startDate: Date;
  endDate: Date;
};

export type PayrollDayDecision = ShiftPayDecision;

export type PayrollDayEmployeeContext = {
  hiredAt: Date | null;
  lastWorkingDay: Date | null;
  status: string;
  internalHomeSite: string;
  assignments: PayrollDayAssignment[];
  leaves: PayrollDayLeave[];
  attendances: PayrollDayAttendance[];
  assignedShiftLabel?: string | null;
  doubleShifts?: Array<{
    dateKey: string;
    projectId: string;
    coveringShiftLabel?: string | null;
    coveredEmployeeName?: string | null;
  }>;
  coveredBy?: Array<{
    dateKey: string;
    coveringEmployeeName: string;
    coveringShiftLabel: string;
  }>;
  decisions?: Map<string, PayrollDayDecision>;
  dailyRate?: number;
};

function deskSiteName(internalHomeSite: string): string | null {
  if (internalHomeSite === "HEAD_OFFICE_OPERATIONS") {
    return ATTENDANCE_HEAD_OFFICE_NAME;
  }
  if (internalHomeSite === "WAREHOUSE") return ATTENDANCE_WAREHOUSE_NAME;
  return null;
}

function isWeekendUtc(date: Date): boolean {
  const day = toUtcDateOnly(date).getUTCDay();
  return day === 0 || day === 6;
}

function coversJakartaDay(
  start: Date,
  end: Date,
  dayKey: string
): boolean {
  return jakartaWorkDateKey(start) <= dayKey && jakartaWorkDateKey(end) >= dayKey;
}

export function jakartaDateKeysInclusive(start: Date, end: Date): string[] {
  const keys: string[] = [];
  for (
    let cursor = toUtcDateOnly(start);
    cursor.getTime() <= toUtcDateOnly(end).getTime();
    cursor = addUtcDays(cursor, 1)
  ) {
    keys.push(jakartaWorkDateKey(cursor));
  }
  return keys;
}

function assignmentSiteOnDay(
  assignments: PayrollDayAssignment[],
  dayKey: string
): string | null {
  const active = assignments
    .filter((row) => jakartaWorkDateKey(row.assignedAt) <= dayKey)
    .sort(
      (a, b) =>
        b.assignedAt.getTime() - a.assignedAt.getTime()
    );
  return active[0]?.projectName ?? null;
}

function isEmployedOnDay(
  employee: PayrollDayEmployeeContext,
  dayKey: string
): boolean {
  if (employee.hiredAt && jakartaWorkDateKey(employee.hiredAt) > dayKey) {
    return false;
  }
  if (
    employee.lastWorkingDay &&
    jakartaWorkDateKey(employee.lastWorkingDay) < dayKey
  ) {
    return false;
  }
  if (employee.status === "TERMINATED" || employee.status === "INACTIVE") {
    return false;
  }
  return true;
}

function isOnLeaveOnDay(
  leaves: PayrollDayLeave[],
  dayKey: string
): boolean {
  return leaves.some((leave) =>
    coversJakartaDay(leave.startDate, leave.endDate, dayKey)
  );
}

export function isExpectedPayrollDay(
  employee: PayrollDayEmployeeContext,
  dayKey: string,
  day: Date
): boolean {
  if (!isEmployedOnDay(employee, dayKey)) return false;
  if (isOnLeaveOnDay(employee.leaves, dayKey)) return false;

  const assignedSite = assignmentSiteOnDay(employee.assignments, dayKey);
  const desk = deskSiteName(employee.internalHomeSite);
  if (!assignedSite && !desk) return false;
  if (!assignedSite && desk && isWeekendUtc(day)) return false;
  return true;
}

export function eachUtcDayInPayrollPeriod(
  year: number,
  month: number
): Date[] {
  const { start, endExclusive } = utcRangeForPayrollPeriod(year, month);
  const days: Date[] = [];
  for (let cursor = start; cursor < endExclusive; cursor = addUtcDays(cursor, 1)) {
    days.push(cursor);
  }
  return days;
}

export function attendanceWorkDateKey(date: Date): string {
  return jakartaWorkDateKey(date);
}

function doubleShiftProjectByDate(
  marks: Array<{ dateKey: string; projectId: string }> | undefined
): Map<string, string> {
  const map = new Map<string, string>();
  for (const mark of marks ?? []) {
    map.set(mark.dateKey, mark.projectId);
  }
  return map;
}

function shiftNotesForDay(
  employee: PayrollDayEmployeeContext,
  dateKey: string
): Pick<
  PayrollDayRow,
  | "shiftLabel"
  | "tookOverShiftLabel"
  | "tookOverFromName"
  | "shiftTakenOverByName"
> {
  const cover = employee.doubleShifts?.find((row) => row.dateKey === dateKey);
  const covered = employee.coveredBy?.find((row) => row.dateKey === dateKey);
  return {
    shiftLabel: employee.assignedShiftLabel ?? null,
    tookOverShiftLabel: cover?.coveringShiftLabel ?? null,
    tookOverFromName: cover?.coveredEmployeeName ?? null,
    shiftTakenOverByName: covered?.coveringEmployeeName ?? null,
  };
}

export function dayShiftHours(
  sessions: PayrollDayAttendance[],
  doubleProjectId?: string
): { hours: number; hasCompleteCico: boolean } {
  const counted = doubleProjectId
    ? sessions.filter((row) => row.projectId === doubleProjectId)
    : sessions;
  const complete = counted.filter((row) => row.checkIn && row.checkOut);
  return {
    hours: sumAttendanceHours(complete),
    hasCompleteCico: complete.length > 0,
  };
}

export function summarizePeriodPay(options: {
  attendances: PayrollDayAttendance[];
  doubleShifts?: Array<{ dateKey: string; projectId: string }>;
  decisions?: Map<string, PayrollDayDecision>;
  dailyRate: number;
}): { daysWorked: number; wage: number } {
  const doubleByDate = doubleShiftProjectByDate(options.doubleShifts);
  const byDate = new Map<string, PayrollDayAttendance[]>();
  for (const row of options.attendances) {
    const key = attendanceWorkDateKey(row.date);
    const list = byDate.get(key) ?? [];
    list.push(row);
    byDate.set(key, list);
  }

  let daysWorked = 0;
  let wage = 0;
  for (const [dateKey, sessions] of byDate) {
    const doubleProjectId = doubleByDate.get(dateKey);
    const counted = dayShiftHours(sessions, doubleProjectId);
    const resolved = resolveShiftPay({
      hours: counted.hours,
      isDoubleShift: Boolean(doubleProjectId),
      dailyRate: options.dailyRate,
      hasCompleteCico: counted.hasCompleteCico,
      decision: options.decisions?.get(dateKey) ?? null,
    });
    daysWorked += resolved.daysWorked;
    wage += resolved.wage;
  }
  return { daysWorked, wage };
}

function sessionKey(
  dateKey: string,
  attendance: PayrollDayAttendance,
  index: number
): string {
  return [
    dateKey,
    attendance.projectName ?? "",
    attendance.checkIn?.toISOString() ?? String(index),
  ].join(":");
}

/** Chronological CICO / Absent rows for one employee in a 16th–15th window. */
export function buildPayrollEmployeeDays(
  employee: PayrollDayEmployeeContext,
  year: number,
  month: number,
  now: Date = new Date()
): PayrollDayRow[] {
  const todayKey = jakartaWorkDateKey(now);
  const doubleByDate = doubleShiftProjectByDate(employee.doubleShifts);
  const dailyRate = employee.dailyRate ?? 0;
  const byDate = new Map<string, PayrollDayAttendance[]>();
  for (const row of employee.attendances) {
    const key = attendanceWorkDateKey(row.date);
    const list = byDate.get(key) ?? [];
    list.push(row);
    byDate.set(key, list);
  }

  const rows: PayrollDayRow[] = [];
  for (const day of eachUtcDayInPayrollPeriod(year, month)) {
    const dateKey = jakartaWorkDateKey(day);
    if (dateKey > todayKey) continue;

    const sessions = (byDate.get(dateKey) ?? []).slice().sort((a, b) => {
      const aTime = a.checkIn?.getTime() ?? 0;
      const bTime = b.checkIn?.getTime() ?? 0;
      return aTime - bTime;
    });
    const expected = isExpectedPayrollDay(employee, dateKey, day);
    if (sessions.length === 0 && !expected) continue;

    if (sessions.length === 0) {
      rows.push({
        dateKey,
        sessionKey: `${dateKey}:absent`,
        siteName:
          assignmentSiteOnDay(employee.assignments, dateKey) ??
          deskSiteName(employee.internalHomeSite),
        checkInAt: null,
        checkOutAt: null,
        earlyCheckOut: false,
        lateCheckIn: false,
        absent: true,
        complete: false,
        doubleShift: doubleByDate.has(dateKey),
        ...shiftNotesForDay(employee, dateKey),
        sessionHours: null,
        hoursWorked: null,
        requiredHours: null,
      });
      continue;
    }

    const doubleProjectId = doubleByDate.get(dateKey);
    const counted = dayShiftHours(sessions, doubleProjectId);
    const decision = employee.decisions?.get(dateKey) ?? null;
    const resolved = resolveShiftPay({
      hours: counted.hours,
      isDoubleShift: Boolean(doubleProjectId),
      dailyRate,
      hasCompleteCico: counted.hasCompleteCico,
      decision,
    });

    sessions.forEach((attendance, index) => {
      const complete = Boolean(attendance.checkIn && attendance.checkOut);
      const isLead = index === 0;
      rows.push({
        dateKey,
        sessionKey: sessionKey(dateKey, attendance, index),
        siteName:
          attendance.projectName ??
          assignmentSiteOnDay(employee.assignments, dateKey) ??
          deskSiteName(employee.internalHomeSite),
        checkInAt: attendance.checkIn?.toISOString() ?? null,
        checkOutAt: attendance.checkOut?.toISOString() ?? null,
        earlyCheckOut: attendance.earlyCheckOut === true,
        lateCheckIn: attendance.lateCheckIn === true,
        absent: false,
        complete,
        doubleShift: Boolean(doubleProjectId),
        ...shiftNotesForDay(employee, dateKey),
        sessionHours: attendanceHoursOrNull(attendance),
        hoursWorked: isLead ? resolved.hours : attendanceHoursOrNull(attendance),
        requiredHours: isLead ? resolved.requiredHours : null,
        needsPayDecision: isLead ? resolved.needsDecision : false,
        payDecision: isLead ? decision?.status ?? null : null,
        payAmount: isLead && resolved.wage > 0 ? resolved.wage : null,
      });
    });
  }
  return rows;
}

function attendanceHoursOrNull(attendance: PayrollDayAttendance): number | null {
  if (!attendance.checkIn || !attendance.checkOut) return null;
  return sumAttendanceHours([attendance]);
}
