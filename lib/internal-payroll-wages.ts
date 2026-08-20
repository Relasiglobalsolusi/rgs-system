import type { EmploymentType, ProjectSubCategory } from "@prisma/client";

import { formatEmployeeName } from "@/lib/employee-user-link";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { isInternalProjectSubCategory } from "@/lib/project-subcategory";
import {
  jakartaWorkDateKey,
  resolveShiftPay,
  shiftPayDecisionKey,
  sumAttendanceHours,
  type ShiftPayDecision,
} from "@/lib/shift-pay";

/** Same daily-rate convention as Finance → Internal Payroll. */
export const INTERNAL_PAYROLL_WORKING_DAYS = 26;

export const OVERHEAD_WAGE_BUCKET = "__overhead__";

export function dailyRateFromMonthlyPay(monthlyPay: number): number {
  const pay = Math.max(0, Number.isFinite(monthlyPay) ? monthlyPay : 0);
  return Math.round(pay / INTERNAL_PAYROLL_WORKING_DAYS);
}

function jakartaDateKey(date: Date): string {
  return jakartaWorkDateKey(date);
}

function wageSiteKey(
  projectId: string | null | undefined,
  subCategory: ProjectSubCategory | string | null | undefined
): string {
  if (!projectId || isInternalProjectSubCategory(subCategory)) {
    return OVERHEAD_WAGE_BUCKET;
  }
  return projectId;
}

function splitDailyRate(dailyRate: number, siteCount: number): number[] {
  if (siteCount <= 0 || dailyRate <= 0) return [];
  if (siteCount === 1) return [dailyRate];
  const base = Math.floor(dailyRate / siteCount);
  const remainder = dailyRate - base * siteCount;
  return Array.from({ length: siteCount }, (_, index) =>
    index === 0 ? base + remainder : base
  );
}

export type WageSplitNote = {
  date: string;
  siteCount: number;
  shareAmount: number;
  note: string;
  kind?: "split" | "doubleShift";
};

export type AllocatedWageEmployee = {
  employeeId: string;
  employeeNo: string;
  name: string;
  employmentType: EmploymentType;
  monthlyBasePay: number;
  dailyRate: number;
  daysWorked: number;
  wageCost: number;
  splitNotes: WageSplitNote[];
};

type AttendanceWageRow = {
  employeeId: string;
  date: Date;
  projectId: string | null;
  checkIn: Date | null;
  checkOut: Date | null;
  project: { subCategory: ProjectSubCategory } | null;
  employee: {
    id: string;
    employeeNo: string;
    firstName: string;
    lastName: string;
    employmentType: EmploymentType;
    basePay: Parameters<typeof decimalToNumber>[0];
  };
};

export type DoubleShiftWageMark = {
  employeeId: string;
  date: Date;
  projectId: string;
};

export type WageDayDecision = {
  employeeId: string;
  date: Date;
  status: ShiftPayDecision["status"];
  paidAmount: number | null;
};

function emptyEmployeeRow(
  employee: AttendanceWageRow["employee"]
): AllocatedWageEmployee {
  const monthlyBasePay = decimalToNumber(employee.basePay) ?? 0;
  return {
    employeeId: employee.id,
    employeeNo: employee.employeeNo,
    name: formatEmployeeName(employee),
    employmentType: employee.employmentType,
    monthlyBasePay,
    dailyRate: dailyRateFromMonthlyPay(monthlyBasePay),
    daysWorked: 0,
    wageCost: 0,
    splitNotes: [],
  };
}

function sameDaySplitNote(options: {
  employeeName: string;
  date: string;
  siteCount: number;
  shareAmount: number;
}): WageSplitNote {
  return {
    date: options.date,
    siteCount: options.siteCount,
    shareAmount: options.shareAmount,
    kind: "split",
    note: `Worked ${options.siteCount} sites today — day's pay split equally.`,
  };
}

function doubleShiftWageNote(options: {
  date: string;
  shareAmount: number;
}): WageSplitNote {
  return {
    date: options.date,
    siteCount: 1,
    shareAmount: options.shareAmount,
    kind: "doubleShift",
    note: "Double shift — two daily rates for this day.",
  };
}

/**
 * Allocate Internal Payroll across sites from CICO hours (9h / 18h)
 * plus Operational Manager Full pay / custom amount decisions.
 * Under-threshold days with no decision contribute Rp 0.
 */
