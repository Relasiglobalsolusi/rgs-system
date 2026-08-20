import { Prisma } from "@prisma/client";

import {
  commercialPeriodGross,
  recognizedIncomeAmount,
} from "@/lib/financial-report";
import {
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

export async function getWarehouseStockValue(companyId: string): Promise<number> {
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
      purpose: { not: "PETTY_CASH" },
      ...(clientId ? { project: { clientId } } : {}),
    },
    select: {
      amount: true,
      invoiceDate: true,
      vendor: { select: { paymentTermsDays: true } },
    },
  });

  let unpaid = 0;
  let overdue = 0;
  for (const invoice of invoices) {
    const amount = decimalToNumber(invoice.amount) ?? 0;
    unpaid += amount;
    const terms = invoice.vendor?.paymentTermsDays ?? 14;
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
  const agg = await prisma.purchaseInvoice.aggregate({
    where: {
      companyId,
      purpose,
      paidAt: {
        not: null,
        ...(from ? { gte: from } : {}),
        ...(toExclusive ? { lt: toExclusive } : {}),
      },
    },
    _sum: { amount: true },
  });
  return decimalToNumber(agg._sum.amount) ?? 0;
}

async function sumPaidInvoices(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<number> {
  const periods = await prisma.projectInvoicePeriod.findMany({
    where: {
      status: "PAID",
      project: { companyId, subCategory: { not: "INTERNAL" } },
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
  toExclusive?: Date
): Promise<number> {
  const sales = await prisma.inventorySale.findMany({
    where: {
      companyId,
      movement: { voidedAt: null },
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
    const wageWhen = period.wagesPaidAt ?? period.pdfLockedAt;
    if (wageWhen && inUtcRange(wageWhen, from, toExclusive)) {
      moneyOut += wages;
    } else if (!from && !toExclusive && (period.pdfLocked || period.wagesPaidAt)) {
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
  wageToExclusive?: Date
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
  ] = await Promise.all([
    sumPaidInvoices(companyId, from, toExclusive),
    sumSoldOff(companyId, from, toExclusive),
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
    total: overheadWages + internalPurchases + internalStock,
  };

  const moneyIn =
    paidIn + soldOff + payroll.moneyIn + parking.moneyIn + keptIncome;
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
    pettyCashOut;

  return { pair: pair(moneyIn, moneyOut), overhead };
}

export async function getFinancialReportOverviewData(
  companyId: string,
  selection: FinancialReportSelection
): Promise<FinancialReportOverview> {
  const calendar = financialReportCalendarRange(selection);
  const wage = financialReportWageRange(selection);

  const [period, clientsOwe, vendorsOwe, warehouseStockValue, deposits] =
    await Promise.all([
      periodPnl(
        companyId,
        calendar.from,
        calendar.toExclusive,
        wage.from,
        wage.toExclusive
      ),
      getClientsOwed(companyId),
      getVendorsOwed(companyId),
      getWarehouseStockValue(companyId),
      getSecurityDepositSnapshot(companyId),
    ]);

  return {
    selection,
    period: period.pair,
    clientsOwe,
    vendorsOwe,
    netPosition: period.pair.net - vendorsOwe.unpaid,
    warehouseStockValue,
    overhead: period.overhead,
    deposits,
  };
}

export function toDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(Math.round(value));
}
