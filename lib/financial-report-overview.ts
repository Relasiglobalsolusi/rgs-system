import {
  commercialPeriodGross,
  recognizedIncomeAmount,
} from "@/lib/financial-report";
import {
  bankAccountWhere,
  FINANCIAL_REPORT_ALL_BANKS,
  financialReportCalendarRange,
  financialReportWageRange,
  type FinancialReportSelection,
} from "@/lib/financial-report-query";
import {
  getSecurityDepositSnapshot,
  sumInternalPayrollNetAdjustment,
  sumKeptDepositIncome,
  type SecurityDepositSnapshot,
} from "@/lib/internal-payroll-month";
import {
  allocateCompanyWages,
  OVERHEAD_WAGE_BUCKET,
  wageTotalForSite,
} from "@/lib/internal-payroll-wages";
import {
  excludeEquipmentFromProjectInventoryCost,
  stockValueOnHand,
} from "@/lib/inventory";
import { computeParkingProjectTotals } from "@/lib/parking-economics";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { jakartaYearMonth } from "@/lib/vat";
import { sumPostedPettyCashOutflows } from "@/lib/petty-cash";
import {
  getBpjsPayableTotals,
  type BpjsPayableTotals,
} from "@/lib/financial-report-bpjs";
import { operatingPurchaseAmount } from "@/lib/purchase-operating-cost";
import {
  sumLoanDrawsInRange,
  sumLoanPrincipalReturnedInRange,
  sumLoansPayable,
} from "@/lib/loan-facility-query";

export const FINANCIAL_REPORT_JOB_STATUSES = [
  "IN_PROGRESS",
  "WAITING_FOR_APPROVAL",
  "OFF_SITE",
  "ON_HOLD",
  "COMPLETED",
] as const;

export type MoneyPair = {
  moneyIn: number;
  moneyOut: number;
  net: number;
};

export type OwedBucket = {
  unpaid: number;
  overdue: number;
};

export type OverheadBreakdown = {
  total: number;
  wages: number;
  internalPurchases: number;
  internalStockUsed: number;
  importRateDifferenceExpense: number;
  importRateDifferenceIncome: number;
};

export type FinancialReportOverview = {
  selection: FinancialReportSelection;
  period: MoneyPair;
  clientsOwe: OwedBucket;
  vendorsOwe: OwedBucket;
  /** Period profit minus outstanding accounts payable. */
  netPosition: number;
  warehouseStockValue: number;
  overhead: OverheadBreakdown;
  deposits: SecurityDepositSnapshot;
  bpjsPayable: BpjsPayableTotals;
  /** Draws this period — funding, not project revenue. */
  loanFundingIn: number;
  /** Principal returned this period — financing outflow, not operating expense. */
  loanPrincipalReturned: number;
  /** Outstanding principal still owed on bank and shareholder loans. */
  loansPayable: number;
};

function pair(moneyIn: number, moneyOut: number): MoneyPair {
  return { moneyIn, moneyOut, net: moneyIn - moneyOut };
}

function jakartaDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function startOfJakartaDay(date: Date): Date {
  const key = jakartaDayKey(date);
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
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

async function getWarehouseStockValue(companyId: string): Promise<number> {
  const items = await prisma.inventoryItem.findMany({
    where: {
      companyId,
      currentStock: { gt: 0 },
      NOT: { itemType: { equals: "Equipment", mode: "insensitive" } },
    },
    select: { currentStock: true, avgUnitCost: true },
  });
  return items.reduce(
    (sum, item) =>
      sum +
      stockValueOnHand(
        decimalToNumber(item.currentStock) ?? 0,
        decimalToNumber(item.avgUnitCost)
      ),
    0
  );
}

const OUTSTANDING_INVOICE_STATUSES = [
  "AWAITING_PAYMENT",
  "PENDING_VERIFICATION",
  "OVERDUE",
] as const;

function outstandingInvoiceAmount(period: {
  status: string;
  dueAt: Date | null;
  amount: Parameters<typeof commercialPeriodGross>[0]["amount"];
  revisedInvoiceAmount: Parameters<
    typeof commercialPeriodGross
  >[0]["revisedInvoiceAmount"];
}): { amount: number; overdue: boolean } {
  const amount = commercialPeriodGross({
    amount: period.amount,
    revisedInvoiceAmount: period.revisedInvoiceAmount,
  });
  const today = startOfJakartaDay(new Date());
  const overdue =
    period.status === "OVERDUE" ||
    (period.dueAt != null && period.dueAt.getTime() < today.getTime());
  return { amount, overdue };
}

export async function getClientsOwed(
  companyId: string,
  clientId?: string | null,
  projectId?: string | null
): Promise<OwedBucket> {
  const periods = await prisma.projectInvoicePeriod.findMany({
    where: {
      project: {
        companyId,
        subCategory: { not: "INTERNAL" },
        ...(clientId ? { clientId } : {}),
        ...(projectId ? { id: projectId } : {}),
      },
      status: { in: [...OUTSTANDING_INVOICE_STATUSES] },
    },
    select: {
      status: true,
      dueAt: true,
      amount: true,
      revisedInvoiceAmount: true,
    },
  });

  let unpaid = 0;
  let overdue = 0;
  for (const period of periods) {
    const row = outstandingInvoiceAmount(period);
    unpaid += row.amount;
    if (row.overdue) overdue += row.amount;
  }
  return { unpaid, overdue };
}

export async function getClientsOwedByClientIds(
  companyId: string,
  clientIds: string[]
): Promise<Map<string, OwedBucket>> {
  const totals = new Map<string, OwedBucket>();
  for (const id of clientIds) {
    totals.set(id, { unpaid: 0, overdue: 0 });
  }
  if (clientIds.length === 0) return totals;

  const periods = await prisma.projectInvoicePeriod.findMany({
    where: {
      project: {
        companyId,
        clientId: { in: clientIds },
        subCategory: { not: "INTERNAL" },
      },
      status: { in: [...OUTSTANDING_INVOICE_STATUSES] },
    },
    select: {
      status: true,
      dueAt: true,
      amount: true,
      revisedInvoiceAmount: true,
      project: { select: { clientId: true } },
    },
  });

  for (const period of periods) {
    const clientId = period.project.clientId;
    if (!clientId) continue;
    const current = totals.get(clientId) ?? { unpaid: 0, overdue: 0 };
    const row = outstandingInvoiceAmount(period);
    current.unpaid += row.amount;
    if (row.overdue) current.overdue += row.amount;
    totals.set(clientId, current);
  }
  return totals;
}

export async function getVendorsOwed(
  companyId: string,
  clientId?: string | null
): Promise<OwedBucket> {
  const today = startOfJakartaDay(new Date());
  const invoices = await prisma.purchaseInvoice.findMany({
    where: {
      companyId,
      paidAt: null,
      reversedAt: null,
      freeOfCharge: false,
      purpose: { not: "PETTY_CASH" },
      purchaseCategory: { notIn: ["GOVERNMENT", "BANK_LOAN"] },
      ...(clientId ? { project: { clientId } } : {}),
    },
    select: {
      amount: true,
      invoiceDate: true,
      paymentTermsDays: true,
    },
  });

  let unpaid = 0;
  let overdue = 0;
  for (const invoice of invoices) {
    const amount = decimalToNumber(invoice.amount) ?? 0;
    unpaid += amount;
    const terms = invoice.paymentTermsDays ?? 14;
    const due = new Date(invoice.invoiceDate);
    due.setUTCDate(due.getUTCDate() + terms);
    if (due.getTime() < today.getTime()) overdue += amount;
  }
  return { unpaid, overdue };
}

async function sumInternalStockIssues(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<number> {
  const agg = await prisma.inventoryMovement.aggregate({
    where: {
      companyId,
      type: "ISSUE_TO_PROJECT",
      voidedAt: null,
      project: { subCategory: "INTERNAL" },
      ...excludeEquipmentFromProjectInventoryCost,
      ...(from || toExclusive
        ? {
            movedAt: {
              ...(from ? { gte: from } : {}),
              ...(toExclusive ? { lt: toExclusive } : {}),
            },
          }
        : {}),
    },
    _sum: { totalCost: true },
  });
  return decimalToNumber(agg._sum.totalCost) ?? 0;
}

async function sumPurchases(
  companyId: string,
  purpose: "INTERNAL" | "PROJECT",
  from?: Date,
  toExclusive?: Date
): Promise<number> {
  const invoices = await prisma.purchaseInvoice.findMany({
    where: {
      companyId,
      purpose,
      reversedAt: null,
      paidAt: {
        not: null,
        ...(from ? { gte: from } : {}),
        ...(toExclusive ? { lt: toExclusive } : {}),
      },
    },
    select: {
      amount: true,
      purchaseCategory: true,
      governmentTaxKind: true,
      origin: true,
      includesPpn: true,
      ppnRatePercent: true,
      importPpnAmountIdr: true,
      importValueIdr: true,
      pph22AmountIdr: true,
      transferFeeIdr: true,
      loanInterestAmount: true,
    },
  });
  return invoices.reduce((sum, invoice) => {
    return (
      sum +
      operatingPurchaseAmount({
        amount: decimalToNumber(invoice.amount) ?? 0,
        purchaseCategory: invoice.purchaseCategory,
        governmentTaxKind: invoice.governmentTaxKind,
        origin: invoice.origin,
        includesPpn: invoice.includesPpn,
        ppnRatePercent: decimalToNumber(invoice.ppnRatePercent),
        importPpnAmountIdr: decimalToNumber(invoice.importPpnAmountIdr),
        importValueIdr: decimalToNumber(invoice.importValueIdr),
        pph22AmountIdr: decimalToNumber(invoice.pph22AmountIdr),
        transferFeeIdr: decimalToNumber(invoice.transferFeeIdr),
        loanInterestAmount: decimalToNumber(invoice.loanInterestAmount),
      })
    );
  }, 0);
}

async function sumPettyCashTransferFees(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<number> {
  const invoices = await prisma.purchaseInvoice.findMany({
    where: {
      companyId,
      purpose: "PETTY_CASH",
      reversedAt: null,
      paidAt: {
        not: null,
        ...(from ? { gte: from } : {}),
        ...(toExclusive ? { lt: toExclusive } : {}),
      },
    },
    select: { transferFeeIdr: true },
  });
  return invoices.reduce(
    (sum, invoice) => sum + (decimalToNumber(invoice.transferFeeIdr) ?? 0),
    0
  );
}

async function sumPaidInvoices(
  companyId: string,
  from?: Date,
  toExclusive?: Date,
  bank = FINANCIAL_REPORT_ALL_BANKS
): Promise<number> {
  const periods = await prisma.projectInvoicePeriod.findMany({
    where: {
      status: "PAID",
      project: { companyId, subCategory: { not: "INTERNAL" } },
      ...bankAccountWhere(bank),
      ...(from || toExclusive
        ? {
            paidAt: {
              ...(from ? { gte: from } : {}),
              ...(toExclusive ? { lt: toExclusive } : {}),
            },
          }
        : {}),
    },
    select: {
      amount: true,
      revisedInvoiceAmount: true,
      ppnRatePercent: true,
    },
  });
  return periods.reduce(
    (sum, period) =>
      sum +
      recognizedIncomeAmount({
        amount: period.amount,
        revisedInvoiceAmount: period.revisedInvoiceAmount,
        ppnRatePercent: period.ppnRatePercent,
      }),
    0
  );
}

async function sumThrPaid(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<number> {
  const agg = await prisma.thrPayment.aggregate({
    where: {
      companyId,
      status: "PAID",
      ...(from || toExclusive
        ? {
            paidAt: {
              not: null,
              ...(from ? { gte: from } : {}),
              ...(toExclusive ? { lt: toExclusive } : {}),
            },
          }
        : { paidAt: { not: null } }),
    },
    _sum: { amount: true },
  });
  return decimalToNumber(agg._sum.amount) ?? 0;
}

export type ImportRateDifferenceRow = {
  id: string;
  supplierName: string;
  invoiceRef: string;
  paidAt: Date | null;
  differenceIdr: number;
};

async function sumImportRateDifferences(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<{ expense: number; income: number }> {
  const invoices = await prisma.purchaseInvoice.findMany({
    where: {
      companyId,
      origin: "IMPORT",
      reversedAt: null,
      paidAt: {
        not: null,
        ...(from ? { gte: from } : {}),
        ...(toExclusive ? { lt: toExclusive } : {}),
      },
      importFxDifferenceIdr: { not: null },
    },
    select: { importFxDifferenceIdr: true },
  });
  let expense = 0;
  let income = 0;
  for (const invoice of invoices) {
    const value = decimalToNumber(invoice.importFxDifferenceIdr) ?? 0;
    if (value > 0) expense += value;
    else if (value < 0) income += Math.abs(value);
  }
  return { expense, income };
}

export async function listImportRateDifferences(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<ImportRateDifferenceRow[]> {
  const invoices = await prisma.purchaseInvoice.findMany({
    where: {
      companyId,
      origin: "IMPORT",
      reversedAt: null,
      paidAt: {
        not: null,
        ...(from ? { gte: from } : {}),
        ...(toExclusive ? { lt: toExclusive } : {}),
      },
      importFxDifferenceIdr: { not: null },
    },
    select: {
      id: true,
      supplierName: true,
      invoiceRef: true,
      paidAt: true,
      importFxDifferenceIdr: true,
    },
    orderBy: { paidAt: "desc" },
    take: 80,
  });
  return invoices
    .map((invoice) => ({
      id: invoice.id,
      supplierName: invoice.supplierName,
      invoiceRef: invoice.invoiceRef,
      paidAt: invoice.paidAt,
      differenceIdr: decimalToNumber(invoice.importFxDifferenceIdr) ?? 0,
    }))
    .filter((row) => row.differenceIdr !== 0);
}

async function sumProjectExpenses(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<number> {
  const agg = await prisma.projectExpense.aggregate({
    where: {
      companyId,
      ...(from || toExclusive
        ? {
            incurredAt: {
              ...(from ? { gte: from } : {}),
              ...(toExclusive ? { lt: toExclusive } : {}),
            },
          }
        : {}),
    },
    _sum: { amount: true },
  });
  return decimalToNumber(agg._sum.amount) ?? 0;
}

async function sumSoldOff(
  companyId: string,
  from?: Date,
  toExclusive?: Date,
  bank = FINANCIAL_REPORT_ALL_BANKS
): Promise<number> {
  const sales = await prisma.inventorySale.findMany({
    where: {
      companyId,
      movement: { voidedAt: null },
      ...bankAccountWhere(bank),
      ...(from || toExclusive
        ? {
            soldAt: {
              ...(from ? { gte: from } : {}),
              ...(toExclusive ? { lt: toExclusive } : {}),
            },
          }
        : {}),
    },
    select: { totalPrice: true },
  });
  return sales.reduce(
    (sum, sale) => sum + (decimalToNumber(sale.totalPrice) ?? 0),
    0
  );
}

async function sumProjectInventoryIssues(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<number> {
  const agg = await prisma.inventoryMovement.aggregate({
    where: {
      companyId,
      type: "ISSUE_TO_PROJECT",
      voidedAt: null,
      project: { subCategory: { not: "INTERNAL" } },
      ...excludeEquipmentFromProjectInventoryCost,
      ...(from || toExclusive
        ? {
            movedAt: {
              ...(from ? { gte: from } : {}),
              ...(toExclusive ? { lt: toExclusive } : {}),
            },
          }
        : {}),
    },
    _sum: { totalCost: true },
  });
  return decimalToNumber(agg._sum.totalCost) ?? 0;
}

async function sumPayrollManagement(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<{ moneyIn: number; moneyOut: number }> {
  const periods = await prisma.payrollManagementPeriod.findMany({
    where: { project: { companyId } },
    select: {
      status: true,
      pdfLocked: true,
      pdfLockedAt: true,
      wagesTotal: true,
      feeAmount: true,
      taxAmount: true,
      clientBillAmount: true,
      wagesPaidAt: true,
      reimbursedAt: true,
      invoicePeriod: { select: { status: true, paidAt: true } },
    },
  });
  let moneyIn = 0;
  let moneyOut = 0;
  for (const period of periods) {
    const wages = decimalToNumber(period.wagesTotal) ?? 0;
    const fee = decimalToNumber(period.feeAmount) ?? 0;
    const tax = decimalToNumber(period.taxAmount) ?? 0;
    const clientBill = decimalToNumber(period.clientBillAmount) ?? 0;
    const wageWhen = period.wagesPaidAt;
    if (wageWhen && inUtcRange(wageWhen, from, toExclusive)) {
      moneyOut += wages;
    } else if (!from && !toExclusive && period.wagesPaidAt) {
      moneyOut += wages;
    }
    const paidAt = period.invoicePeriod?.paidAt ?? period.reimbursedAt;
    const paid =
      period.invoicePeriod?.status === "PAID" || period.status === "REIMBURSED";
    if (paid && paidAt && inUtcRange(paidAt, from, toExclusive)) {
      moneyIn += Math.max(0, (clientBill || wages + fee + tax) - tax);
    } else if (paid && !from && !toExclusive) {
      moneyIn += Math.max(0, (clientBill || wages + fee + tax) - tax);
    }
  }
  return { moneyIn, moneyOut };
}

async function parkingPeriodTotals(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<{ moneyIn: number; dealOut: number }> {
  const projects = await prisma.project.findMany({
    where: { companyId, subCategory: "PARKING" },
    select: { id: true },
  });
  if (!from && !toExclusive) {
    const totals = await computeParkingProjectTotals(
      companyId,
      projects.map((row) => row.id)
    );
    let moneyIn = 0;
    let dealOut = 0;
    for (const value of totals.values()) {
      moneyIn += value.moneyIn;
      dealOut += value.dealOut;
    }
    return { moneyIn, dealOut };
  }

  const logs = await prisma.parkingMonthlyLog.findMany({
    where: { project: { companyId, subCategory: "PARKING" } },
    select: {
      year: true,
      month: true,
      revenueAmount: true,
      projectId: true,
    },
  });
  let moneyIn = 0;
  let dealOut = 0;
  const projectRows = await prisma.project.findMany({
    where: { id: { in: projects.map((row) => row.id) } },
    select: {
      id: true,
      startDate: true,
      createdAt: true,
      endDate: true,
      setupCost: true,
      profitSharePercent: true,
      monthlyClientFee: true,
      memberParkingUnitFee: true,
      memberParkingUnitCount: true,
      parkingTaxPercent: true,
    },
  });
  const { parkingDealFromProject, isSetupMonth } = await import(
    "@/lib/parking-economics"
  );
  const now = jakartaYearMonth();
  for (const project of projectRows) {
    const deal = parkingDealFromProject(project);
    const startYm = jakartaYearMonth(project.startDate ?? project.createdAt);
    const endYm = project.endDate ? jakartaYearMonth(project.endDate) : now;
    const last =
      endYm.year > now.year ||
      (endYm.year === now.year && endYm.month > now.month)
        ? now
        : endYm;
    const revenueByMonth = new Map(
      logs
        .filter((log) => log.projectId === project.id)
        .map((log) => [
          `${log.year}-${log.month}`,
          decimalToNumber(log.revenueAmount) ?? 0,
        ])
    );
    let year = startYm.year;
    let month = startYm.month;
    while (year < last.year || (year === last.year && month <= last.month)) {
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      if (inUtcRange(monthStart, from, toExclusive)) {
        const casual = revenueByMonth.get(`${year}-${month}`) ?? 0;
        const memberRevenue =
          (deal.memberParkingUnitFee ?? 0) * (deal.memberParkingUnitCount ?? 0);
        moneyIn += casual + memberRevenue;
        if (deal.monthlyClientFee > 0) dealOut += deal.monthlyClientFee;
        if (deal.profitSharePercent > 0) {
          dealOut += Math.round((casual * deal.profitSharePercent) / 100);
        }
        if (deal.parkingTaxPercent > 0) {
          dealOut += Math.round((casual * deal.parkingTaxPercent) / 100);
        }
        if (deal.setupCost > 0 && isSetupMonth(project, year, month)) {
          dealOut += deal.setupCost;
        }
      }
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }
  return { moneyIn, dealOut };
}

async function periodPnl(
  companyId: string,
  from?: Date,
  toExclusive?: Date,
  wageFrom?: Date,
  wageToExclusive?: Date,
  bank = FINANCIAL_REPORT_ALL_BANKS
): Promise<{ pair: MoneyPair; overhead: OverheadBreakdown }> {
  const wageRange = {
    from: wageFrom ?? from,
    toExclusive: wageToExclusive ?? toExclusive,
  };
  const [
    paidIn,
    soldOff,
    inventoryOut,
    projectPurchases,
    internalPurchases,
    internalStock,
    payroll,
    parking,
    wages,
    payrollNetAdj,
    keptIncome,
    thrPaid,
    incidentExpenses,
    pettyCashOut,
    pettyCashTransferFees,
    importFx,
  ] = await Promise.all([
    sumPaidInvoices(companyId, from, toExclusive, bank),
    sumSoldOff(companyId, from, toExclusive, bank),
    sumProjectInventoryIssues(companyId, from, toExclusive),
    sumPurchases(companyId, "PROJECT", from, toExclusive),
    sumPurchases(companyId, "INTERNAL", from, toExclusive),
    sumInternalStockIssues(companyId, from, toExclusive),
    sumPayrollManagement(companyId, from, toExclusive),
    parkingPeriodTotals(companyId, from, toExclusive),
    allocateCompanyWages({
      companyId,
      from: wageRange.from,
      toExclusive: wageRange.toExclusive,
    }),
    sumInternalPayrollNetAdjustment({
      companyId,
      from: wageRange.from,
      toExclusive: wageRange.toExclusive,
      includeSecurityDeposit: false,
    }),
    sumKeptDepositIncome({
      companyId,
      from: wageRange.from,
      toExclusive: wageRange.toExclusive,
    }),
    sumThrPaid(companyId, from, toExclusive),
    sumProjectExpenses(companyId, from, toExclusive),
    sumPostedPettyCashOutflows(companyId, prisma, from, toExclusive).catch(
      () => 0
    ),
    sumPettyCashTransferFees(companyId, from, toExclusive),
    sumImportRateDifferences(companyId, from, toExclusive),
  ]);

  const commercialWages = [...wages.entries()]
    .filter(([key]) => key !== OVERHEAD_WAGE_BUCKET)
    .reduce(
      (sum, [, rows]) =>
        sum + rows.reduce((rowSum, row) => rowSum + row.wageCost, 0),
      0
    );
  const overheadWages = wageTotalForSite(wages, OVERHEAD_WAGE_BUCKET);
  const overhead: OverheadBreakdown = {
    wages: overheadWages,
    internalPurchases,
    internalStockUsed: internalStock,
    importRateDifferenceExpense: importFx.expense,
    importRateDifferenceIncome: importFx.income,
    total:
      overheadWages +
      internalPurchases +
      internalStock +
      importFx.expense,
  };

  const moneyIn =
    (bank === FINANCIAL_REPORT_ALL_BANKS
      ? paidIn + soldOff + payroll.moneyIn + parking.moneyIn + keptIncome
      : paidIn + soldOff) + importFx.income;
  const moneyOut =
    inventoryOut +
    projectPurchases +
    commercialWages +
    payroll.moneyOut +
    parking.dealOut +
    overhead.total +
    payrollNetAdj +
    thrPaid +
    incidentExpenses +
    pettyCashOut +
    pettyCashTransferFees;

  return { pair: pair(moneyIn, moneyOut), overhead };
}

function emptyOverview(
  selection: FinancialReportSelection,
  patch: Partial<FinancialReportOverview>
): FinancialReportOverview {
  return {
    selection,
    period: { moneyIn: 0, moneyOut: 0, net: 0 },
    clientsOwe: { unpaid: 0, overdue: 0 },
    vendorsOwe: { unpaid: 0, overdue: 0 },
    netPosition: 0,
    warehouseStockValue: 0,
    overhead: {
      total: 0,
      wages: 0,
      internalPurchases: 0,
      internalStockUsed: 0,
      importRateDifferenceExpense: 0,
      importRateDifferenceIncome: 0,
    },
    deposits: { held: 0, returned: 0, kept: 0 },
    bpjsPayable: {
      kesehatan: { companyTotal: 0, employeeCount: 0 },
      ketenagakerjaan: { companyTotal: 0, employeeCount: 0 },
    },
    loanFundingIn: 0,
    loanPrincipalReturned: 0,
    loansPayable: 0,
    ...patch,
  };
}

export async function getFinancialReportOverviewData(
  companyId: string,
  selection: FinancialReportSelection
): Promise<FinancialReportOverview> {
  const calendar = financialReportCalendarRange(selection);
  const wage = financialReportWageRange(selection);
  const bank = selection.bank ?? FINANCIAL_REPORT_ALL_BANKS;

  const [
    period,
    clientsOwe,
    vendorsOwe,
    warehouseStockValue,
    deposits,
    bpjsPayable,
    loanFundingIn,
    loanPrincipalReturned,
    loansPayable,
  ] =
    await Promise.all([
      periodPnl(
        companyId,
        calendar.from,
        calendar.toExclusive,
        wage.from,
        wage.toExclusive,
        bank
      ),
      getClientsOwed(companyId),
      getVendorsOwed(companyId),
      getWarehouseStockValue(companyId),
      getSecurityDepositSnapshot(companyId),
      getBpjsPayableTotals(companyId),
      sumLoanDrawsInRange(companyId, calendar.from, calendar.toExclusive),
      sumLoanPrincipalReturnedInRange(
        companyId,
        calendar.from,
        calendar.toExclusive
      ),
      sumLoansPayable(companyId),
    ]);

  return {
    selection,
    period: period.pair,
    clientsOwe,
    vendorsOwe,
    netPosition: period.pair.net - vendorsOwe.unpaid - loansPayable,
    warehouseStockValue,
    overhead: period.overhead,
    deposits,
    bpjsPayable,
    loanFundingIn,
    loanPrincipalReturned,
    loansPayable,
  };
}

/** Card-detail pages only need the slice for that metric — not the full company P&L. */
export async function getFinancialReportDetailOverview(
  companyId: string,
  selection: FinancialReportSelection,
  metric: string
): Promise<FinancialReportOverview> {
  if (
    metric === "deposits" ||
    metric === "depositsReturned" ||
    metric === "depositsKept"
  ) {
    const deposits = await getSecurityDepositSnapshot(companyId);
    return emptyOverview(selection, { deposits });
  }
  if (metric === "warehouse") {
    const warehouseStockValue = await getWarehouseStockValue(companyId);
    return emptyOverview(selection, { warehouseStockValue });
  }
  if (metric === "ar") {
    const clientsOwe = await getClientsOwed(companyId);
    return emptyOverview(selection, { clientsOwe });
  }
  if (metric === "ap") {
    const vendorsOwe = await getVendorsOwed(companyId);
    return emptyOverview(selection, { vendorsOwe });
  }
  if (metric === "bpjsKesehatan" || metric === "bpjsKetenagakerjaan") {
    const bpjsPayable = await getBpjsPayableTotals(companyId);
    return emptyOverview(selection, { bpjsPayable });
  }
  if (
    metric === "loanFunding" ||
    metric === "loanPrincipalReturned" ||
    metric === "loansPayable"
  ) {
    const calendar = financialReportCalendarRange(selection);
    const [loanFundingIn, loanPrincipalReturned, loansPayable] =
      await Promise.all([
        sumLoanDrawsInRange(companyId, calendar.from, calendar.toExclusive),
        sumLoanPrincipalReturnedInRange(
          companyId,
          calendar.from,
          calendar.toExclusive
        ),
        sumLoansPayable(companyId),
      ]);
    return emptyOverview(selection, {
      loanFundingIn,
      loanPrincipalReturned,
      loansPayable,
    });
  }
  return getFinancialReportOverviewData(companyId, selection);
}