export function allocateAttendanceWages(
  rows: AttendanceWageRow[],
  doubleShifts: DoubleShiftWageMark[] = [],
  decisions: WageDayDecision[] = []
): Map<string, AllocatedWageEmployee[]> {
  const byEmployeeDay = new Map<string, AttendanceWageRow[]>();
  for (const row of rows) {
    const key = `${row.employeeId}:${jakartaDateKey(row.date)}`;
    const list = byEmployeeDay.get(key) ?? [];
    list.push(row);
    byEmployeeDay.set(key, list);
  }

  const doubleShiftByDay = new Map<string, string>();
  for (const mark of doubleShifts) {
    doubleShiftByDay.set(
      `${mark.employeeId}:${jakartaDateKey(mark.date)}`,
      mark.projectId
    );
  }

  const decisionByDay = new Map<string, ShiftPayDecision>();
  for (const row of decisions) {
    decisionByDay.set(shiftPayDecisionKey(row.employeeId, jakartaDateKey(row.date)), {
      status: row.status,
      paidAmount: row.paidAmount,
    });
  }

  const bySite = new Map<string, Map<string, AllocatedWageEmployee>>();

  function siteEmployee(
    siteKey: string,
    employee: AttendanceWageRow["employee"]
  ): AllocatedWageEmployee {
    let employees = bySite.get(siteKey);
    if (!employees) {
      employees = new Map();
      bySite.set(siteKey, employees);
    }
    let current = employees.get(employee.id);
    if (!current) {
      current = emptyEmployeeRow(employee);
      employees.set(employee.id, current);
    }
    return current;
  }

  for (const [dayKey, dayRows] of byEmployeeDay) {
    const date = dayKey.slice(dayKey.indexOf(":") + 1);
    const employee = dayRows[0]?.employee;
    if (!employee) continue;
    const dailyRate = dailyRateFromMonthlyPay(
      decimalToNumber(employee.basePay) ?? 0
    );
    if (dailyRate <= 0) continue;

    const doubleProjectId = doubleShiftByDay.get(`${employee.id}:${date}`);
    const countedRows = doubleProjectId
      ? dayRows.filter((row) => row.projectId === doubleProjectId)
      : dayRows;
    const completeRows = countedRows.filter((row) => row.checkIn && row.checkOut);
    const hours = sumAttendanceHours(completeRows);
    const resolved = resolveShiftPay({
      hours,
      isDoubleShift: Boolean(doubleProjectId),
      dailyRate,
      hasCompleteCico: completeRows.length > 0,
      decision: decisionByDay.get(`${employee.id}:${date}`) ?? null,
    });
    if (resolved.wage <= 0 && resolved.daysWorked <= 0) continue;

    if (doubleProjectId) {
      const match =
        countedRows.find((row) => row.projectId === doubleProjectId) ??
        countedRows[0] ??
        dayRows[0];
      const siteKey = wageSiteKey(
        doubleProjectId,
        match?.project?.subCategory
      );
      const target = siteEmployee(siteKey, employee);
      target.daysWorked += resolved.daysWorked;
      target.wageCost += resolved.wage;
      if (resolved.multiplier === 2 && resolved.daysWorked === 2) {
        target.splitNotes.push(
          doubleShiftWageNote({
            date,
            shareAmount: resolved.wage,
          })
        );
      }
      continue;
    }

    const siteKeys = [
      ...new Set(
        dayRows.map((row) => wageSiteKey(row.projectId, row.project?.subCategory))
      ),
    ];
    const shares = splitDailyRate(resolved.wage, siteKeys.length);

    siteKeys.forEach((siteKey, index) => {
      const target = siteEmployee(siteKey, employee);
      const share = shares[index] ?? 0;
      if (index === 0) target.daysWorked += resolved.daysWorked;
      target.wageCost += share;
      if (siteKeys.length > 1 && share > 0) {
        target.splitNotes.push(
          sameDaySplitNote({
            employeeName: target.name,
            date,
            siteCount: siteKeys.length,
            shareAmount: share,
          })
        );
      }
    });
  }

  const result = new Map<string, AllocatedWageEmployee[]>();
  for (const [siteKey, employees] of bySite) {
    result.set(
      siteKey,
      [...employees.values()].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      )
    );
  }
  return result;
}

export async function loadCompleteAttendances(options: {
  companyId: string;
  from?: Date;
  toExclusive?: Date;
}): Promise<AttendanceWageRow[]> {
  return prisma.attendance.findMany({
    where: {
      employee: {
        companyId: options.companyId,
        employmentType: { not: "PART_TIME" },
      },
      checkIn: { not: null },
      checkOut: { not: null },
      project: { subCategory: { not: "PAYROLL_MANAGEMENT" } },
      ...(options.from || options.toExclusive
        ? {
            date: {
              ...(options.from ? { gte: options.from } : {}),
              ...(options.toExclusive ? { lt: options.toExclusive } : {}),
            },
          }
        : {}),
    },
    select: {
      employeeId: true,
      date: true,
      projectId: true,
      checkIn: true,
      checkOut: true,
      project: { select: { subCategory: true } },
      employee: {
        select: {
          id: true,
          employeeNo: true,
          firstName: true,
          lastName: true,
          employmentType: true,
          basePay: true,
        },
      },
    },
  });
}

export async function allocateCompanyWages(options: {
  companyId: string;
  from?: Date;
  toExclusive?: Date;
}): Promise<Map<string, AllocatedWageEmployee[]>> {
  const dateFilter =
    options.from || options.toExclusive
      ? {
          date: {
            ...(options.from ? { gte: options.from } : {}),
            ...(options.toExclusive ? { lt: options.toExclusive } : {}),
          },
        }
      : {};
  const [rows, doubleShifts, decisions] = await Promise.all([
    loadCompleteAttendances(options),
    prisma.doubleShiftAssignment.findMany({
      where: {
        employee: { companyId: options.companyId },
        ...dateFilter,
      },
      select: { employeeId: true, date: true, projectId: true },
    }),
    prisma.internalPayrollDayDecision.findMany({
      where: {
        companyId: options.companyId,
        ...(options.from || options.toExclusive
          ? {
              workDate: {
                ...(options.from ? { gte: options.from } : {}),
                ...(options.toExclusive ? { lt: options.toExclusive } : {}),
              },
            }
          : {}),
      },
      select: {
        employeeId: true,
        workDate: true,
        status: true,
        paidAmount: true,
      },
    }),
  ]);
  return allocateAttendanceWages(
    rows,
    doubleShifts,
    decisions.map((row) => ({
      employeeId: row.employeeId,
      date: row.workDate,
      status: row.status,
      paidAmount: decimalToNumber(row.paidAmount),
    }))
  );
}

export function wageTotalForSite(
  allocated: Map<string, AllocatedWageEmployee[]>,
  siteKey: string
): number {
  return (allocated.get(siteKey) ?? []).reduce(
    (sum, row) => sum + row.wageCost,
    0
  );
}

