import type { Prisma } from "@prisma/client";

import { recordInternalPayrollChange } from "@/lib/internal-payroll-audit";
import { isOwnerAccount, type PermissionUser } from "@/lib/permissions";
import {
  DEFAULT_PAYROLL_RUN,
  nextPayrollPeriod,
  payrollPeriodFromJakartaDate,
  utcRangeForPayrollPeriod,
  type PayrollPeriod,
  type PayrollRunKind,
} from "@/lib/internal-payroll-period";
import {
  allocateCompanyWages,
  flattenWageAllocation,
  INTERNAL_PAYROLL_WORKING_DAYS,
  OVERHEAD_WAGE_BUCKET,
  type WageSiteAllocation,
} from "@/lib/internal-payroll-wages";
import { prisma } from "@/lib/prisma";
import { formatContractPrice } from "@/lib/project-billing";

type InternalPayrollDb = Pick<
  Prisma.TransactionClient,
  "auditLog" | "employee" | "internalPayrollLock"
>;

type HeldSnapshotRow = {
  employeeId?: string;
  bpjsShareHeldBefore?: number;
  bpjsShareHeldAfter?: number;
};

/** Exempt staff take a fixed wage with no CICO rows to allocate. */
type ExemptSnapshotRow = {
  employeeId?: string;
  employeeNo?: string;
  firstName?: string;
  lastName?: string;
  basePay?: number;
  dailyRate?: number;
  daysWorked?: number;
  wage?: number;
  cicoExempt?: boolean;
};

async function applyBpjsHeldFromSnapshot(
  snapshot: unknown,
  field: "bpjsShareHeldBefore" | "bpjsShareHeldAfter",
  db: InternalPayrollDb = prisma
) {
  if (!Array.isArray(snapshot)) return;
  const updates = (snapshot as HeldSnapshotRow[])
    .filter((row) => row?.employeeId && typeof row[field] === "number")
    .map((row) =>
      db.employee.update({
        where: { id: row.employeeId! },
        data: { bpjsShareHeldIdr: row[field] as number },
      })
    );
  if (updates.length > 0) {
    await Promise.all(updates);
  }
}

type PayrollSnapshotEmployee = {
  employeeId?: string;
  employeeNo?: string;
  firstName?: string;
  lastName?: string;
  basePay?: number;
  dailyRate?: number;
  daysWorked?: number;
  coveredShifts?: number;
  surplusShifts?: number;
  doubleShiftDays?: number;
  wage?: number;
  bpjsKesehatan?: number;
  bpjsTk?: number;
  manualDeductions?: number;
  totalDeduction?: number;
  netPay?: number;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  deductions?: unknown;
  days?: unknown;
};

function snapshotEmployeeName(row: PayrollSnapshotEmployee): string {
  const name = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
  return name || row.employeeNo || row.employeeId || "Employee";
}

function snapshotAuditValue(
  row: PayrollSnapshotEmployee
): Prisma.InputJsonObject {
  return {
    employeeId: row.employeeId ?? null,
    employeeNo: row.employeeNo ?? null,
    name: snapshotEmployeeName(row),
    basePay: row.basePay ?? null,
    dailyRate: row.dailyRate ?? null,
    daysWorked: row.daysWorked ?? null,
    coveredShifts: row.coveredShifts ?? null,
    surplusShifts: row.surplusShifts ?? null,
    doubleShiftDays: row.doubleShiftDays ?? null,
    wage: row.wage ?? null,
    bpjsKesehatan: row.bpjsKesehatan ?? null,
    bpjsTk: row.bpjsTk ?? null,
    manualDeductions: row.manualDeductions ?? null,
    totalDeduction: row.totalDeduction ?? null,
    netPay: row.netPay ?? null,
    bankName: row.bankName ?? null,
    bankAccountNumber: row.bankAccountNumber ?? null,
    bankAccountName: row.bankAccountName ?? null,
    deductions:
      row.deductions == null
        ? null
        : (row.deductions as Prisma.InputJsonValue),
    days: row.days == null ? null : (row.days as Prisma.InputJsonValue),
  };
}

const MONEY_SNAPSHOT_FIELDS = [
  ["basePay", "Base Pay"],
  ["dailyRate", "Daily Rate"],
  ["wage", "Wage"],
  ["bpjsKesehatan", "BPJS Kesehatan"],
  ["bpjsTk", "BPJS TK"],
  ["manualDeductions", "Manual Deductions"],
  ["totalDeduction", "Total Deductions"],
  ["netPay", "Net Pay"],
] as const;

const COUNT_SNAPSHOT_FIELDS = [
  ["daysWorked", "Shifts Worked"],
  ["coveredShifts", "Covered Shifts"],
  ["surplusShifts", "Surplus Shifts"],
  ["doubleShiftDays", "Double-Shift Days"],
] as const;

