import type { PayrollDeductionType } from "@prisma/client";

import { calculateBpjsBreakdown } from "@/lib/employee-bpjs";
import { applyResignIfLastDayReachedMany } from "@/lib/employee-resign";
import { formatEmployeeName } from "@/lib/employee-user-link";
import type { AppLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { inventoryQtyFromDecimal, toDecimal } from "@/lib/inventory";
import type {
  PayrollPdfDeductionLine,
  PayrollPdfEmployee,
} from "@/lib/internal-payroll-pdf";
import {
  HEAD_OFFICE_PAYROLL_PROJECT,
  isPayrollPayableType,
  payrollLineCashOutDelta,
  payrollNetFromParts,
  PROJECT_PAY_RECOVERY_TYPES,
} from "@/lib/payroll-deductions";
import { jakartaWorkDateKey } from "@/lib/shift-pay";
import { formatProjectShiftLabel } from "@/lib/project-shifts";
import {
  buildPayrollEmployeeDays,
  jakartaDateKeysInclusive,
  summarizePeriodPay,
  type PayrollDayRow,
} from "@/lib/internal-payroll-days";
import {
  getInternalPayrollLockRecord,
  snapshotToPayrollRows,
} from "@/lib/internal-payroll-lock";
import {
  payrollPeriodsInUtcRange,
  utcRangeForPayrollPeriod,
} from "@/lib/internal-payroll-period";
import { addUtcDays } from "@/lib/invoice-period";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";

export type PayrollDeductionRow = {
  id: string;
  type: PayrollDeductionType;
  amount: number;
  reason: string | null;
  itemName: string | null;
  quantity: number | null;
  projectId: string | null;
  projectName: string | null;
  inventoryItemId: string | null;
};

export type PayrollCatalogItem = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  currentStock: number;
};

export type PayrollProjectOption = {
  id: string;
  name: string;
  internal: boolean;
};

export async function loadPayrollCatalog(companyId: string): Promise<{
  items: PayrollCatalogItem[];
  projects: PayrollProjectOption[];
}> {
  const [items, projects] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { companyId, active: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        currentStock: true,
      },
      orderBy: [{ name: "asc" }],
      take: 400,
    }),
    prisma.project.findMany({
      where: {
        companyId,
        status: {
          in: ["IN_PROGRESS", "WAITING_FOR_APPROVAL", "ON_HOLD", "COMPLETED"],
        },
      },
      select: { id: true, name: true, subCategory: true },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      currentStock: inventoryQtyFromDecimal(item.currentStock),
    })),
    projects: [
      { id: HEAD_OFFICE_PAYROLL_PROJECT, name: "Head Office", internal: true },
      ...projects.map((project) => ({
        id: project.id,
        name: project.name,
        internal: project.subCategory === "INTERNAL",
      })),
    ],
  };
}

