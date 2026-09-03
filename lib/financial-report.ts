import type { EmploymentType } from "@prisma/client";

import { LIVE_PROJECT_EXPENSE_WHERE } from "@/lib/books-open";

import {
  bankAccountWhere,
  FINANCIAL_REPORT_ALL_BANKS,
  prismaDateFilter,
} from "@/lib/financial-report-query";
import {
  allocateCompanyWages,
  type AllocatedWageEmployee,
  type WageSplitNote,
} from "@/lib/internal-payroll-wages";
import { prisma } from "@/lib/prisma";
import { PROJECT_PAY_RECOVERY_TYPES } from "@/lib/payroll-deductions";
import { decimalToNumber } from "@/lib/project-billing";
import {
  DEFAULT_PRODUCT_PPN_RATE_PERCENT,
  ppnRateFromPercent,
  splitInclusiveVat,
} from "@/lib/vat";

/**
 * Financial Report P&L definitions (HO Finance only):
 *
 * UX order: company-wide first, then drill to clients → projects (including completed).
 *
 * - Money in: PAID invoice periods at the approved reconciliation amount
 *   (else the invoice amount). Tax-inclusive receipts are split by dividing
 *   by 1 + rate (DPP = paid ÷ 1.12 at 12%). Contract price is the agreed job
 *   value shown separately — never copied onto every period.
 * - Accounts payable: unpaid vendor bills (what we owe). Not a P&L expense.
 * - Money out: stock issued to a project (ISSUE_TO_PROJECT, not equipment);
 *   PROJECT / INTERNAL vendor bills when paid; Internal Payroll wages;
 *   parking deal outflows; Payroll Management wages RGS actually paid.
 * - STOCK purchases stay warehouse assets until issued. Paying the vendor
 *   only clears AP.
 * - Wages match Internal Payroll: daily rate = monthly pay ÷ 26; company pay =
 *   daily rate × complete check-in+check-out days (one paid day per calendar day).
 *   Same-day multi-site work splits that one daily rate equally (1/N).
 *   Company cash out uses net Internal Payroll (gross minus manual deductions
 *   plus Return of security deposit).
 */

type PaidPeriodAmountInput = {
  amount: Parameters<typeof decimalToNumber>[0];
  revisedInvoiceAmount?: Parameters<typeof decimalToNumber>[0];
  projectContractPrice?: Parameters<typeof decimalToNumber>[0];
  ppnRatePercent?: Parameters<typeof decimalToNumber>[0];
};

/** Tax-inclusive commercial amount the client approved or was billed. */
export function commercialPeriodGross(period: PaidPeriodAmountInput): number {
  return (
    decimalToNumber(period.revisedInvoiceAmount) ??
    decimalToNumber(period.amount) ??
    0
  );
}

/**
 * P&L income for one PAID period: approved / invoiced amount with tax
 * taken out by dividing (amount ÷ 1.12 at 12%), never by subtracting 12%.
 */
export function recognizedIncomeAmount(period: PaidPeriodAmountInput): number {
  const gross = commercialPeriodGross(period);
  if (gross <= 0) return 0;
  const ratePercent =
    decimalToNumber(period.ppnRatePercent) ?? DEFAULT_PRODUCT_PPN_RATE_PERCENT;
  if (ratePercent <= 0) return Math.round(gross);
  return splitInclusiveVat(gross, ppnRateFromPercent(ratePercent)).dpp;
}

export function profitMarginPercent(
  moneyIn: number,
  profit: number
): number | null {
  if (moneyIn <= 0) return null;
  return (profit / moneyIn) * 100;
}

export type ProjectWageEmployeeRow = {
  employeeId: string;
  employeeNo: string;
  name: string;
  employmentType: EmploymentType;
  monthlyBasePay: number | null;
  dailyRate: number;
  daysWorked: number;
  wageCost: number;
  splitNotes: WageSplitNote[];
};

function toProjectWageRow(
  row: AllocatedWageEmployee
): ProjectWageEmployeeRow {
  return {
    employeeId: row.employeeId,
    employeeNo: row.employeeNo,
    name: row.name,
    employmentType: row.employmentType,
    monthlyBasePay: row.monthlyBasePay > 0 ? row.monthlyBasePay : null,
    dailyRate: row.dailyRate,
    daysWorked: row.daysWorked,
    wageCost: row.wageCost,
    splitNotes: row.splitNotes,
  };
}