function describeSnapshotChanges(
  before: PayrollSnapshotEmployee,
  after: PayrollSnapshotEmployee
): string[] {
  const changes: string[] = [];
  for (const [key, label] of MONEY_SNAPSHOT_FIELDS) {
    if ((before[key] ?? null) !== (after[key] ?? null)) {
      changes.push(
        `${label} changed from ${formatContractPrice(before[key] ?? 0)} to ${formatContractPrice(after[key] ?? 0)}`
      );
    }
  }
  for (const [key, label] of COUNT_SNAPSHOT_FIELDS) {
    if ((before[key] ?? null) !== (after[key] ?? null)) {
      changes.push(
        `${label} changed from ${before[key] ?? 0} to ${after[key] ?? 0}`
      );
    }
  }
  const bankFields = [
    ["bankName", "Bank"],
    ["bankAccountNumber", "Account Number"],
    ["bankAccountName", "Account Holder"],
  ] as const;
  for (const [key, label] of bankFields) {
    if ((before[key] ?? null) !== (after[key] ?? null)) {
      changes.push(
        `${label} changed from ${before[key] || "blank"} to ${after[key] || "blank"}`
      );
    }
  }
  if (
    JSON.stringify(before.deductions ?? null) !==
    JSON.stringify(after.deductions ?? null)
  ) {
    changes.push("Deduction and payable lines changed");
  }
  if (JSON.stringify(before.days ?? null) !== JSON.stringify(after.days ?? null)) {
    changes.push("Daily attendance and pay detail changed");
  }
  return changes;
}

async function recordSnapshotDifferences(options: {
  db: InternalPayrollDb;
  companyId: string;
  userId: string;
  year: number;
  month: number;
  run: PayrollRunKind;
  before: unknown;
  after: unknown[];
}) {
  if (!Array.isArray(options.before)) return;
  const beforeRows = options.before as PayrollSnapshotEmployee[];
  const afterRows = options.after as PayrollSnapshotEmployee[];
  const beforeByEmployee = new Map(
    beforeRows
      .filter((row) => row.employeeId)
      .map((row) => [row.employeeId as string, row])
  );
  const afterByEmployee = new Map(
    afterRows
      .filter((row) => row.employeeId)
      .map((row) => [row.employeeId as string, row])
  );

  for (const [employeeId, before] of beforeByEmployee) {
    const after = afterByEmployee.get(employeeId);
    if (!after) {
      await recordInternalPayrollChange({
        companyId: options.companyId,
        userId: options.userId,
        year: options.year,
        month: options.month,
        run: options.run,
        action: "PAYROLL_EMPLOYEE_REMOVED",
        description: `${snapshotEmployeeName(before)} was removed from the regenerated payroll.`,
        oldValue: snapshotAuditValue(before),
        db: options.db,
      });
      continue;
    }
    const changes = describeSnapshotChanges(before, after);
    if (changes.length === 0) continue;
    await recordInternalPayrollChange({
      companyId: options.companyId,
      userId: options.userId,
      year: options.year,
      month: options.month,
      run: options.run,
      action: "PAYROLL_EMPLOYEE_CHANGED",
      description: `${snapshotEmployeeName(after)}: ${changes.join("; ")}.`,
      oldValue: snapshotAuditValue(before),
      newValue: snapshotAuditValue(after),
      db: options.db,
    });
  }

  for (const [employeeId, after] of afterByEmployee) {
    if (beforeByEmployee.has(employeeId)) continue;
    await recordInternalPayrollChange({
      companyId: options.companyId,
      userId: options.userId,
      year: options.year,
      month: options.month,
      run: options.run,
      action: "PAYROLL_EMPLOYEE_ADDED",
      description: `${snapshotEmployeeName(after)} was added to the regenerated payroll.`,
      newValue: snapshotAuditValue(after),
      db: options.db,
    });
  }
}

export type InternalPayrollLockState = {
  locked: boolean;
  lockedAt: string | null;
  lockedByName: string | null;
  unlockedAt: string | null;
  unlockedByName: string | null;
  unlockReason: string | null;
};

export type InternalPayrollActor = {
  id: string;
  name: string;
};

function emptyLockState(): InternalPayrollLockState {
  return {
    locked: false,
    lockedAt: null,
    lockedByName: null,
    unlockedAt: null,
    unlockedByName: null,
    unlockReason: null,
  };
}

/** Closest unlocked Internal Payroll month (this calendar month, or the next open one). */
export async function nextOpenWagePayrollPeriod(
  companyId: string,
  now?: Date,
  run: PayrollRunKind = DEFAULT_PAYROLL_RUN
): Promise<PayrollPeriod> {
  let period = payrollPeriodFromJakartaDate(now ?? new Date(), run);
  for (let i = 0; i < 24; i += 1) {
    const row = await prisma.internalPayrollLock.findUnique({
      where: {
        companyId_year_month_run: {
          companyId,
          year: period.year,
          month: period.month,
          run,
        },
      },
      select: { locked: true },
    });
    if (!row?.locked) return period;
    period = nextPayrollPeriod(period);
  }
  return period;
}