export async function loadPayrollDeductions(
  companyId: string,
  year: number,
  month: number
): Promise<Map<string, PayrollDeductionRow[]>> {
  const rows = await prisma.payrollDeduction.findMany({
    where: { companyId, year, month },
    select: {
      id: true,
      employeeId: true,
      type: true,
      amount: true,
      reason: true,
      itemName: true,
      quantity: true,
      projectId: true,
      inventoryItemId: true,
      project: { select: { name: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const byEmployee = new Map<string, PayrollDeductionRow[]>();
  for (const row of rows) {
    const list = byEmployee.get(row.employeeId) ?? [];
    list.push({
      id: row.id,
      type: row.type,
      amount: decimalToNumber(row.amount) ?? 0,
      reason: row.reason,
      itemName: row.itemName,
      quantity:
        row.quantity != null ? inventoryQtyFromDecimal(row.quantity) : null,
      projectId: row.projectId,
      projectName: row.project?.name ?? null,
      inventoryItemId: row.inventoryItemId,
    });
    byEmployee.set(row.employeeId, list);
  }
  return byEmployee;
}

export function splitPayrollLines(lines: PayrollDeductionRow[]) {
  let manualDeductions = 0;
  let payables = 0;
  for (const line of lines) {
    if (isPayrollPayableType(line.type)) payables += line.amount;
    else manualDeductions += line.amount;
  }
  return { manualDeductions, payables };
}

export function computePayrollNet(options: {
  wage: number;
  bpjsKesehatan: number;
  bpjsTk: number;
  lines: PayrollDeductionRow[];
}) {
  const { manualDeductions, payables } = splitPayrollLines(options.lines);
  return {
    manualDeductions,
    payables,
    netPay: payrollNetFromParts({
      wage: options.wage,
      bpjsKesehatan: options.bpjsKesehatan,
      bpjsTk: options.bpjsTk,
      manualDeductions,
      payables,
    }),
  };
}

export const INTERNAL_PAYROLL_WORKING_DAYS_DIVISOR = 26;

export type InternalPayrollMonthRow = {
  employeeId: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  basePay: number;
  dailyRate: number;
  daysWorked: number;
  wage: number;
  bpjsKesehatan: number;
  bpjsTk: number;
  totalDeduction: number;
  manualDeductions: number;
  payables: number;
  netPay: number;
  depositStatus: "NONE" | "HELD" | "RETURNED" | "KEPT_BY_COMPANY";
  depositHeldAmount: number;
  securityDepositRequired: boolean;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  deductions: PayrollDeductionRow[];
  days: PayrollDayRow[];
};

function deductionTypeLabel(type: PayrollDeductionRow["type"], locale: AppLocale) {
  switch (type) {
    case "SECURITY_DEPOSIT":
      return translate(locale, "pages.payroll.deductionTypes.securityDeposit");
    case "LOST_STOCK":
      return translate(locale, "pages.payroll.deductionTypes.lostStock");
    case "PENALTY":
      return translate(locale, "pages.payroll.deductionTypes.penalty");
    case "OTHER":
      return translate(locale, "pages.payroll.deductionTypes.other");
    case "RETURN_OF_SECURITY_DEPOSIT":
      return translate(locale, "pages.payroll.deductionTypes.returnOfSecurityDeposit");
    case "CLIENT_COMPENSATION":
      return translate(locale, "pages.payroll.deductionTypes.clientCompensation");
    case "FORFEITED_WAGES":
      return translate(locale, "pages.payroll.deductionTypes.forfeitedWages");
    default:
      return type;
  }
}

const FORFEITED_WAGE_REASON =
  "Remaining wage not paid — not according to procedure";

export async function upsertForfeitedRemainingWageLine(options: {
  companyId: string;
  employeeId: string;
  year: number;
  month: number;
  wage: number;
  projectId: string | null;
}): Promise<boolean> {
  const lock = await prisma.internalPayrollLock.findUnique({
    where: {
      companyId_year_month: {
        companyId: options.companyId,
        year: options.year,
        month: options.month,
      },
    },
    select: { locked: true },
  });
  if (lock?.locked) return false;

  const amount = Math.max(0, Math.round(options.wage));
  const existing = await prisma.payrollDeduction.findFirst({
    where: {
      companyId: options.companyId,
      employeeId: options.employeeId,
      year: options.year,
      month: options.month,
      type: "FORFEITED_WAGES",
    },
    select: { id: true, amount: true, projectId: true },
  });

  if (amount <= 0) {
    if (!existing) return false;
    await prisma.payrollDeduction.delete({ where: { id: existing.id } });
    return true;
  }

  if (existing) {
    const current = decimalToNumber(existing.amount) ?? 0;
    if (current === amount && existing.projectId === options.projectId) {
      return false;
    }
    await prisma.payrollDeduction.update({
      where: { id: existing.id },
      data: {
        amount: toDecimal(amount),
        projectId: options.projectId,
        reason: FORFEITED_WAGE_REASON,
      },
    });
    return true;
  }

  await prisma.payrollDeduction.create({
    data: {
      companyId: options.companyId,
      employeeId: options.employeeId,
      year: options.year,
      month: options.month,
      type: "FORFEITED_WAGES",
      amount: toDecimal(amount),
      projectId: options.projectId,
      reason: FORFEITED_WAGE_REASON,
    },
  });
  return true;
}

export async function loadInternalPayrollMonth(options: {
  companyId: string;
  year: number;
  month: number;
  /** When false, ignore a locked snapshot and recompute from live CICO. */
  live?: boolean;
}): Promise<InternalPayrollMonthRow[]> {
  const { companyId, year, month } = options;
  if (!options.live) {
    const lock = await getInternalPayrollLockRecord(companyId, year, month);
    const snapshot = snapshotToPayrollRows<InternalPayrollMonthRow>(
      lock?.snapshot
    );
    if (lock?.locked && snapshot) {
      return snapshot;
    }
  }

  const { start, endExclusive } = utcRangeForPayrollPeriod(year, month);

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      employmentType: { not: "PART_TIME" },
      basePay: { not: null },
      OR: [
        { status: { in: ["ACTIVE", "ON_LEAVE", "LEAVE_PENDING", "RESIGNED"] } },
        {
          attendances: {
            some: {
              date: { gte: start, lt: endExclusive },
              checkIn: { not: null },
              checkOut: { not: null },
            },
          },
        },
        { payrollDeductions: { some: { year, month } } },
      ],
    },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
      basePay: true,
      bpjsKesehatanEnabled: true,
      bpjsKetenagakerjaanEnabled: true,
      jhtEnabled: true,
      jpEnabled: true,
      jkkEnabled: true,
      jkmEnabled: true,
      jkkPercent: true,
      depositStatus: true,
      depositHeldAmount: true,
      securityDepositRequired: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountName: true,
      hiredAt: true,
      lastWorkingDay: true,
      status: true,
      internalHomeSite: true,
      resignForfeitRemainingWages: true,
      depositSourceProjectId: true,
      attendances: {
        where: { date: { gte: start, lt: endExclusive } },
        select: {
          date: true,
          checkIn: true,
          checkOut: true,
          earlyCheckOut: true,
          lateCheckIn: true,
          projectId: true,
          project: { select: { name: true, subCategory: true } },
        },
        orderBy: [{ date: "asc" }, { checkIn: "asc" }],
      },
      cicoExempt: true,
      projectAssignments: {
        select: {
          assignedAt: true,
          project: { select: { name: true, subCategory: true } },
          shift: {
            select: { id: true, number: true, startTime: true, endTime: true },
          },
        },
      },
      leaveRequests: {
        where: {
          status: "APPROVED",
          startDate: { lt: endExclusive },
          endDate: { gte: start },
        },
        select: { startDate: true, endDate: true },
      },
    },
    orderBy: [{ employeeNo: "asc" }],
  });

  await applyResignIfLastDayReachedMany(
    prisma,
    employees.map((employee) => employee.id)
  );

  let deductionsByEmployee = await loadPayrollDeductions(
    companyId,
    year,
    month
  );

  const employeeIds = employees.map((employee) => employee.id);
  const doubleShifts = employeeIds.length
    ? await prisma.doubleShiftAssignment.findMany({
        where: {
          date: { gte: start, lt: endExclusive },
          OR: [
            { employeeId: { in: employeeIds } },
            { coveredEmployeeId: { in: employeeIds } },
          ],
        },
        select: {
          employeeId: true,
          coveredEmployeeId: true,
          date: true,
          projectId: true,
          coveringShift: {
            select: { number: true, startTime: true, endTime: true },
          },
          coveredEmployee: {
            select: { firstName: true, lastName: true },
          },
          employee: {
            select: { firstName: true, lastName: true },
          },
        },
      })
    : [];
  const doubleShiftsByEmployee = new Map<
    string,
    Array<{
      dateKey: string;
      projectId: string;
      coveringShiftLabel?: string | null;
      coveredEmployeeName?: string | null;
    }>
  >();
  const coveredByEmployee = new Map<
    string,
    Array<{
      dateKey: string;
      coveringEmployeeName: string;
      coveringShiftLabel: string;
    }>
  >();
  for (const row of doubleShifts) {
    const dateKey = jakartaWorkDateKey(row.date);
    const coveringShiftLabel = row.coveringShift
      ? formatProjectShiftLabel(row.coveringShift)
      : null;
    const coveredName = row.coveredEmployee
      ? `${row.coveredEmployee.firstName} ${row.coveredEmployee.lastName}`.trim()
      : null;
    const coveringName =
      `${row.employee.firstName} ${row.employee.lastName}`.trim();
    const list = doubleShiftsByEmployee.get(row.employeeId) ?? [];
    list.push({
      dateKey,
      projectId: row.projectId,
      coveringShiftLabel,
      coveredEmployeeName: coveredName,
    });
    doubleShiftsByEmployee.set(row.employeeId, list);
    if (row.coveredEmployeeId && coveringShiftLabel) {
      const coveredList = coveredByEmployee.get(row.coveredEmployeeId) ?? [];
      coveredList.push({
        dateKey,
        coveringEmployeeName: coveringName,
        coveringShiftLabel,
      });
      coveredByEmployee.set(row.coveredEmployeeId, coveredList);
    }
  }

  const backups = employeeIds.length
    ? await prisma.projectAssignment.findMany({
        where: {
          isBackup: true,
          project: { companyId },
          backupStartDate: { not: null, lte: addUtcDays(endExclusive, -1) },
          backupEndDate: { not: null, gte: start },
        },
        select: {
          coveredEmployeeId: true,
          shiftId: true,
          backupStartDate: true,
          backupEndDate: true,
          shift: {
            select: { number: true, startTime: true, endTime: true },
          },
          employee: {
            select: { firstName: true, lastName: true },
          },
        },
      })
    : [];
  const shiftAssignees = new Map<string, string[]>();
  for (const emp of employees) {
    for (const assignment of emp.projectAssignments) {
      const shiftId = assignment.shift?.id;
      if (!shiftId) continue;
      const list = shiftAssignees.get(shiftId) ?? [];
      list.push(emp.id);
      shiftAssignees.set(shiftId, list);
    }
  }
  for (const backup of backups) {
    if (!backup.backupStartDate || !backup.backupEndDate) continue;
    const coveringName =
      `${backup.employee.firstName} ${backup.employee.lastName}`.trim();
    const coveringShiftLabel = backup.shift
      ? formatProjectShiftLabel(backup.shift)
      : "Shift";
    const coveredIds = backup.coveredEmployeeId
      ? [backup.coveredEmployeeId]
      : backup.shiftId
        ? (shiftAssignees.get(backup.shiftId) ?? [])
        : [];
    const dateKeys = jakartaDateKeysInclusive(
      backup.backupStartDate,
      backup.backupEndDate
    );
    for (const coveredId of coveredIds) {
      const coveredList = coveredByEmployee.get(coveredId) ?? [];
      for (const dateKey of dateKeys) {
        if (coveredList.some((row) => row.dateKey === dateKey)) continue;
        coveredList.push({
          dateKey,
          coveringEmployeeName: coveringName,
          coveringShiftLabel,
        });
      }
      coveredByEmployee.set(coveredId, coveredList);
    }
  }

  const dayDecisions = employees.length
    ? await prisma.internalPayrollDayDecision.findMany({
        where: {
          companyId,
          year,
          month,
        },
        select: {
          employeeId: true,
          workDate: true,
          status: true,
          paidAmount: true,
        },
      })
    : [];
  const decisionsByEmployee = new Map<
    string,
    Map<string, { status: "FULL_PAY" | "CUSTOM"; paidAmount: number | null }>
  >();
  for (const row of dayDecisions) {
    let map = decisionsByEmployee.get(row.employeeId);
    if (!map) {
      map = new Map();
      decisionsByEmployee.set(row.employeeId, map);
    }
    map.set(jakartaWorkDateKey(row.workDate), {
      status: row.status,
      paidAmount: decimalToNumber(row.paidAmount),
    });
  }

  const buildRows = (
    deductionMap: Map<string, PayrollDeductionRow[]>
  ): InternalPayrollMonthRow[] =>
    employees.flatMap((emp) => {
      const doubleShiftsForEmployee = doubleShiftsByEmployee.get(emp.id) ?? [];
      const decisions = decisionsByEmployee.get(emp.id) ?? new Map();
      const payableAttendances = emp.attendances
        .filter((row) => row.project?.subCategory !== "PAYROLL_MANAGEMENT")
        .map((row) => ({
          date: row.date,
          checkIn: row.checkIn,
          checkOut: row.checkOut,
          earlyCheckOut: row.earlyCheckOut,
          lateCheckIn: row.lateCheckIn,
          projectId: row.projectId,
          projectName: row.project?.name ?? null,
        }));
      const basePay = decimalToNumber(emp.basePay) ?? 0;
      const dailyRate = Math.round(basePay / INTERNAL_PAYROLL_WORKING_DAYS_DIVISOR);
      const days = buildPayrollEmployeeDays(
        {
          hiredAt: emp.hiredAt,
          lastWorkingDay: emp.lastWorkingDay,
          status: emp.status,
          internalHomeSite: emp.internalHomeSite,
          assignments: emp.projectAssignments.map((row) => ({
            assignedAt: row.assignedAt,
            projectName: row.project.name,
          })),
          leaves: emp.leaveRequests,
          attendances: payableAttendances,
          assignedShiftLabel:
            emp.projectAssignments
              .map((row) =>
                row.shift ? formatProjectShiftLabel(row.shift) : null
              )
              .find(Boolean) ?? null,
          doubleShifts: doubleShiftsForEmployee,
          coveredBy: coveredByEmployee.get(emp.id) ?? [],
          decisions,
          dailyRate,
        },
        year,
        month
      );
      const paid = emp.cicoExempt
        ? {
            daysWorked: INTERNAL_PAYROLL_WORKING_DAYS_DIVISOR,
            wage: basePay,
          }
        : summarizePeriodPay({
            attendances: payableAttendances,
            doubleShifts: doubleShiftsForEmployee,
            decisions,
            dailyRate,
          });
      const daysWorked = paid.daysWorked;
      const wage = paid.wage;
      const forfeitWages = emp.resignForfeitRemainingWages;
      const bpjs = calculateBpjsBreakdown({
        basePay,
        bpjsKesehatanEnabled: emp.bpjsKesehatanEnabled,
        bpjsKetenagakerjaanEnabled: emp.bpjsKetenagakerjaanEnabled,
        jhtEnabled: emp.jhtEnabled,
        jpEnabled: emp.jpEnabled,
        jkkEnabled: emp.jkkEnabled,
        jkmEnabled: emp.jkmEnabled,
        jkkPercent: decimalToNumber(emp.jkkPercent),
      });
      const bpjsKesehatan = forfeitWages
        ? 0
        : bpjs.lines.find((line) => line.key === "kesehatan")?.employeeAmount ??
          0;
      const bpjsTk = forfeitWages
        ? 0
        : bpjs.lines
            .filter((line) => line.key === "jht" || line.key === "jp")
            .reduce((sum, line) => sum + line.employeeAmount, 0);
      const deductions = deductionMap.get(emp.id) ?? [];
      const computed = computePayrollNet({
        wage,
        bpjsKesehatan,
        bpjsTk,
        lines: deductions,
      });

      return [
        {
          employeeId: emp.id,
          employeeNo: emp.employeeNo,
          firstName: emp.firstName,
          lastName: emp.lastName,
          basePay,
          dailyRate,
          daysWorked,
          wage,
          bpjsKesehatan,
          bpjsTk,
          totalDeduction: bpjsKesehatan + bpjsTk + computed.manualDeductions,
          manualDeductions: computed.manualDeductions,
          payables: computed.payables,
          netPay: forfeitWages ? Math.max(0, computed.netPay) : computed.netPay,
          depositStatus: emp.depositStatus,
          depositHeldAmount: decimalToNumber(emp.depositHeldAmount) ?? 0,
          bankName: emp.bankName,
          bankAccountNumber: emp.bankAccountNumber,
          bankAccountName: emp.bankAccountName,
          securityDepositRequired: emp.securityDepositRequired,
          deductions,
          days,
        },
      ];
    });

  let rows = buildRows(deductionsByEmployee);
  const forfeitEmployees = employees.filter(
    (employee) => employee.resignForfeitRemainingWages
  );
  if (forfeitEmployees.length > 0) {
    let changed = false;
    for (const employee of forfeitEmployees) {
      const row = rows.find((item) => item.employeeId === employee.id);
      if (!row) continue;
      const updated = await upsertForfeitedRemainingWageLine({
        companyId,
        employeeId: employee.id,
        year,
        month,
        wage: row.wage,
        projectId: employee.depositSourceProjectId,
      });
      if (updated) changed = true;
    }
    if (changed) {
      deductionsByEmployee = await loadPayrollDeductions(companyId, year, month);
      rows = buildRows(deductionsByEmployee);
    }
  }

  return rows;
}

/** Cash-out delta vs gross Internal Payroll wages (deductions reduce, returns increase). */
export async function sumInternalPayrollNetAdjustment(options: {
  companyId: string;
  from?: Date;
  toExclusive?: Date;
  /** P&L: omit Security deposit withhold (held, not Made This Month). Cash: include. */
  includeSecurityDeposit?: boolean;
}): Promise<number> {
  const periods =
    options.from || options.toExclusive
      ? payrollPeriodsInUtcRange(options.from, options.toExclusive)
      : null;
  if (periods && periods.length === 0) return 0;

  const rows = await prisma.payrollDeduction.findMany({
    where: {
      companyId: options.companyId,
      ...(periods
        ? {
            OR: periods.map((period) => ({
              year: period.year,
              month: period.month,
            })),
          }
        : {}),
    },
    select: { type: true, amount: true },
  });

  return rows.reduce((sum, row) => {
    if (
      options.includeSecurityDeposit === false &&
      row.type === "SECURITY_DEPOSIT"
    ) {
      return sum;
    }
    return (
      sum + payrollLineCashOutDelta(row.type, decimalToNumber(row.amount) ?? 0)
    );
  }, 0);
}

export type SecurityDepositSnapshot = {
  held: number;
  returned: number;
  kept: number;
};

export async function getSecurityDepositSnapshot(
  companyId: string
): Promise<SecurityDepositSnapshot> {
  const [heldRows, keptRows, returnedAgg] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId, depositStatus: "HELD" },
      select: { depositHeldAmount: true },
    }),
    prisma.employee.findMany({
      where: { companyId, depositStatus: "KEPT_BY_COMPANY" },
      select: { depositHeldAmount: true },
    }),
    prisma.payrollDeduction.aggregate({
      where: { companyId, type: "RETURN_OF_SECURITY_DEPOSIT" },
      _sum: { amount: true },
    }),
  ]);

  return {
    held: heldRows.reduce(
      (sum, row) => sum + (decimalToNumber(row.depositHeldAmount) ?? 0),
      0
    ),
    kept: keptRows.reduce(
      (sum, row) => sum + (decimalToNumber(row.depositHeldAmount) ?? 0),
      0
    ),
    returned: decimalToNumber(returnedAgg._sum.amount) ?? 0,
  };
}

