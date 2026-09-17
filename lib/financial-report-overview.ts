import {
  LIVE_PROJECT_EXPENSE_WHERE,
  liveInvoiceIncomeWhereFor,
} from "@/lib/books-open";
import {
  commercialPeriodGross,
  recognizedIncomeAmount,
  soldOffIncomeAmount,
} from "@/lib/financial-report";
import { invoiceDueFromExclusive, type CommercialTaxKind } from "@/lib/commercial-tax";
import {
  bankAccountWhere,
  FINANCIAL_REPORT_ALL_BANKS,
  financialReportCalendarRange,
  financialReportWageRange,
  isSingleBankSelection,
  purchaseBankAccountWhere,
  type FinancialReportSelection,
} from "@/lib/financial-report-query";
import { companyCashBalance } from "@/lib/company-cash";
import {
  getSecurityDepositSnapshot,
  sumInternalPayrollNetAdjustment,
  sumKeptDepositIncome,
  type SecurityDepositSnapshot,
} from "@/lib/internal-payroll-month";
import { allocateLockedCompanyWages } from "@/lib/locked-payroll-pnl";
import {
  listInternalWageSiteKeys,
  OVERHEAD_WAGE_BUCKET,
} from "@/lib/internal-payroll-wages";
import {
  excludeEquipmentFromProjectInventoryCost,
  stockValueOnHand,
} from "@/lib/inventory";
import { computeParkingProjectTotals } from "@/lib/parking-economics";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { jakartaYearMonth } from "@/lib/vat";
import {
  getBpjsPayableTotals,
  type BpjsPayableTotals,
} from "@/lib/financial-report-bpjs";
import { operatingPurchaseAmount } from "@/lib/purchase-operating-cost";
import { sumPettyCashPnlOutflows } from "@/lib/petty-cash";
import { sumLoanInterestDue } from "@/lib/loan-facility-query";
import {
  buildFinancialReportPnlStairs,
  emptyFinancialReportPnlStairs,
  type FinancialReportPnlStairs,
} from "@/lib/financial-report-pnl";
import {
  corporateIncomeTaxOnProfitBeforeTax,
  CORPORATE_INCOME_TAX_RATE_PERCENT,
} from "@/lib/corporate-income-tax";
import { isCapitalVehicleExpenseKind } from "@/lib/vehicle-expense";
import { listTaxRateSlices, TAX_RATE_CODE } from "@/lib/tax-rates";

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
  pnl: FinancialReportPnlStairs;
  clientsOwe: OwedBucket;
  vendorsOwe: OwedBucket;
  /** Net profit minus outstanding accounts payable. */
  netPosition: number;
  warehouseStockValue: number;
  overhead: OverheadBreakdown;
  deposits: SecurityDepositSnapshot;
  bpjsPayable: BpjsPayableTotals;
  /** Interest recorded on Loan this period. Finance cost on the P&L. */
  loanInterestDue: number;
  /** Hard cash withdrawn from a company bank and not yet spent. */
  cashAtHand: number;
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
  ppnRatePercent?: Parameters<typeof commercialPeriodGross>[0]["ppnRatePercent"];
  project?: {
    chargedTaxKind?: CommercialTaxKind | "" | null;
    requiresTaxInvoice?: boolean | null;
    pphRatePercent?: Parameters<typeof commercialPeriodGross>[0]["amount"];
    isGovernmentContract?: boolean | null;
  };
}): { amount: number; overdue: boolean } {
  const exclusive = commercialPeriodGross({
    amount: period.amount,
    revisedInvoiceAmount: period.revisedInvoiceAmount,
  });
  const amount = invoiceDueFromExclusive(
    exclusive,
    {
      chargedTaxKind: period.project?.chargedTaxKind,
      requiresTaxInvoice: period.project?.requiresTaxInvoice,
      pphRatePercent: decimalToNumber(period.project?.pphRatePercent),
      isGovernmentContract: period.project?.isGovernmentContract,
    },
    decimalToNumber(period.ppnRatePercent)
  );
  const today = startOfJakartaDay(new Date());
  const overdue =
    period.status === "OVERDUE" ||
    (period.dueAt != null && period.dueAt.getTime() < today.getTime());
  return { amount, overdue };
}

