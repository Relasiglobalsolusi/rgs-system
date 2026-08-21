import type { Prisma } from "@prisma/client";

import { formatEmployeeName } from "@/lib/employee-user-link";
import { addUtcDays, formatDateInput, toUtcDateOnly } from "@/lib/invoice-period";
import { INTERNAL_PAYROLL_WORKING_DAYS_DIVISOR } from "@/lib/internal-payroll-month";
import type { PayrollDayRow } from "@/lib/internal-payroll-days";
import {
  payrollManagementWindowForCutoffMonth,
  utcRangeForClientCutoff,
} from "@/lib/payroll-management";
import type { PayrollManagementReviewEmployee } from "@/lib/payroll-management-types";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import {
  resolveShiftPay,
  sumAttendanceHours,
  type ShiftPayDecision,
} from "@/lib/shift-pay";

export type { PayrollManagementReviewEmployee } from "@/lib/payroll-management-types";

export async function attachPayrollReviewCicoExempt(
  rows: PayrollManagementReviewEmployee[]
): Promise<PayrollManagementReviewEmployee[]> {
  if (rows.length === 0 || rows.every((row) => typeof row.cicoExempt === "boolean")) {
    return rows;
  }
  const employees = await prisma.employee.findMany({
    where: { id: { in: rows.map((row) => row.employeeId) } },
    select: { id: true, cicoExempt: true },
  });
  const flags = new Map(employees.map((employee) => [employee.id, employee.cicoExempt]));
  return rows.map((row) => ({
    ...row,
    cicoExempt: row.cicoExempt ?? flags.get(row.employeeId) ?? false,
  }));
}

function utcDateKey(date: Date): string {
  return formatDateInput(toUtcDateOnly(date));
}

function eachUtcDay(start: Date, endExclusive: Date): Date[] {
  const days: Date[] = [];
  for (let cursor = start; cursor < endExclusive; cursor = addUtcDays(cursor, 1)) {
    days.push(cursor);
  }
  return days;
}

function coversDay(
  start: Date,
  end: Date,
  dayKey: string
): boolean {
  return utcDateKey(start) <= dayKey && utcDateKey(end) >= dayKey;
}

export function isPayrollManagementReview(
  value: Prisma.JsonValue | null | undefined
): value is Prisma.JsonArray {
  return Array.isArray(value);
}

export function snapshotToPayrollManagementReview(
  value: Prisma.JsonValue | null | undefined
): PayrollManagementReviewEmployee[] | null {
  if (!isPayrollManagementReview(value)) return null;
  return value as unknown as PayrollManagementReviewEmployee[];
}

export function reviewToPayrollLines(
  review: PayrollManagementReviewEmployee[]
): Array<{
  employeeName: string;
  amount: number;
  accountNumber: string | null;
  notes: string;
  sortOrder: number;
}> {
  return review.map((row, index) => ({
    employeeName: `${row.employeeName} (${row.employeeNo})`,
    amount: row.wage,
    accountNumber: null,
    notes: `${row.daysWorked} days × ${row.dailyRate}`,
    sortOrder: index,
  }));
}

export function reviewToPayrollPdfEmployees(
  review: PayrollManagementReviewEmployee[],
  lines: Array<{ employeeName: string; amount: number; notes?: string | null }>,
  clientAdjustmentLabel: string
) {
  return review.map((row) => {
    const expectedName = `${row.employeeName} (${row.employeeNo})`;
    const line =
      lines.find((item) => item.employeeName === expectedName) ??
      lines.find((item) => item.employeeName === row.employeeName);
    const netPay = line ? line.amount : row.wage;
    const adjustment = Math.max(0, row.wage - netPay);
    return {
      name: row.employeeName,
      employeeNo: row.employeeNo,
      daysWorked: row.daysWorked,
      dailyRate: row.dailyRate,
      wage: row.wage,
      bpjsKesehatan: 0,
      bpjsTk: 0,
      deductions:
        adjustment > 0
          ? [
              {
                typeLabel: clientAdjustmentLabel,
                amount: adjustment,
                detail: line?.notes ?? null,
              },
            ]
          : [],
      netPay,
    };
  });
}

