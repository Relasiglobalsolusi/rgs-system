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

export type { PayrollManagementReviewEmployee } from "@/lib/payroll-management-types";

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

    const days: PayrollDayRow[] = [];
    let daysWorked = 0;
    for (const day of calendar) {
      const dateKey = utcDateKey(day);
      if (employee.hiredAt && utcDateKey(employee.hiredAt) > dateKey) continue;
      if (
        employee.lastWorkingDay &&
        utcDateKey(employee.lastWorkingDay) < dateKey
      ) {
        continue;
      }
      const sessions = byDate.get(dateKey) ?? [];
      const complete = sessions.filter((s) => s.checkIn && s.checkOut);
      if (complete.length > 0) {
        daysWorked += 1;
        for (const [index, session] of complete.entries()) {
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
          });
        }
        continue;
      }
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
      });
    }

    return {
      employeeId: employee.id,
      employeeName: formatEmployeeName(employee),
      employeeNo: employee.employeeNo,
      daysWorked,
      dailyRate,
      wage: dailyRate * daysWorked,
      days,
    };
  });
}