/** Wage rows for one project from Internal Payroll (CICO days, including history). */
export async function listProjectWageCosts(
  projectId: string,
  options?: { companyId?: string; from?: Date; toExclusive?: Date }
): Promise<ProjectWageEmployeeRow[]> {
  if (!options?.companyId) return [];
  const allocated = await allocateCompanyWages({
    companyId: options.companyId,
    from: options.from,
    toExclusive: options.toExclusive,
  });
  return (allocated.get(projectId) ?? []).map(toProjectWageRow);
}

export async function getProjectWageCostsByProjectIds(
  projectIds: string[],
  options?: { companyId?: string; from?: Date; toExclusive?: Date }
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (projectIds.length === 0 || !options?.companyId) return totals;
  const allocated = await allocateCompanyWages({
    companyId: options.companyId,
    from: options.from,
    toExclusive: options.toExclusive,
  });
  for (const projectId of projectIds) {
    const rows = allocated.get(projectId) ?? [];
    totals.set(
      projectId,
      rows.reduce((sum, row) => sum + row.wageCost, 0)
    );
  }
  return totals;
}

export async function getSoldOffIncome(options: {
  companyId: string;
  year?: number;
  clientId?: string;
  from?: Date;
  toExclusive?: Date;
  bank?: string;
}): Promise<number> {
  const soldAt = prismaDateFilter(
    options.from ??
      (options.year != null ? new Date(Date.UTC(options.year, 0, 1)) : undefined),
    options.toExclusive ??
      (options.year != null
        ? new Date(Date.UTC(options.year + 1, 0, 1))
        : undefined)
  );
  const sales = await prisma.inventorySale.findMany({
    where: {
      companyId: options.companyId,
      ...(options.clientId ? { clientId: options.clientId } : {}),
      movement: { voidedAt: null },
      ...bankAccountWhere(options.bank ?? FINANCIAL_REPORT_ALL_BANKS),
      ...(soldAt ? { soldAt } : {}),
    },
    select: { totalPrice: true },
  });
  return sales.reduce(
    (sum, sale) => sum + (decimalToNumber(sale.totalPrice) ?? 0),
    0
  );
}

export async function getSoldOffIncomeByClientIds(
  companyId: string,
  clientIds: string[],
  from?: Date,
  toExclusive?: Date,
  bank = FINANCIAL_REPORT_ALL_BANKS
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (clientIds.length === 0) return totals;
  const soldAt = prismaDateFilter(from, toExclusive);
  const groups = await prisma.inventorySale.groupBy({
    by: ["clientId"],
    where: {
      companyId,
      clientId: { in: clientIds },
      movement: { voidedAt: null },
      ...bankAccountWhere(bank),
      ...(soldAt ? { soldAt } : {}),
    },
    _sum: { totalPrice: true },
  });
  for (const row of groups) {
    if (!row.clientId) continue;
    totals.set(row.clientId, decimalToNumber(row._sum.totalPrice) ?? 0);
  }
  return totals;
}

function inUtcRange(
  date: Date | null | undefined,
  from?: Date,
  toExclusive?: Date
): boolean {
  if (!date) return false;
  if (from && date.getTime() < from.getTime()) return false;
  if (toExclusive && date.getTime() >= toExclusive.getTime()) return false;
  return true;
}