/** Head Office income when a deposit is kept (not according to procedure). */
export async function sumKeptDepositIncome(options: {
  companyId: string;
  from?: Date;
  toExclusive?: Date;
}): Promise<number> {
  const employees = await prisma.employee.findMany({
    where: { companyId: options.companyId, depositStatus: "KEPT_BY_COMPANY" },
    select: {
      depositHeldAmount: true,
      lastWorkingDay: true,
      resignedAt: true,
      depositSourceProjectId: true,
    },
  });

  return employees.reduce((sum, row) => {
    if (row.depositSourceProjectId) return sum;
    const when = row.lastWorkingDay ?? row.resignedAt;
    if (options.from || options.toExclusive) {
      if (!when) return sum;
      if (options.from && when.getTime() < options.from.getTime()) return sum;
      if (
        options.toExclusive &&
        when.getTime() >= options.toExclusive.getTime()
      ) {
        return sum;
      }
    }
    return sum + (decimalToNumber(row.depositHeldAmount) ?? 0);
  }, 0);
}

export type LostStockPayRecoveryRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  amount: number;
  itemName: string | null;
  year: number;
  month: number;
};

export async function sumProjectDepositReturns(
  projectId: string,
  companyId: string,
  options?: { year?: number; month?: number | null }
): Promise<number> {
  const agg = await prisma.payrollDeduction.aggregate({
    where: {
      companyId,
      projectId,
      type: "RETURN_OF_SECURITY_DEPOSIT",
      ...(options?.year != null
        ? {
            year: options.year,
            ...(options.month != null ? { month: options.month } : {}),
          }
        : {}),
    },
    _sum: { amount: true },
  });
  return decimalToNumber(agg._sum.amount) ?? 0;
}

