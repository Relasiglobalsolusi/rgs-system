import { calculateBpjsBreakdown } from "@/lib/employee-bpjs";
import { getEmployeeCompanyBalance } from "@/lib/employee-company-balance";
import {
  loadInternalPayrollMonth,
  type InternalPayrollMonthRow,
} from "@/lib/internal-payroll-month";
import {
  getInternalPayrollLockRecord,
  snapshotToPayrollRows,
} from "@/lib/internal-payroll-lock";
import {
  currentPayrollPeriod,
  listPayrollPeriodChoices,
  payrollPeriodFromJakartaDate,
  previousPayrollCalendarMonth,
  type PayrollPeriod,
} from "@/lib/internal-payroll-period";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";

export type EmployeePayslipMonthSummary = {
  year: number;
  month: number;
  netPay: number | null;
  daysWorked: number | null;
  locked: boolean;
  preview: boolean;
};

export function payslipStatusKey(row: {
  netPay: number | null;
  preview: boolean;
}): "noPayslip" | "preview" | "issued" {
  if (row.netPay == null) return "noPayslip";
  if (row.preview) return "preview";
  return "issued";
}

export type EmployeePayslipMonthDetail = {
  row: InternalPayrollMonthRow | null;
  locked: boolean;
  preview: boolean;
  earnings: number;
  deductions: number;
  bpjsEmployee: number;
  bpjsCompany: number;
  balanceDueToCompany: number;
};

function periodKey(period: PayrollPeriod) {
  return `${period.year}-${period.month}`;
}

function rowFromSnapshot(
  snapshot: unknown,
  employeeId: string
): InternalPayrollMonthRow | null {
  const rows = snapshotToPayrollRows<InternalPayrollMonthRow>(
    snapshot as Parameters<typeof snapshotToPayrollRows>[0]
  );
  return rows?.find((row) => row.employeeId === employeeId) ?? null;
}

function periodsFromHire(
  hiredAt: Date | null | undefined,
  current: PayrollPeriod
): PayrollPeriod[] {
  const start = hiredAt
    ? payrollPeriodFromJakartaDate(hiredAt)
    : (() => {
        let year = current.year;
        let month = current.month;
        for (let i = 0; i < 11; i += 1) {
          const prev = previousPayrollCalendarMonth(year, month);
          year = prev.year;
          month = prev.month;
        }
        return { year, month };
      })();

  const all = listPayrollPeriodChoices({
    historyMonths: 36,
    selected: start,
  }).slice();
  all.reverse();
  return all.filter((period) => {
    if (period.year > start.year) return true;
    if (period.year < start.year) return false;
    return period.month >= start.month;
  });
}

export async function loadEmployeePayslipHistory(options: {
  companyId: string;
  employeeId: string;
  hiredAt?: Date | null;
}): Promise<EmployeePayslipMonthSummary[]> {
  const current = currentPayrollPeriod();
  const periods = periodsFromHire(options.hiredAt, current);
  if (periods.length === 0) return [];

  const locks = await prisma.internalPayrollLock.findMany({
    where: {
      companyId: options.companyId,
      OR: periods.map((period) => ({
        year: period.year,
        month: period.month,
      })),
    },
    select: {
      year: true,
      month: true,
      locked: true,
      snapshot: true,
    },
  });
  const lockMap = new Map(
    locks.map((row) => [periodKey(row), row] as const)
  );

  const summaries: EmployeePayslipMonthSummary[] = [];
  const toCompute: PayrollPeriod[] = [];

  for (const period of periods) {
    const lock = lockMap.get(periodKey(period));
    const snapshotRow = rowFromSnapshot(lock?.snapshot, options.employeeId);
    if (lock?.locked && snapshotRow) {
      summaries.push({
        year: period.year,
        month: period.month,
        netPay: snapshotRow.netPay,
        daysWorked: snapshotRow.daysWorked,
        locked: true,
        preview: false,
      });
    } else {
      toCompute.push(period);
    }
  }

  const recentToCompute = toCompute.slice(-6);
  const computed = await Promise.all(
    recentToCompute.map(async (period) => {
      const rows = await loadInternalPayrollMonth({
        companyId: options.companyId,
        year: period.year,
        month: period.month,
        employeeId: options.employeeId,
      });
      return { period, row: rows[0] ?? null };
    })
  );
  const computedMap = new Map(
    computed.map((item) => [periodKey(item.period), item.row] as const)
  );

  for (const period of toCompute) {
    const lock = lockMap.get(periodKey(period));
    const snapshotRow = rowFromSnapshot(lock?.snapshot, options.employeeId);
    const row = computedMap.get(periodKey(period)) ?? snapshotRow;
    summaries.push({
      year: period.year,
      month: period.month,
      netPay: row?.netPay ?? null,
      daysWorked: row?.daysWorked ?? null,
      locked: lock?.locked === true,
      preview: lock?.locked !== true,
    });
  }

  return summaries.sort((a, b) => a.year - b.year || a.month - b.month);
}

export async function loadEmployeePayslipMonth(options: {
  companyId: string;
  employeeId: string;
  year: number;
  month: number;
}): Promise<EmployeePayslipMonthDetail> {
  const [lock, rows, employee, balance] = await Promise.all([
    getInternalPayrollLockRecord(
      options.companyId,
      options.year,
      options.month
    ),
    loadInternalPayrollMonth({
      companyId: options.companyId,
      year: options.year,
      month: options.month,
      employeeId: options.employeeId,
    }),
    prisma.employee.findFirst({
      where: {
        id: options.employeeId,
        companyId: options.companyId,
      },
      select: {
        basePay: true,
        bpjsKesehatanEnabled: true,
        bpjsKetenagakerjaanEnabled: true,
        jhtEnabled: true,
        jpEnabled: true,
        jkkEnabled: true,
        jkmEnabled: true,
        jkkPercent: true,
      },
    }),
    getEmployeeCompanyBalance(prisma, options.employeeId),
  ]);

  const row = rows[0] ?? null;
  const locked = lock?.locked === true;
  const bpjs = employee
    ? calculateBpjsBreakdown({
        basePay: row?.basePay ?? decimalToNumber(employee.basePay) ?? 0,
        bpjsKesehatanEnabled: employee.bpjsKesehatanEnabled,
        bpjsKetenagakerjaanEnabled: employee.bpjsKetenagakerjaanEnabled,
        jhtEnabled: employee.jhtEnabled,
        jpEnabled: employee.jpEnabled,
        jkkEnabled: employee.jkkEnabled,
        jkmEnabled: employee.jkmEnabled,
        jkkPercent: decimalToNumber(employee.jkkPercent),
      })
    : null;

  return {
    row,
    locked,
    preview: !locked,
    earnings: row?.wage ?? 0,
    deductions: row?.manualDeductions ?? 0,
    bpjsEmployee: (row?.bpjsKesehatan ?? 0) + (row?.bpjsTk ?? 0),
    bpjsCompany: bpjs?.companyContribution ?? 0,
    balanceDueToCompany: balance?.amountOwed ?? 0,
  };
}
