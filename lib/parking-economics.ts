import { allocateCompanyWages } from "@/lib/internal-payroll-wages";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { jakartaYearMonth, utcRangeForJakartaMonth } from "@/lib/vat";

export const DEFAULT_PARKING_CASUAL_TAX_PERCENT = 10;

export type ParkingDealTerms = {
  setupCost: number;
  profitSharePercent: number;
  monthlyClientFee: number;
  memberParkingUnitFee: number;
  memberParkingUnitCount: number;
  parkingTaxPercent: number;
};

export type ParkingMonthOutflow = {
  key: string;
  label: string;
  amount: number;
};

export type ParkingMonthEconomics = {
  year: number;
  month: number;
  revenue: number;
  casualRevenue: number;
  memberRevenue: number;
  taxOut: number;
  notes: string | null;
  deal: ParkingDealTerms;
  profitShareOwed: number;
  leaseOwed: number;
  setupOwed: number;
  purchasesOut: number;
  wagesOut: number;
  wageLines: Array<{
    employeeId: string;
    name: string;
    daysWorked: number;
    dailyRate: number;
    wageCost: number;
  }>;
  purchaseLines: Array<{
    id: string;
    supplierName: string;
    invoiceRef: string;
    amount: number;
  }>;
  outflows: ParkingMonthOutflow[];
  moneyOut: number;
  netProfit: number;
};

function roundIdr(value: number): number {
  return Math.round(value);
}

export function parkingDealFromProject(project: {
  setupCost?: Parameters<typeof decimalToNumber>[0];
  profitSharePercent?: Parameters<typeof decimalToNumber>[0];
  monthlyClientFee?: Parameters<typeof decimalToNumber>[0];
  memberParkingUnitFee?: Parameters<typeof decimalToNumber>[0];
  memberParkingUnitCount?: number | null;
  parkingTaxPercent?: Parameters<typeof decimalToNumber>[0];
}): ParkingDealTerms {
  const tax = decimalToNumber(project.parkingTaxPercent);
  return {
    setupCost: decimalToNumber(project.setupCost) ?? 0,
    profitSharePercent: decimalToNumber(project.profitSharePercent) ?? 0,
    monthlyClientFee: decimalToNumber(project.monthlyClientFee) ?? 0,
    memberParkingUnitFee: decimalToNumber(project.memberParkingUnitFee) ?? 0,
    memberParkingUnitCount:
      project.memberParkingUnitCount != null &&
      Number.isFinite(project.memberParkingUnitCount)
        ? Math.max(0, Math.round(project.memberParkingUnitCount))
        : 0,
    parkingTaxPercent:
      tax != null && tax >= 0 && tax <= 100
        ? tax
        : DEFAULT_PARKING_CASUAL_TAX_PERCENT,
  };
}

export function parkingMemberRevenue(deal: ParkingDealTerms): number {
  return roundIdr(deal.memberParkingUnitFee * deal.memberParkingUnitCount);
}

export function isSetupMonth(
  project: { startDate: Date | null; createdAt: Date },
  year: number,
  month: number
): boolean {
  const anchor = project.startDate ?? project.createdAt;
  const ym = jakartaYearMonth(anchor);
  return ym.year === year && ym.month === month;
}

export async function getProjectPurchaseOutflows(
  companyId: string,
  projectId: string,
  year: number,
  month: number
): Promise<Array<{ id: string; supplierName: string; invoiceRef: string; amount: number }>> {
  const { start, endExclusive } = utcRangeForJakartaMonth(year, month);
  const rows = await prisma.purchaseInvoice.findMany({
    where: {
      companyId,
      projectId,
      purpose: "PROJECT",
      paidAt: { gte: start, lt: endExclusive },
    },
    select: {
      id: true,
      supplierName: true,
      invoiceRef: true,
      amount: true,
    },
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    supplierName: row.supplierName,
    invoiceRef: row.invoiceRef,
    amount: decimalToNumber(row.amount) ?? 0,
  }));
}

export async function getProjectPurchaseOutflowsByProjectIds(
  companyId: string,
  projectIds: string[],
  from?: Date,
  toExclusive?: Date
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (projectIds.length === 0) return totals;
  const groups = await prisma.purchaseInvoice.groupBy({
    by: ["projectId"],
    where: {
      companyId,
      projectId: { in: projectIds },
      purpose: "PROJECT",
      paidAt: {
        not: null,
        ...(from ? { gte: from } : {}),
        ...(toExclusive ? { lt: toExclusive } : {}),
      },
    },
    _sum: { amount: true },
  });
  for (const row of groups) {
    if (!row.projectId) continue;
    totals.set(row.projectId, decimalToNumber(row._sum.amount) ?? 0);
  }
  return totals;
}

export async function getParkingMonthWages(
  projectId: string,
  year: number,
  month: number
): Promise<ParkingMonthEconomics["wageLines"]> {
  const { start, endExclusive } = utcRangeForJakartaMonth(year, month);
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { companyId: true },
  });
  if (!project) return [];

  const allocated = await allocateCompanyWages({
    companyId: project.companyId,
    from: start,
    toExclusive: endExclusive,
  });
  return (allocated.get(projectId) ?? [])
    .filter((row) => row.wageCost > 0 || row.daysWorked > 0)
    .map((row) => ({
      employeeId: row.employeeId,
      name: row.name,
      daysWorked: row.daysWorked,
      dailyRate: row.dailyRate,
      wageCost: row.wageCost,
    }));
}