export async function getClientsOwed(
  companyId: string,
  clientId?: string | null,
  projectId?: string | null,
  _options?: { includeCatchUp?: boolean }
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
      ppnRatePercent: true,
      project: {
        select: {
          chargedTaxKind: true,
          requiresTaxInvoice: true,
          pphRatePercent: true,
          isGovernmentContract: true,
        },
      },
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
      ppnRatePercent: true,
      project: {
        select: {
          clientId: true,
          chargedTaxKind: true,
          requiresTaxInvoice: true,
          pphRatePercent: true,
          isGovernmentContract: true,
        },
      },
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
  filter:
    | { purpose: "INTERNAL" | "PROJECT" | "PETTY_CASH" }
    | { purchaseCategory: "VEHICLE" },
  from?: Date,
  toExclusive?: Date,
  bank = FINANCIAL_REPORT_ALL_BANKS
): Promise<number> {
  const invoices = await prisma.purchaseInvoice.findMany({
    where: {
      companyId,
      ...filter,
      ...("purpose" in filter ? { purchaseCategory: { not: "VEHICLE" } } : {}),
      reversedAt: null,
      employeePaymentKind: { not: "INTERNAL_PAYROLL" },
      ...purchaseBankAccountWhere(bank),
      paidAt: {
        not: null,
        ...(from ? { gte: from } : {}),
        ...(toExclusive ? { lt: toExclusive } : {}),
      },
    },
    select: {
      amount: true,
      supplierName: true,
      invoiceRef: true,
      purchaseCategory: true,
      vehicleExpenseKind: true,
      governmentTaxKind: true,
      governmentOperatingAmount: true,
      origin: true,
      includesPpn: true,
      ppnRatePercent: true,
      importPpnAmountIdr: true,
      importValueIdr: true,
      pph22AmountIdr: true,
      transferFeeIdr: true,
      loanInterestAmount: true,
      loanPenaltyAmount: true,
      loanAdminFeeAmount: true,
      loanProvisionAmount: true,
    },
  });
  return invoices.reduce((sum, invoice) => {
    if (
      invoice.purchaseCategory === "VEHICLE" &&
      isCapitalVehicleExpenseKind(invoice.vehicleExpenseKind)
    ) {
      return sum;
    }
    return (
      sum +
      operatingPurchaseAmount({
        amount: decimalToNumber(invoice.amount) ?? 0,
        purchaseCategory: invoice.purchaseCategory,
        governmentTaxKind: invoice.governmentTaxKind,
        governmentOperatingAmount: decimalToNumber(
          invoice.governmentOperatingAmount
        ),
        origin: invoice.origin,
        includesPpn: invoice.includesPpn,
        ppnRatePercent: decimalToNumber(invoice.ppnRatePercent),
        importPpnAmountIdr: decimalToNumber(invoice.importPpnAmountIdr),
        importValueIdr: decimalToNumber(invoice.importValueIdr),
        pph22AmountIdr: decimalToNumber(invoice.pph22AmountIdr),
        transferFeeIdr: decimalToNumber(invoice.transferFeeIdr),
        loanInterestAmount: decimalToNumber(invoice.loanInterestAmount),
        loanPenaltyAmount: decimalToNumber(invoice.loanPenaltyAmount),
        loanAdminFeeAmount: decimalToNumber(invoice.loanAdminFeeAmount),
        loanProvisionAmount: decimalToNumber(invoice.loanProvisionAmount),
      })
    );
  }, 0);
}