export async function listProjectLostStockPayRecovery(
  projectId: string,
  companyId: string
): Promise<LostStockPayRecoveryRow[]> {
  const rows = await prisma.payrollDeduction.findMany({
    where: {
      companyId,
      projectId,
      type: { in: [...PROJECT_PAY_RECOVERY_TYPES] },
    },
    select: {
      id: true,
      employeeId: true,
      amount: true,
      itemName: true,
      year: true,
      month: true,
      employee: { select: { firstName: true, lastName: true, employeeNo: true } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    employeeName: formatEmployeeName(row.employee),
    employeeNo: row.employee.employeeNo,
    amount: decimalToNumber(row.amount) ?? 0,
    itemName: row.itemName,
    year: row.year,
    month: row.month,
  }));
}

export function toPayrollPdfEmployees(
  rows: InternalPayrollMonthRow[],
  locale: AppLocale
): PayrollPdfEmployee[] {
  return rows.map((row) => {
    const deductions: PayrollPdfDeductionLine[] = row.deductions.map((line) => ({
      typeLabel: deductionTypeLabel(line.type, locale),
      amount: line.amount,
      detail: [line.itemName, line.reason, line.projectName]
        .filter(Boolean)
        .join(" · "),
      payable: isPayrollPayableType(line.type),
    }));
    return {
      name: formatEmployeeName(row),
      employeeNo: row.employeeNo,
      bankName: row.bankName,
      bankAccountNumber: row.bankAccountNumber,
      bankAccountName: row.bankAccountName,
      daysWorked: row.daysWorked,
      dailyRate: row.dailyRate,
      wage: row.wage,
      bpjsKesehatan: row.bpjsKesehatan,
      bpjsTk: row.bpjsTk,
      deductions,
      netPay: row.netPay,
    };
  });
}