export async function computeParkingMonthEconomics(options: {
  companyId: string;
  projectId: string;
  year: number;
  month: number;
}): Promise<ParkingMonthEconomics | null> {
  const project = await prisma.project.findFirst({
    where: { id: options.projectId, companyId: options.companyId },
    select: {
      id: true,
      startDate: true,
      createdAt: true,
      setupCost: true,
      profitSharePercent: true,
      monthlyClientFee: true,
      memberParkingUnitFee: true,
      memberParkingUnitCount: true,
      parkingTaxPercent: true,
      parkingMonthlyLogs: {
        where: { year: options.year, month: options.month },
        select: { revenueAmount: true, notes: true },
        take: 1,
      },
    },
  });
  if (!project) return null;

  const deal = parkingDealFromProject(project);
  const log = project.parkingMonthlyLogs[0] ?? null;
  const casualRevenue = decimalToNumber(log?.revenueAmount) ?? 0;
  const memberRevenue = parkingMemberRevenue(deal);
  const revenue = casualRevenue + memberRevenue;
  const taxOut = roundIdr((casualRevenue * deal.parkingTaxPercent) / 100);
  const profitShareOwed =
    deal.profitSharePercent > 0
      ? roundIdr((casualRevenue * deal.profitSharePercent) / 100)
      : 0;
  const leaseOwed = deal.monthlyClientFee > 0 ? deal.monthlyClientFee : 0;
  const setupOwed =
    deal.setupCost > 0 && isSetupMonth(project, options.year, options.month)
      ? deal.setupCost
      : 0;

  const [purchaseLines, wageLines] = await Promise.all([
    getProjectPurchaseOutflows(
      options.companyId,
      options.projectId,
      options.year,
      options.month
    ),
    getParkingMonthWages(options.projectId, options.year, options.month),
  ]);
  const purchasesOut = purchaseLines.reduce((sum, row) => sum + row.amount, 0);
  const wagesOut = wageLines.reduce((sum, row) => sum + row.wageCost, 0);

  const outflows: ParkingMonthOutflow[] = [];
  if (leaseOwed > 0) {
    outflows.push({ key: "lease", label: "Lease / Monthly Client Fee", amount: leaseOwed });
  }
  if (profitShareOwed > 0) {
    outflows.push({ key: "profitShare", label: "Profit Share", amount: profitShareOwed });
  }
  if (setupOwed > 0) {
    outflows.push({ key: "setup", label: "Setup Cost", amount: setupOwed });
  }
  if (purchasesOut > 0) {
    outflows.push({ key: "purchases", label: "Project Purchases", amount: purchasesOut });
  }
  if (wagesOut > 0) {
    outflows.push({ key: "wages", label: "Assigned Staff Wages", amount: wagesOut });
  }
  if (taxOut > 0) {
    outflows.push({ key: "tax", label: "Casual Parking Tax", amount: taxOut });
  }

  const moneyOut =
    leaseOwed + profitShareOwed + setupOwed + purchasesOut + wagesOut + taxOut;

  return {
    year: options.year,
    month: options.month,
    revenue,
    casualRevenue,
    memberRevenue,
    taxOut,
    notes: log?.notes ?? null,
    deal,
    profitShareOwed,
    leaseOwed,
    setupOwed,
    purchasesOut,
    wagesOut,
    wageLines,
    purchaseLines,
    outflows,
    moneyOut,
    netProfit: revenue - moneyOut,
  };
}

export async function computeParkingProjectTotals(
  companyId: string,
  projectIds: string[],
  from?: Date,
  toExclusive?: Date
): Promise<Map<string, { moneyIn: number; dealOut: number }>> {
  const totals = new Map<string, { moneyIn: number; dealOut: number }>();
  if (projectIds.length === 0) return totals;

  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds }, companyId, subCategory: "PARKING" },
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
      parkingMonthlyLogs: {
        select: { year: true, month: true, revenueAmount: true },
      },
    },
  });

  const now = jakartaYearMonth();

  for (const project of projects) {
    const deal = parkingDealFromProject(project);
    let moneyIn = 0;
    let dealOut = 0;
    const memberRevenue = parkingMemberRevenue(deal);
    const revenueByMonth = new Map<string, number>();
    for (const log of project.parkingMonthlyLogs) {
      const casual = decimalToNumber(log.revenueAmount) ?? 0;
      revenueByMonth.set(`${log.year}-${log.month}`, casual);
    }

    const startYm = jakartaYearMonth(project.startDate ?? project.createdAt);
    const endYm = project.endDate ? jakartaYearMonth(project.endDate) : now;
    const last =
      endYm.year > now.year || (endYm.year === now.year && endYm.month > now.month)
        ? now
        : endYm;

    let year = startYm.year;
    let month = startYm.month;
    while (year < last.year || (year === last.year && month <= last.month)) {
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      if (
        (from && monthStart.getTime() < from.getTime()) ||
        (toExclusive && monthStart.getTime() >= toExclusive.getTime())
      ) {
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
        continue;
      }
      const casual = revenueByMonth.get(`${year}-${month}`) ?? 0;
      moneyIn += casual + memberRevenue;
      if (deal.monthlyClientFee > 0) dealOut += deal.monthlyClientFee;
      if (deal.profitSharePercent > 0) {
        dealOut += roundIdr((casual * deal.profitSharePercent) / 100);
      }
      if (deal.parkingTaxPercent > 0) {
        dealOut += roundIdr((casual * deal.parkingTaxPercent) / 100);
      }
      if (deal.setupCost > 0 && isSetupMonth(project, year, month)) {
        dealOut += deal.setupCost;
      }
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    totals.set(project.id, { moneyIn, dealOut });
  }

  return totals;
}