function toLockState(row: {
  locked: boolean;
  lockedAt: Date | null;
  lockedByName: string | null;
  unlockedAt: Date | null;
  unlockedByName: string | null;
  unlockReason: string | null;
}): InternalPayrollLockState {
  return {
    locked: row.locked,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    lockedByName: row.lockedByName,
    unlockedAt: row.unlockedAt?.toISOString() ?? null,
    unlockedByName: row.unlockedByName,
    unlockReason: row.unlockReason,
  };
}

export function isInternalPayrollSnapshot(
  value: Prisma.JsonValue | null | undefined
): value is Prisma.JsonArray {
  return Array.isArray(value);
}

export function snapshotToPayrollRows<T>(
  value: Prisma.JsonValue | null | undefined
): T[] | null {
  if (!isInternalPayrollSnapshot(value)) return null;
  return value as unknown as T[];
}

/**
 * Owner only. A locked period is final for everyone else, including Head
 * Office and Directors, and every change after an unlock is recorded.
 */
export function canUnlockInternalPayroll(
  user: PermissionUser & { username?: string | null }
): boolean {
  return isOwnerAccount(user);
}

export async function getInternalPayrollLockState(
  companyId: string,
  year: number,
  month: number,
  run: PayrollRunKind = DEFAULT_PAYROLL_RUN
): Promise<InternalPayrollLockState> {
  const row = await prisma.internalPayrollLock.findUnique({
    where: { companyId_year_month_run: { companyId, year, month, run } },
    select: {
      locked: true,
      lockedAt: true,
      lockedByName: true,
      unlockedAt: true,
      unlockedByName: true,
      unlockReason: true,
    },
  });
  return row ? toLockState(row) : emptyLockState();
}

export async function getInternalPayrollLockRecord(
  companyId: string,
  year: number,
  month: number,
  run: PayrollRunKind = DEFAULT_PAYROLL_RUN
) {
  return prisma.internalPayrollLock.findUnique({
    where: { companyId_year_month_run: { companyId, year, month, run } },
    select: {
      id: true,
      locked: true,
      lockedAt: true,
      lockedByName: true,
      unlockedAt: true,
      unlockedByName: true,
      unlockReason: true,
      snapshot: true,
    },
  });
}

export async function assertInternalPayrollPeriodUnlocked(
  companyId: string,
  year: number,
  month: number,
  lockedMessage: string,
  run: PayrollRunKind = DEFAULT_PAYROLL_RUN
) {
  const row = await prisma.internalPayrollLock.findUnique({
    where: { companyId_year_month_run: { companyId, year, month, run } },
    select: { locked: true },
  });
  if (row?.locked) {
    throw new Error(lockedMessage);
  }
}

/**
 * Wage cost per site for the run being locked. Exempt staff have no CICO, so
 * their fixed wage is booked to Head Office as Standby Wage.
 */