export async function loadPayrollManagementReview(options: {
  companyId: string;
  projectId: string;
  projectName: string;
  year: number;
  month: number;
  startDay: number;
  endDay: number;
  contractStart?: Date | null;
  contractEnd?: Date | null;
}): Promise<PayrollManagementReviewEmployee[]> {
  const { start, endExclusive } = options.contractStart
    ? payrollManagementWindowForCutoffMonth({
        year: options.year,
        month: options.month,
        cutoffDay: options.endDay,
        contractStart: options.contractStart,
        contractEnd: options.contractEnd,
      })
    : utcRangeForClientCutoff(
        options.year,
        options.month,
        options.startDay,
        options.endDay
      );
  const calendar = eachUtcDay(start, endExclusive);

  const assignments = await prisma.projectAssignment.findMany({
    where: { projectId: options.projectId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNo: true,
          basePay: true,
          hiredAt: true,
          lastWorkingDay: true,
          status: true,
          cicoExempt: true,
          attendances: {
            where: {
              projectId: options.projectId,
              date: { gte: start, lt: endExclusive },
            },
            select: {
              date: true,
              checkIn: true,
              checkOut: true,
              earlyCheckOut: true,
              lateCheckIn: true,
            },
            orderBy: [{ date: "asc" }, { checkIn: "asc" }],
          },
        },
      },
    },
    orderBy: { employee: { employeeNo: "asc" } },
  });

  const employeeIds = assignments.map((row) => row.employee.id);
  const [leaves, doubleShifts, period] = employeeIds.length
    ? await Promise.all([
        prisma.leaveRequest.findMany({
          where: {
            employeeId: { in: employeeIds },
            status: "APPROVED",
            startDate: { lt: endExclusive },
            endDate: { gte: start },
          },
          select: { employeeId: true, startDate: true, endDate: true },
        }),
        prisma.doubleShiftAssignment.findMany({
          where: {
            projectId: options.projectId,
            employeeId: { in: employeeIds },
            date: { gte: start, lt: endExclusive },
          },
          select: {
            employeeId: true,
            date: true,
            coveringShift: {
              select: { number: true, startTime: true, endTime: true },
            },
            coveredEmployee: {
              select: { firstName: true, lastName: true },
            },
          },
        }),
        prisma.payrollManagementPeriod.findUnique({
          where: {
            projectId_year_month: {
              projectId: options.projectId,
              year: options.year,
              month: options.month,
            },
          },
          select: {
            dayDecisions: {
              select: {
                employeeId: true,
                workDate: true,
                status: true,
                paidAmount: true,
              },
            },
          },
        }),
      ])
    : [[], [], null] as const;

  const leavesByEmployee = new Map<string, typeof leaves>();
  for (const leave of leaves) {
    const list = leavesByEmployee.get(leave.employeeId) ?? [];
    list.push(leave);
    leavesByEmployee.set(leave.employeeId, list);
  }

  const doubleByEmployeeDate = new Map<string, (typeof doubleShifts)[number]>();
  for (const row of doubleShifts) {
    doubleByEmployeeDate.set(`${row.employeeId}:${utcDateKey(row.date)}`, row);
  }

  const decisions = new Map<string, ShiftPayDecision>();
  for (const row of period?.dayDecisions ?? []) {
    decisions.set(`${row.employeeId}:${utcDateKey(row.workDate)}`, {
      status: row.status,
      paidAmount: decimalToNumber(row.paidAmount),
    });
  }

  return assignments.map((row) => {
    const employee = row.employee;
    const basePay = decimalToNumber(employee.basePay) ?? 0;
    const dailyRate = Math.round(basePay / INTERNAL_PAYROLL_WORKING_DAYS_DIVISOR);
    const byDate = new Map<string, typeof employee.attendances>();
    for (const session of employee.attendances) {
      const key = utcDateKey(session.date);
      const list = byDate.get(key) ?? [];
      list.push(session);
      byDate.set(key, list);
    }
    const employeeLeaves = leavesByEmployee.get(employee.id) ?? [];

    const days: PayrollDayRow[] = [];
    let daysWorked = 0;
    let wage = 0;
    for (const day of calendar) {
      const dateKey = utcDateKey(day);
      if (employee.hiredAt && utcDateKey(employee.hiredAt) > dateKey) continue;
      if (
        employee.lastWorkingDay &&
        utcDateKey(employee.lastWorkingDay) < dateKey
      ) {
        continue;
      }

      const onLeave = employeeLeaves.some((leave) =>
        coversDay(leave.startDate, leave.endDate, dateKey)
      );
      const sessions = byDate.get(dateKey) ?? [];
      const complete = sessions.filter((s) => s.checkIn && s.checkOut);
      const double = doubleByEmployeeDate.get(`${employee.id}:${dateKey}`);
      const isDoubleShift = Boolean(double);
      const hours = sumAttendanceHours(complete);
      const decision = decisions.get(`${employee.id}:${dateKey}`) ?? null;

      if (onLeave && complete.length === 0) {
        days.push({
          dateKey,
          sessionKey: `${dateKey}-leave`,
          siteName: options.projectName,
          checkInAt: null,
          checkOutAt: null,
          earlyCheckOut: false,
          lateCheckIn: false,
          absent: false,
          onLeave: true,
          complete: false,
          doubleShift: isDoubleShift,
        });
        continue;
      }

      if (complete.length === 0) {
        days.push({
          dateKey,
          sessionKey: `${dateKey}-absent`,
          siteName: options.projectName,
          checkInAt: null,
          checkOutAt: null,
          earlyCheckOut: false,
          lateCheckIn: false,
          absent: true,
          complete: false,
          doubleShift: isDoubleShift,
        });
        continue;
      }

      const resolved = resolveShiftPay({
        hours,
        isDoubleShift,
        dailyRate,
        hasCompleteCico: true,
        decision,
      });
      daysWorked += resolved.daysWorked;
      wage += resolved.wage;

      for (const [index, session] of complete.entries()) {
        const isLead = index === 0;
        days.push({
          dateKey,
          sessionKey: `${dateKey}-${index}`,
          siteName: options.projectName,
          checkInAt: session.checkIn?.toISOString() ?? null,
          checkOutAt: session.checkOut?.toISOString() ?? null,
          earlyCheckOut: session.earlyCheckOut,
          lateCheckIn: session.lateCheckIn,
          absent: false,
          complete: true,
          doubleShift: isDoubleShift,
          tookOverShiftLabel: double
            ? `Shift ${double.coveringShift.number}`
            : null,
          tookOverFromName: double
            ? formatEmployeeName(double.coveredEmployee)
            : null,
          sessionHours: sumAttendanceHours([session]),
          hoursWorked: isLead ? resolved.hours : sumAttendanceHours([session]),
          requiredHours: isLead ? resolved.requiredHours : null,
          needsPayDecision: isLead ? resolved.needsDecision : false,
          payDecision: isLead ? decision?.status ?? null : null,
          payAmount: isLead && resolved.wage > 0 ? resolved.wage : null,
        });
      }
    }

    return {
      employeeId: employee.id,
      employeeName: formatEmployeeName(employee),
      employeeNo: employee.employeeNo,
      daysWorked,
      dailyRate,
      wage,
      days,
      cicoExempt: employee.cicoExempt,
    };
  });
}
