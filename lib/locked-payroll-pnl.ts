import {
  FINANCIAL_REPORT_ALL_BANKS,
  parseFinancialReportBankScope,
} from "@/lib/financial-report-query";
import {
  PAYROLL_RUN_PAYABLE_DAY,
  utcRangeForPayrollPeriod,
  type PayrollRunKind,
} from "@/lib/internal-payroll-period";
import {
  allocateCompanyWages,
  INTERNAL_PAYROLL_WORKING_DAYS,
  wageAllocationFromSites,
  type AllocatedWageEmployee,
  type WageSiteAllocation,
} from "@/lib/internal-payroll-wages";
import { prisma } from "@/lib/prisma";

function payrollPayableUtcDate(
  year: number,
  month: number,
  run: PayrollRunKind
): Date {
  return new Date(Date.UTC(year, month - 1, PAYROLL_RUN_PAYABLE_DAY[run]));
}

function inUtcRange(date: Date, from?: Date, toExclusive?: Date) {
  if (from && date.getTime() < from.getTime()) return false;
  if (toExclusive && date.getTime() >= toExclusive.getTime()) return false;
  return true;
}

function mergeAllocated(
  into: Map<string, AllocatedWageEmployee[]>,
  from: Map<string, AllocatedWageEmployee[]>
) {
  for (const [siteKey, rows] of from) {
    const current = into.get(siteKey) ?? [];
    const byId = new Map(
      current.map((row) => [
        row.employeeId,
        { ...row, splitNotes: [...row.splitNotes] },
      ])
    );
    for (const row of rows) {
      const existing = byId.get(row.employeeId);
      if (!existing) {
        byId.set(row.employeeId, { ...row, splitNotes: [...row.splitNotes] });
        continue;
      }
      existing.daysWorked += row.daysWorked;
      existing.wageCost += row.wageCost;
      existing.splitNotes.push(...row.splitNotes);
    }
    into.set(
      siteKey,
      [...byId.values()].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      )
    );
  }
}

export type LockedPayrollRun = { year: number; month: number; run: PayrollRunKind };

/**
 * Locked runs whose payable date — the day the money leaves — sits inside the
 * report range. Nothing books before Generate and lock.
 */
export async function listLockedPayrollRunsInRange(options: {
  companyId: string;
  from?: Date;
  toExclusive?: Date;
}): Promise<LockedPayrollRun[]> {
  const locks = await prisma.internalPayrollLock.findMany({
    where: { companyId: options.companyId, locked: true },
    select: { year: true, month: true, run: true },
  });
  return locks.filter((lock) =>
    inUtcRange(
      payrollPayableUtcDate(lock.year, lock.month, lock.run),
      options.from,
      options.toExclusive
    )
  );
}

/**
 * P&L wages only after a run is generated and locked, booked in the month
 * the money leaves. A single-bank view omits payroll (it is not tagged to a bank).
 * The split per site is the one frozen at lock time, so later CICO edits cannot
 * move a locked run, and each run only ever covers its own employees.
 */
export async function allocateLockedCompanyWages(options: {
  companyId: string;
  from?: Date;
  toExclusive?: Date;
  bank?: string;
}): Promise<Map<string, AllocatedWageEmployee[]>> {
  const empty = new Map<string, AllocatedWageEmployee[]>();
  const scope = parseFinancialReportBankScope(
    options.bank ?? FINANCIAL_REPORT_ALL_BANKS
  );
  if (scope.kind !== "all") return empty;

  const locks = await prisma.internalPayrollLock.findMany({
    where: { companyId: options.companyId, locked: true },
    select: { year: true, month: true, run: true, wageSites: true },
  });
  const matching = locks.filter((lock) =>
    inUtcRange(
      payrollPayableUtcDate(lock.year, lock.month, lock.run),
      options.from,
      options.toExclusive
    )
  );
  if (matching.length === 0) return empty;

  const merged = new Map<string, AllocatedWageEmployee[]>();
  for (const lock of matching) {
    const frozen = Array.isArray(lock.wageSites)
      ? (lock.wageSites as unknown as WageSiteAllocation[])
      : null;
    if (frozen) {
      mergeAllocated(merged, wageAllocationFromSites(frozen));
      continue;
    }
    // Runs locked before the split was frozen: rebuild that run's own window.
    const range = utcRangeForPayrollPeriod(lock.year, lock.month, lock.run);
    const allocated = await allocateCompanyWages({
      companyId: options.companyId,
      from: range.start,
      toExclusive: range.endExclusive,
      maxPaidShifts: INTERNAL_PAYROLL_WORKING_DAYS,
      run: lock.run,
    });
    mergeAllocated(merged, allocated);
  }
  return merged;
}