async function wageSitesForLock(options: {
  companyId: string;
  year: number;
  month: number;
  run: PayrollRunKind;
  snapshot: unknown[];
}): Promise<WageSiteAllocation[]> {
  const range = utcRangeForPayrollPeriod(
    options.year,
    options.month,
    options.run
  );
  const allocated = await allocateCompanyWages({
    companyId: options.companyId,
    from: range.start,
    toExclusive: range.endExclusive,
    maxPaidShifts: INTERNAL_PAYROLL_WORKING_DAYS,
    run: options.run,
  });
  const rows = flattenWageAllocation(allocated);
  const allocatedIds = new Set(rows.map((row) => row.employeeId));

  const exemptRows = (options.snapshot as ExemptSnapshotRow[]).filter(
    (row) =>
      row?.cicoExempt === true &&
      typeof row.employeeId === "string" &&
      !allocatedIds.has(row.employeeId) &&
      (row.wage ?? 0) > 0
  );
  if (exemptRows.length === 0) return rows;

  const employees = await prisma.employee.findMany({
    where: { id: { in: exemptRows.map((row) => row.employeeId as string) } },
    select: { id: true, employmentType: true },
  });
  const employmentTypes = new Map(
    employees.map((employee) => [employee.id, employee.employmentType])
  );

  for (const row of exemptRows) {
    rows.push({
      siteKey: OVERHEAD_WAGE_BUCKET,
      employeeId: row.employeeId as string,
      employeeNo: row.employeeNo ?? "",
      name: `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
      employmentType:
        employmentTypes.get(row.employeeId as string) ?? "FULL_TIME",
      monthlyBasePay: row.basePay ?? 0,
      dailyRate: row.dailyRate ?? 0,
      daysWorked: row.daysWorked ?? 0,
      wageCost: row.wage ?? 0,
      splitNotes: [],
    });
  }
  return rows;
}

export async function lockInternalPayrollPeriod(options: {
  companyId: string;
  year: number;
  month: number;
  actor: InternalPayrollActor;
  snapshot: unknown[];
  run?: PayrollRunKind;
}): Promise<InternalPayrollLockState> {
  const now = new Date();
  const run = options.run ?? DEFAULT_PAYROLL_RUN;
  const wageSites = await wageSitesForLock({
    companyId: options.companyId,
    year: options.year,
    month: options.month,
    run,
    snapshot: options.snapshot,
  });
  const row = await prisma.$transaction(async (tx) => {
    const existing = await tx.internalPayrollLock.findUnique({
      where: {
        companyId_year_month_run: {
          companyId: options.companyId,
          year: options.year,
          month: options.month,
          run,
        },
      },
      select: { locked: true, snapshot: true },
    });
    if (existing?.locked) {
      return tx.internalPayrollLock.findUniqueOrThrow({
        where: {
          companyId_year_month_run: {
            companyId: options.companyId,
            year: options.year,
            month: options.month,
            run,
          },
        },
      });
    }

    await recordSnapshotDifferences({
      db: tx,
      companyId: options.companyId,
      userId: options.actor.id,
      year: options.year,
      month: options.month,
      run,
      before: existing?.snapshot,
      after: options.snapshot,
    });

    const locked = await tx.internalPayrollLock.upsert({
      where: {
        companyId_year_month_run: {
          companyId: options.companyId,
          year: options.year,
          month: options.month,
          run,
        },
      },
      update: {
        locked: true,
        lockedAt: now,
        lockedById: options.actor.id,
        lockedByName: options.actor.name,
        snapshot: options.snapshot as unknown as Prisma.InputJsonValue,
        wageSites: wageSites as unknown as Prisma.InputJsonValue,
      },
      create: {
        companyId: options.companyId,
        year: options.year,
        month: options.month,
        run,
        locked: true,
        lockedAt: now,
        lockedById: options.actor.id,
        lockedByName: options.actor.name,
        snapshot: options.snapshot as unknown as Prisma.InputJsonValue,
        wageSites: wageSites as unknown as Prisma.InputJsonValue,
      },
    });
    await applyBpjsHeldFromSnapshot(
      options.snapshot,
      "bpjsShareHeldAfter",
      tx
    );
    await recordInternalPayrollChange({
      companyId: options.companyId,
      userId: options.actor.id,
      year: options.year,
      month: options.month,
      run,
      action: "PAYROLL_LOCKED",
      description: `Period locked by ${options.actor.name}. ${
        (options.snapshot as unknown[]).length
      } employees frozen.`,
      db: tx,
    });
    return locked;
  });
  return toLockState(row);
}

export async function unlockInternalPayrollPeriod(options: {
  companyId: string;
  year: number;
  month: number;
  actor: InternalPayrollActor;
  reason: string;
  run?: PayrollRunKind;
}, db?: InternalPayrollDb): Promise<InternalPayrollLockState> {
  if (!db) {
    return prisma.$transaction((tx) =>
      unlockInternalPayrollPeriod(options, tx)
    );
  }
  const now = new Date();
  const run = options.run ?? DEFAULT_PAYROLL_RUN;
  const existing = await db.internalPayrollLock.findUnique({
    where: {
      companyId_year_month_run: {
        companyId: options.companyId,
        year: options.year,
        month: options.month,
        run,
      },
    },
    select: { snapshot: true },
  });
  await applyBpjsHeldFromSnapshot(
    existing?.snapshot,
    "bpjsShareHeldBefore",
    db
  );
  const row = await db.internalPayrollLock.upsert({
    where: {
      companyId_year_month_run: {
        companyId: options.companyId,
        year: options.year,
        month: options.month,
        run,
      },
    },
    update: {
      locked: false,
      unlockedAt: now,
      unlockedById: options.actor.id,
      unlockedByName: options.actor.name,
      unlockReason: options.reason,
    },
    create: {
      companyId: options.companyId,
      year: options.year,
      month: options.month,
      run,
      locked: false,
      unlockedAt: now,
      unlockedById: options.actor.id,
      unlockedByName: options.actor.name,
      unlockReason: options.reason,
    },
  });
  await recordInternalPayrollChange({
    companyId: options.companyId,
    userId: options.actor.id,
    year: options.year,
    month: options.month,
    run,
    action: "PAYROLL_UNLOCKED",
    description: `Period unlocked by ${options.actor.name}. Reason: ${options.reason}`,
    db,
  });
  return toLockState(row);
}