export async function getPayrollManagementTotalsByProjectIds(
  projectIds: string[],
  from?: Date,
  toExclusive?: Date
): Promise<Map<string, { moneyIn: number; moneyOut: number }>> {
  const totals = new Map<string, { moneyIn: number; moneyOut: number }>();
  if (projectIds.length === 0) return totals;

  const periods = await prisma.payrollManagementPeriod.findMany({
    where: { projectId: { in: projectIds } },
    select: {
      projectId: true,
      status: true,
      pdfLocked: true,
      pdfLockedAt: true,
      wagesPaidAt: true,
      reimbursedAt: true,
      wagesTotal: true,
      feeAmount: true,
      taxAmount: true,
      clientBillAmount: true,
      invoicePeriod: { select: { status: true, paidAt: true } },
    },
  });

  const bounded = Boolean(from || toExclusive);
  for (const period of periods) {
    const current = totals.get(period.projectId) ?? { moneyIn: 0, moneyOut: 0 };
    const wages = decimalToNumber(period.wagesTotal) ?? 0;
    const fee = decimalToNumber(period.feeAmount) ?? 0;
    const tax = decimalToNumber(period.taxAmount) ?? 0;
    const clientBill = decimalToNumber(period.clientBillAmount) ?? 0;
    const wageWhen = period.wagesPaidAt;
    const wagesRecognized = Boolean(period.wagesPaidAt);
    if (
      wagesRecognized &&
      (bounded ? inUtcRange(wageWhen, from, toExclusive) : true)
    ) {
      current.moneyOut += wages;
    }
    const paidAt = period.invoicePeriod?.paidAt ?? period.reimbursedAt;
    const paid =
      period.invoicePeriod?.status === "PAID" || period.status === "REIMBURSED";
    if (paid && (bounded ? inUtcRange(paidAt, from, toExclusive) : true)) {
      current.moneyIn += Math.max(0, (clientBill || wages + fee + tax) - tax);
    }
    totals.set(period.projectId, current);
  }
  return totals;
}

export async function getProjectPnlAdjustments(
  companyId: string,
  projectIds: string[],
  options?: {
    year?: number;
    month?: number | null;
    from?: Date;
    toExclusive?: Date;
  }
): Promise<
  Map<
    string,
    {
      depositReturned: number;
      keptDeposit: number;
      payRecovery: number;
      incidents: number;
    }
  >
> {
  const totals = new Map<
    string,
    {
      depositReturned: number;
      keptDeposit: number;
      payRecovery: number;
      incidents: number;
    }
  >();
  for (const id of projectIds) {
    totals.set(id, {
      depositReturned: 0,
      keptDeposit: 0,
      payRecovery: 0,
      incidents: 0,
    });
  }
  if (projectIds.length === 0) return totals;

  const payrollPeriodWhere =
    options?.year != null
      ? {
          year: options.year,
          ...(options.month != null ? { month: options.month } : {}),
        }
      : {};
  const incurredAt = prismaDateFilter(options?.from, options?.toExclusive);

  const [returns, recoveries, incidents, keptEmployees] = await Promise.all([
    prisma.payrollDeduction.groupBy({
      by: ["projectId"],
      where: {
        companyId,
        projectId: { in: projectIds },
        type: "RETURN_OF_SECURITY_DEPOSIT",
        ...payrollPeriodWhere,
      },
      _sum: { amount: true },
    }),
    prisma.payrollDeduction.groupBy({
      by: ["projectId"],
      where: {
        companyId,
        projectId: { in: projectIds },
        type: { in: [...PROJECT_PAY_RECOVERY_TYPES] },
        ...payrollPeriodWhere,
      },
      _sum: { amount: true },
    }),
    prisma.projectExpense.groupBy({
      by: ["projectId"],
      where: {
        ...LIVE_PROJECT_EXPENSE_WHERE,
        projectId: { in: projectIds },
        ...(incurredAt ? { incurredAt } : {}),
      },
      _sum: { amount: true },
    }),
    options?.from || options?.toExclusive || options?.year != null
      ? Promise.resolve([])
      : prisma.employee.findMany({
          where: {
            companyId,
            depositStatus: "KEPT_BY_COMPANY",
            depositSourceProjectId: { in: projectIds },
          },
          select: { depositSourceProjectId: true, depositHeldAmount: true },
        }),
  ]);

  for (const row of returns) {
    if (!row.projectId) continue;
    const current = totals.get(row.projectId);
    if (current) current.depositReturned = decimalToNumber(row._sum.amount) ?? 0;
  }
  for (const row of recoveries) {
    if (!row.projectId) continue;
    const current = totals.get(row.projectId);
    if (current) current.payRecovery = decimalToNumber(row._sum.amount) ?? 0;
  }
  for (const row of incidents) {
    const current = totals.get(row.projectId);
    if (current) current.incidents = decimalToNumber(row._sum.amount) ?? 0;
  }
  for (const row of keptEmployees) {
    if (!row.depositSourceProjectId) continue;
    const current = totals.get(row.depositSourceProjectId);
    if (current) {
      current.keptDeposit += decimalToNumber(row.depositHeldAmount) ?? 0;
    }
  }
  return totals;
}