async function sumPaidInvoices(
  companyId: string,
  from?: Date,
  toExclusive?: Date,
  bank = FINANCIAL_REPORT_ALL_BANKS
): Promise<number> {
  const liveIncome = await liveInvoiceIncomeWhereFor(companyId);
  const periods = await prisma.projectInvoicePeriod.findMany({
    where: {
      status: "PAID",
      ...liveIncome,
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
  toExclusive?: Date,
  bank = FINANCIAL_REPORT_ALL_BANKS
): Promise<{ expense: number; income: number }> {
  const invoices = await prisma.purchaseInvoice.findMany({
    where: {
      companyId,
      origin: "IMPORT",
      reversedAt: null,
      ...purchaseBankAccountWhere(bank),
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
  toExclusive?: Date,
  bank = FINANCIAL_REPORT_ALL_BANKS
): Promise<ImportRateDifferenceRow[]> {
  const invoices = await prisma.purchaseInvoice.findMany({
    where: {
      companyId,
      origin: "IMPORT",
      reversedAt: null,
      ...purchaseBankAccountWhere(bank),
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
  toExclusive?: Date,
  bank = FINANCIAL_REPORT_ALL_BANKS
): Promise<{ expense: number; income: number }> {
  const range =
    from || toExclusive
      ? {
          incurredAt: {
            ...(from ? { gte: from } : {}),
            ...(toExclusive ? { lt: toExclusive } : {}),
          },
        }
      : {};
  const [outAgg, inAgg] = await Promise.all([
    prisma.projectExpense.aggregate({
      where: {
        ...LIVE_PROJECT_EXPENSE_WHERE,
        companyId,
        amount: { gt: 0 },
        ...range,
        ...bankAccountWhere(bank),
      },
      _sum: { amount: true },
    }),
    prisma.projectExpense.aggregate({
      where: {
        ...LIVE_PROJECT_EXPENSE_WHERE,
        companyId,
        amount: { lt: 0 },
        ...range,
        ...bankAccountWhere(bank),
      },
      _sum: { amount: true },
    }),
  ]);
  return {
    expense: decimalToNumber(outAgg._sum.amount) ?? 0,
    income: Math.abs(decimalToNumber(inAgg._sum.amount) ?? 0),
  };
}

/** Sold-off income lands on the paid date. An unpaid sale is not income yet. */
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
      paidAt: {
        not: null,
        ...(from ? { gte: from } : {}),
        ...(toExclusive ? { lt: toExclusive } : {}),
      },
    },
    select: { subtotal: true, taxAmount: true, totalPrice: true },
  });
  return sales.reduce((sum, sale) => sum + soldOffIncomeAmount(sale), 0);
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
    // Wages book only once the sheet is locked, same rule as Internal Payroll.
    const wageWhen = period.pdfLocked ? period.wagesPaidAt : null;
    if (wageWhen && inUtcRange(wageWhen, from, toExclusive)) {
      moneyOut += wages;
    } else if (!from && !toExclusive && wageWhen) {
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
  toExclusive?: Date,
  bank = FINANCIAL_REPORT_ALL_BANKS
): Promise<{ moneyIn: number; dealOut: number }> {
  const projects = await prisma.project.findMany({
    where: { companyId, subCategory: "PARKING" },
    select: { id: true },
  });
  const totals = await computeParkingProjectTotals(
    companyId,
    projects.map((row) => row.id),
    from,
    toExclusive,
    bank
  );
  let moneyIn = 0;
  let dealOut = 0;
  for (const value of totals.values()) {
    moneyIn += value.moneyIn;
    dealOut += value.dealOut;
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
): Promise<{
  pair: MoneyPair;
  overhead: OverheadBreakdown;
  pnlBase: {
    revenue: number;
    costOfSales: number;
    otherIncome: number;
    headOffice: number;
  };
}> {
  const wageRange = {
    from: wageFrom ?? from,
    toExclusive: wageToExclusive ?? toExclusive,
  };
  const singleBank = isSingleBankSelection(bank);
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
    vehicleOperating,
    importFx,
    pettyPnl,
    prepaidReturns,
  ] = await Promise.all([
    sumPaidInvoices(companyId, from, toExclusive, bank),
    sumSoldOff(companyId, from, toExclusive, bank),
    sumProjectInventoryIssues(companyId, from, toExclusive),
    sumPurchases(companyId, { purpose: "PROJECT" }, from, toExclusive, bank),
    sumPurchases(companyId, { purpose: "INTERNAL" }, from, toExclusive, bank),
    sumInternalStockIssues(companyId, from, toExclusive),
    sumPayrollManagement(companyId, from, toExclusive),
    parkingPeriodTotals(companyId, from, toExclusive, bank),
    allocateLockedCompanyWages({
      companyId,
      from,
      toExclusive,
      bank,
    }),
    sumInternalPayrollNetAdjustment({
      companyId,
      from,
      toExclusive,
      includeSecurityDeposit: false,
    }),
    sumKeptDepositIncome({
      companyId,
      from: wageRange.from,
      toExclusive: wageRange.toExclusive,
    }),
    sumThrPaid(companyId, from, toExclusive),
    sumProjectExpenses(companyId, from, toExclusive, bank),
    sumPurchases(companyId, { purchaseCategory: "VEHICLE" }, from, toExclusive, bank),
    sumImportRateDifferences(companyId, from, toExclusive, bank),
    singleBank
      ? Promise.resolve({ costOfSales: 0, headOffice: 0 })
      : sumPettyCashPnlOutflows(prisma, companyId, from, toExclusive).catch(
          () => ({ costOfSales: 0, headOffice: 0 })
        ),
    prisma.prepaidCardLossRecovery.aggregate({
      where: {
        loss: { companyId },
        source: "PAY_NOW",
        ...bankAccountWhere(bank),
        recoveredAt: {
          ...(from ? { gte: from } : {}),
          ...(toExclusive ? { lt: toExclusive } : {}),
        },
      },
      _sum: { amount: true },
    }),
  ]);

  // Internal sites carry their own wage cost, but stay Head Office overhead here.
  const internalSiteKeys = await listInternalWageSiteKeys(companyId);
  const isOverheadWageSite = (key: string) =>
    key === OVERHEAD_WAGE_BUCKET || internalSiteKeys.has(key);
  const commercialWages = [...wages.entries()]
    .filter(([key]) => !isOverheadWageSite(key))
    .reduce(
      (sum, [, rows]) =>
        sum + rows.reduce((rowSum, row) => rowSum + row.wageCost, 0),
      0
    );
  const overheadWages = [...wages.entries()]
    .filter(([key]) => isOverheadWageSite(key))
    .reduce(
      (sum, [, rows]) =>
        sum + rows.reduce((rowSum, row) => rowSum + row.wageCost, 0),
      0
    );
  const overheadPurchases = internalPurchases + pettyPnl.headOffice;
  const overhead: OverheadBreakdown = {
    wages: overheadWages,
    internalPurchases: overheadPurchases,
    internalStockUsed: internalStock,
    importRateDifferenceExpense: importFx.expense,
    importRateDifferenceIncome: importFx.income,
    total:
      overheadWages +
      overheadPurchases +
      internalStock +
      importFx.expense,
  };

  const prepaidReturnIn = decimalToNumber(prepaidReturns._sum.amount) ?? 0;
  const factoryRefundIn =
    decimalToNumber(
      (
        await prisma.equipmentFactoryReturn.aggregate({
          where: {
            companyId,
            status: "REFUNDED",
            ...bankAccountWhere(bank),
            refundedAt: {
              ...(from ? { gte: from } : {}),
              ...(toExclusive ? { lt: toExclusive } : {}),
            },
          },
          _sum: { refundAmount: true },
        })
      )._sum.refundAmount
    ) ?? 0;
  const revenue =
    paidIn + parking.moneyIn + (singleBank ? 0 : payroll.moneyIn);
  const costOfSales =
    (singleBank ? 0 : inventoryOut) +
    projectPurchases +
    (singleBank ? 0 : commercialWages) +
    (singleBank ? 0 : payroll.moneyOut) +
    parking.dealOut +
    incidentExpenses.expense +
    pettyPnl.costOfSales;
  const otherIncome =
    soldOff +
    (singleBank ? 0 : keptIncome) +
    importFx.income +
    prepaidReturnIn +
    factoryRefundIn +
    incidentExpenses.income;
  const headOffice =
    (singleBank
      ? overhead.internalPurchases + overhead.importRateDifferenceExpense
      : overhead.total + payrollNetAdj + thrPaid) + vehicleOperating;
  const moneyIn = revenue + otherIncome;
  const moneyOut = costOfSales + headOffice;

  return {
    pair: pair(moneyIn, moneyOut),
    overhead,
    pnlBase: { revenue, costOfSales, otherIncome, headOffice },
  };
}

function emptyOverview(
  selection: FinancialReportSelection,
  patch: Partial<FinancialReportOverview>
): FinancialReportOverview {
  return {
    selection,
    period: { moneyIn: 0, moneyOut: 0, net: 0 },
    pnl: emptyFinancialReportPnlStairs(),
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
    loanInterestDue: 0,
    cashAtHand: 0,
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
    loanInterestDue,
    cashAtHand,
    taxSlices,
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
      sumLoanInterestDue(companyId, calendar.from, calendar.toExclusive),
      companyCashBalance(prisma, companyId).catch(() => 0),
      listTaxRateSlices(
        companyId,
        TAX_RATE_CODE.PPH_BADAN,
        calendar.from,
        calendar.toExclusive
      ),
    ]);

  const uniqueRates = [
    ...new Set(taxSlices.map((slice) => slice.ratePercent)),
  ];
  let incomeTax: number | undefined;
  let incomeTaxRatePercent: number | null =
    uniqueRates.length === 1
      ? uniqueRates[0]
      : uniqueRates.length === 0
        ? CORPORATE_INCOME_TAX_RATE_PERCENT
        : null;

  if (taxSlices.length > 1) {
    incomeTax = 0;
    for (const slice of taxSlices) {
      const slicePeriod = await periodPnl(
        companyId,
        slice.from,
        slice.toExclusive,
        slice.from,
        slice.toExclusive,
        bank
      );
      const sliceFinance = await sumLoanInterestDue(
        companyId,
        slice.from,
        slice.toExclusive
      );
      const sliceStairs = buildFinancialReportPnlStairs({
        ...slicePeriod.pnlBase,
        financeCosts: sliceFinance,
        incomeTax: 0,
        incomeTaxRatePercent: 0,
      });
      incomeTax += corporateIncomeTaxOnProfitBeforeTax(
        sliceStairs.profitBeforeTax,
        slice.ratePercent / 100
      );
    }
  }

  const pnl = buildFinancialReportPnlStairs({
    ...period.pnlBase,
    financeCosts: loanInterestDue,
    incomeTaxRatePercent,
    ...(incomeTax != null ? { incomeTax } : {}),
  });

  return {
    selection,
    period: {
      moneyIn: pnl.revenue + pnl.otherIncome,
      moneyOut: pnl.costOfSales + pnl.headOffice + pnl.financeCosts,
      net: pnl.netProfit,
    },
    pnl,
    clientsOwe,
    vendorsOwe,
    netPosition: pnl.netProfit - vendorsOwe.unpaid,
    warehouseStockValue,
    overhead: period.overhead,
    deposits,
    bpjsPayable,
    loanInterestDue,
    cashAtHand,
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
  if (metric === "cashAtHand") {
    const cashAtHand = await companyCashBalance(prisma, companyId).catch(() => 0);
    return emptyOverview(selection, { cashAtHand });
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
  if (metric === "loanInterestDue") {
    const calendar = financialReportCalendarRange(selection);
    const loanInterestDue = await sumLoanInterestDue(
      companyId,
      calendar.from,
      calendar.toExclusive
    );
    return emptyOverview(selection, { loanInterestDue });
  }
  return getFinancialReportOverviewData(companyId, selection);
}

