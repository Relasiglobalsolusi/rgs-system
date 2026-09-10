import type { EmploymentType } from "@prisma/client";

import { formatEmployeeName } from "@/lib/employee-user-link";
import type { PayrollRunKind } from "@/lib/internal-payroll-period";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
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

/**
 * Wage cost follows the shift. A shift on a job costs that job, Internal sites
 * included, so an Internal site carries its own wage cost. Only a CICO day with
 * no job at all — standing by — costs Head Office as Standby Wage.
 */
function wageSiteKey(projectId: string | null | undefined): string {
  if (!projectId) return OVERHEAD_WAGE_BUCKET;
  return projectId;
}

/**
 * Internal sites are cost centres, so their wages stay Head Office overhead on
 * the company P&L even though they are attributed to the site.
 */
export async function listInternalWageSiteKeys(
  companyId: string
): Promise<Set<string>> {
  const projects = await prisma.project.findMany({
    where: { companyId, subCategory: "INTERNAL" },
    select: { id: true },
  });
  return new Set(projects.map((project) => project.id));
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

/** One employee's wage cost on one site, frozen into the payroll lock. */
export type WageSiteAllocation = {
  siteKey: string;
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

/** Flatten a live allocation so it can be stored on the lock snapshot. */
export function flattenWageAllocation(
  allocated: Map<string, AllocatedWageEmployee[]>
): WageSiteAllocation[] {
  const rows: WageSiteAllocation[] = [];
  for (const [siteKey, employees] of allocated) {
    for (const employee of employees) {
      rows.push({ siteKey, ...employee });
    }
  }
  return rows;
}

/** Rebuild the site map from a locked snapshot, with no live CICO read. */
export function wageAllocationFromSites(
  rows: WageSiteAllocation[]
): Map<string, AllocatedWageEmployee[]> {
  const bySite = new Map<string, AllocatedWageEmployee[]>();
  for (const row of rows) {
    const list = bySite.get(row.siteKey) ?? [];
    list.push({
      employeeId: row.employeeId,
      employeeNo: row.employeeNo,
      name: row.name,
      employmentType: row.employmentType,
      monthlyBasePay: row.monthlyBasePay,
      dailyRate: row.dailyRate,
      daysWorked: row.daysWorked,
      wageCost: row.wageCost,
      splitNotes: row.splitNotes ?? [],
    });
    bySite.set(row.siteKey, list);
  }
  for (const [siteKey, employees] of bySite) {
    bySite.set(
      siteKey,
      employees.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      )
    );
  }
  return bySite;
}

type AttendanceWageRow = {
  employeeId: string;
  date: Date;
  projectId: string | null;
  checkIn: Date | null;
  checkOut: Date | null;
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
  decisions: WageDayDecision[] = [],
  options?: { maxPaidShifts?: number }
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

  type PendingDay = {
    date: string;
    employee: AttendanceWageRow["employee"];
    doubleProjectId: string | undefined;
    dayRows: AttendanceWageRow[];
    resolved: ReturnType<typeof resolveShiftPay>;
  };
  const pendingByEmployee = new Map<string, PendingDay[]>();

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
    const list = pendingByEmployee.get(employee.id) ?? [];
    list.push({ date, employee, doubleProjectId, dayRows, resolved });
    pendingByEmployee.set(employee.id, list);
  }

  const cap = options?.maxPaidShifts;
  for (const days of pendingByEmployee.values()) {
    days.sort((a, b) => a.date.localeCompare(b.date));
    let paidDays = 0;
    for (const day of days) {
      let wage = day.resolved.wage;
      let daysWorked = day.resolved.daysWorked;
      if (cap != null && daysWorked > 0) {
        const remaining = Math.max(0, cap - paidDays);
        if (remaining <= 0) continue;
        if (daysWorked > remaining) {
          wage = (wage / daysWorked) * remaining;
          daysWorked = remaining;
        }
        paidDays += daysWorked;
      }

      if (day.doubleProjectId) {
        const countedRows = day.dayRows.filter(
          (row) => row.projectId === day.doubleProjectId
        );
        const match =
          countedRows.find((row) => row.projectId === day.doubleProjectId) ??
          countedRows[0] ??
          day.dayRows[0];
        const siteKey = wageSiteKey(day.doubleProjectId ?? match?.projectId);
        const target = siteEmployee(siteKey, day.employee);
        target.daysWorked += daysWorked;
        target.wageCost += wage;
        if (day.resolved.multiplier === 2 && daysWorked === 2) {
          target.splitNotes.push(
            doubleShiftWageNote({
              date: day.date,
              shareAmount: wage,
            })
          );
        }
        continue;
      }

      const siteKeys = [
        ...new Set(day.dayRows.map((row) => wageSiteKey(row.projectId))),
      ];
      const shares = splitDailyRate(wage, siteKeys.length);

      siteKeys.forEach((siteKey, index) => {
        const target = siteEmployee(siteKey, day.employee);
        const share = shares[index] ?? 0;
        if (index === 0) target.daysWorked += daysWorked;
        target.wageCost += share;
        if (siteKeys.length > 1 && share > 0) {
          target.splitNotes.push(
            sameDaySplitNote({
              employeeName: target.name,
              date: day.date,
              siteCount: siteKeys.length,
              shareAmount: share,
            })
          );
        }
      });
    }
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
  /** One run only, so two overlapping windows never pay the same employee twice. */
  run?: PayrollRunKind;
}): Promise<AttendanceWageRow[]> {
  return prisma.attendance.findMany({
    where: {
      employee: {
        companyId: options.companyId,
        employmentType: { not: "PART_TIME" },
        ...(options.run ? { payrollRun: options.run } : {}),
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
  maxPaidShifts?: number;
  /** One run only, so two overlapping windows never pay the same employee twice. */
  run?: PayrollRunKind;
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
        employee: {
          companyId: options.companyId,
          ...(options.run ? { payrollRun: options.run } : {}),
        },
        ...dateFilter,
      },
      select: { employeeId: true, date: true, projectId: true },
    }),
    prisma.internalPayrollDayDecision.findMany({
      where: {
        companyId: options.companyId,
        ...(options.run
          ? { employee: { payrollRun: options.run } }
          : {}),
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
    })),
    options.maxPaidShifts != null
      ? { maxPaidShifts: options.maxPaidShifts }
      : undefined
  );
}

