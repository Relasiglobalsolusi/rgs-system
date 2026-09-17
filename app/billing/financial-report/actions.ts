"use server";

import { redirect } from "next/navigation";
import type { ProjectStatus, ProjectSubCategory } from "@prisma/client";

import {
  isLiveInvoiceIncome,
  liveInvoiceIncomeWhereFor,
  loadBooksOpenDate,
} from "@/lib/books-open";
import {
  getPayrollManagementTotalsByProjectIds,
  getProjectPnlAdjustments,
  getProjectWageCostsByProjectIds,
  listProjectWageCosts,
  commercialPeriodGross,
  recognizedIncomeAmount,
  profitMarginPercent,
  type ProjectWageEmployeeRow,
} from "@/lib/financial-report";
import { invoiceDueFromExclusive, type CommercialTaxKind } from "@/lib/commercial-tax";
import {
  bankAccountWhere,
  FINANCIAL_REPORT_ALL_BANKS,
  financialReportCalendarRange,
  financialReportWageRange,
  isSingleBankSelection,
  matchesBankAccount,
  type FinancialReportSelection,
} from "@/lib/financial-report-query";
import {
  listCompanyBankAccountOptions,
  type CompanyBankAccountOption,
} from "@/lib/company-bank-accounts";
import {
  FINANCIAL_REPORT_JOB_STATUSES,
  getClientsOwed,
  getClientsOwedByClientIds,
  getFinancialReportDetailOverview,
  getFinancialReportOverviewData,
  getVendorsOwed,
  type FinancialReportOverview,
  type OwedBucket,
} from "@/lib/financial-report-overview";
import {
  computeParkingProjectTotals,
  getProjectPurchaseOutflowsByProjectIds,
} from "@/lib/parking-economics";
import { getProjectPettyCashOutflowsByProjectIds } from "@/lib/petty-cash";
import {
  excludeEquipmentFromProjectInventoryCost,
  getProjectInventoryCost,
  listProjectInventoryIssues,
  type ProjectInventoryIssueRow,
} from "@/lib/inventory";
import {
  listProjectLostStockPayRecovery,
  type LostStockPayRecoveryRow,
} from "@/lib/internal-payroll-month";
import { prisma } from "@/lib/prisma";
import { isGcFacadeAwaitingPayment } from "@/lib/project-awaiting-payment";
import { canViewFinancialReport } from "@/lib/project-access";
import { decimalToNumber } from "@/lib/project-billing";
import { requireFinanceChild, toPermissionUser } from "@/lib/session";
import { isEquipmentItemType } from "@/lib/equipment-asset";
import {
  projectJobPnl,
  type FinancialReportPnlProjectNode,
} from "@/lib/financial-report-pnl";

export type FinancialReportScopeClient = {
  id: string;
  name: string;
};

export async function listFinancialReportBankAccounts(): Promise<
  CompanyBankAccountOption[]
> {
  const session = await requireFinancialReportAccess();
  return listCompanyBankAccountOptions(session.user.companyId);
}

export type FinancialReportClientRow = {
  id: string;
  name: string;
  projectCount: number;
  totalContractValue: number;
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  /** @deprecated alias of revenue */
  totalMoneyIn: number;
  /** @deprecated alias of costOfSales */
  totalSpending: number;
  /** @deprecated alias of grossProfit */
  profit: number;
  soldOffIncome: number;
  clientsOwe: OwedBucket;
  projects: FinancialReportPnlProjectNode[];
};

export type FinancialReportCompanyTotals = FinancialReportOverview;

export type FinancialReportProjectRow = {
  id: string;
  name: string;
  location: string | null;
  status: ProjectStatus;
  subCategory: ProjectSubCategory;
  contractValue: number | null;
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  moneyIn: number;
  /** Consumables used on the job + wages + tagged services. Not equipment. */
  moneyOut: number;
  inventoryOut: number;
  wagesOut: number;
  profit: number;
  awaitingPayment?: boolean;
  clientsOwe: OwedBucket;
};

type FinancialReportPaidLine = {
  id: string;
  label: string | null;
  amount: number;
  paidAt: Date | null;
  periodStart: Date;
  periodEnd: Date;
};

export type FinancialReportProjectDetail = {
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  location: string | null;
  status: ProjectStatus;
  subCategory: ProjectSubCategory;
  contractValue: number | null;
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  moneyIn: number;
  /** Consumables + wages. Equipment issued here is location only. */
  moneyOut: number;
  inventoryOut: number;
  wagesOut: number;
  purchasesOut: number;
  incidentsOut: number;
  parkingDealOut: number;
  profit: number;
  marginPercent: number | null;
  paidLines: FinancialReportPaidLine[];
  inventoryIssues: ProjectInventoryIssueRow[];
  wageLines: ProjectWageEmployeeRow[];
  payRecoveryLines: LostStockPayRecoveryRow[];
  payRecoveryOut: number;
  clientsOwe: OwedBucket;
};

const FINANCIAL_REPORT_PROJECT_WHERE = {
  status: { in: [...FINANCIAL_REPORT_JOB_STATUSES] },
  subCategory: { not: "INTERNAL" as const },
};

async function requireFinancialReportAccess() {
  const session = await requireFinanceChild("financialReport");
  const user = toPermissionUser(session);
  if (!canViewFinancialReport(user)) {
    redirect("/dashboard");
  }
  return session;
}

async function getProjectExpenseOutflowsByProjectIds(
  companyId: string,
  projectIds: string[],
  from?: Date,
  toExclusive?: Date,
  bank = FINANCIAL_REPORT_ALL_BANKS
) {
  const [purchases, petty] = await Promise.all([
    getProjectPurchaseOutflowsByProjectIds(
      companyId,
      projectIds,
      from,
      toExclusive,
      bank
    ),
    isSingleBankSelection(bank)
      ? Promise.resolve(new Map<string, number>())
      : getProjectPettyCashOutflowsByProjectIds(
          prisma,
          companyId,
          projectIds,
          from,
          toExclusive
        ).catch(() => new Map<string, number>()),
  ]);
  for (const [projectId, amount] of petty) {
    purchases.set(projectId, (purchases.get(projectId) ?? 0) + amount);
  }
  return purchases;
}

function outstandingFromPeriods(
  periods: {
    status: string;
    dueAt?: Date | null;
    amount: Parameters<typeof commercialPeriodGross>[0]["amount"];
    revisedInvoiceAmount: Parameters<
      typeof commercialPeriodGross
    >[0]["revisedInvoiceAmount"];
    ppnRatePercent?: Parameters<typeof commercialPeriodGross>[0]["ppnRatePercent"];
  }[],
  project: {
    chargedTaxKind?: CommercialTaxKind | "" | null;
    requiresTaxInvoice?: boolean | null;
    pphRatePercent?: Parameters<typeof commercialPeriodGross>[0]["amount"];
    isGovernmentContract?: boolean | null;
  }
): OwedBucket {
  const today = Date.now();
  let unpaid = 0;
  let overdue = 0;
  for (const period of periods) {
    if (
      period.status !== "AWAITING_PAYMENT" &&
      period.status !== "PENDING_VERIFICATION" &&
      period.status !== "OVERDUE"
    ) {
      continue;
    }
    const exclusive = commercialPeriodGross({
      amount: period.amount,
      revisedInvoiceAmount: period.revisedInvoiceAmount,
    });
    const amount = invoiceDueFromExclusive(
      exclusive,
      {
        chargedTaxKind: project.chargedTaxKind,
        requiresTaxInvoice: project.requiresTaxInvoice,
        pphRatePercent: decimalToNumber(project.pphRatePercent),
        isGovernmentContract: project.isGovernmentContract,
      },
      decimalToNumber(period.ppnRatePercent)
    );
    unpaid += amount;
    if (
      period.status === "OVERDUE" ||
      (period.dueAt != null && period.dueAt.getTime() < today)
    ) {
      overdue += amount;
    }
  }
  return { unpaid, overdue };
}

function sumPaidForProject(
  periods: {
    amount: Parameters<typeof decimalToNumber>[0];
    revisedInvoiceAmount: Parameters<typeof decimalToNumber>[0];
    ppnRatePercent?: Parameters<typeof decimalToNumber>[0];
  }[]
): number {
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

async function inventoryCostByProjectIds(
  companyId: string,
  projectIds: string[],
  from?: Date,
  toExclusive?: Date
): Promise<Map<string, number>> {
  const spendingByProject = new Map<string, number>();
  if (projectIds.length === 0) return spendingByProject;

  const costGroups = await prisma.inventoryMovement.groupBy({
    by: ["projectId"],
    where: {
      companyId,
      projectId: { in: projectIds },
      type: "ISSUE_TO_PROJECT",
      voidedAt: null,
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
  for (const row of costGroups) {
    if (!row.projectId) continue;
    spendingByProject.set(
      row.projectId,
      decimalToNumber(row._sum.totalCost) ?? 0
    );
  }
  return spendingByProject;
}

export async function listFinancialReportScopeClients(): Promise<
  FinancialReportScopeClient[]
> {
  const session = await requireFinancialReportAccess();
  const clients = await prisma.client.findMany({
    where: {
      companyId: session.user.companyId,
      active: true,
      projects: { some: FINANCIAL_REPORT_PROJECT_WHERE },
    },
    select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return clients;
}

export async function getFinancialReportClients(
  selection: FinancialReportSelection
): Promise<FinancialReportClientRow[]> {
  const session = await requireFinancialReportAccess();
  const companyId = session.user.companyId;
  const calendar = financialReportCalendarRange(selection);
  const wage = financialReportWageRange(selection);
  const bank = selection.bank ?? FINANCIAL_REPORT_ALL_BANKS;
  const singleBank = isSingleBankSelection(bank);
  const liveIncome = await liveInvoiceIncomeWhereFor(companyId);

  const clients = await prisma.client.findMany({
    where: {
      companyId,
      active: true,
      projects: { some: FINANCIAL_REPORT_PROJECT_WHERE },
    },
    include: {
      projects: {
        where: FINANCIAL_REPORT_PROJECT_WHERE,
        select: {
          id: true,
          name: true,
          location: true,
          status: true,
          subCategory: true,
          contractPrice: true,
          invoicePeriods: {
            where: {
              status: "PAID",
              ...liveIncome,
              paidAt: { gte: calendar.from, lt: calendar.toExclusive },
              ...bankAccountWhere(bank),
            },
            select: {
              amount: true,
              revisedInvoiceAmount: true,
              ppnRatePercent: true,
            },
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const projectIds = clients.flatMap((c) => c.projects.map((p) => p.id));
  const clientIds = clients.map((c) => c.id);
  const [
    inventoryByProject,
    wagesByProject,
    purchasesByProject,
    parkingByProject,
    payrollByProject,
    adjustmentsByProject,
    owedByClient,
  ] = await Promise.all([
    inventoryCostByProjectIds(
      companyId,
      singleBank ? [] : projectIds,
      calendar.from,
      calendar.toExclusive
    ),
    getProjectWageCostsByProjectIds(singleBank ? [] : projectIds, {
      companyId,
      from: wage.from,
      toExclusive: wage.toExclusive,
    }),
    getProjectExpenseOutflowsByProjectIds(
      companyId,
      projectIds,
      calendar.from,
      calendar.toExclusive,
      bank
    ),
    computeParkingProjectTotals(
      companyId,
      projectIds,
      calendar.from,
      calendar.toExclusive,
      bank
    ),
    getPayrollManagementTotalsByProjectIds(
      projectIds,
      calendar.from,
      calendar.toExclusive
    ),
    getProjectPnlAdjustments(companyId, projectIds, {
      year: selection.year,
      month: selection.month,
      from: calendar.from,
      toExclusive: calendar.toExclusive,
      bank,
    }),
    getClientsOwedByClientIds(companyId, clientIds),
  ]);

  return clients
    .map((client) => {
      let totalContractValue = 0;
      const projects: FinancialReportPnlProjectNode[] = [];

      for (const project of client.projects) {
        const contractValue = decimalToNumber(project.contractPrice) ?? 0;
        totalContractValue += contractValue;
        const purchasesOut = purchasesByProject.get(project.id) ?? 0;
        const incidents = adjustmentsByProject.get(project.id)?.incidents ?? 0;
        const job = projectJobPnl({
          subCategory: project.subCategory,
          paidInvoiceRevenue: sumPaidForProject(project.invoicePeriods),
          inventoryOut: inventoryByProject.get(project.id) ?? 0,
          wagesOut: wagesByProject.get(project.id) ?? 0,
          purchasesOut,
          parking: parkingByProject.get(project.id) ?? null,
          payroll: singleBank
            ? { moneyIn: 0, moneyOut: 0 }
            : payrollByProject.get(project.id) ?? null,
          incidents,
        });
        projects.push({
          id: project.id,
          name: project.name,
          location: project.location,
          status: project.status,
          subCategory: project.subCategory,
          contractValue,
          revenue: job.revenue,
          costOfSales: job.costOfSales,
          grossProfit: job.grossProfit,
        });
      }

      const revenue = projects.reduce((sum, row) => sum + row.revenue, 0);
      const costOfSales = projects.reduce((sum, row) => sum + row.costOfSales, 0);
      const grossProfit = revenue - costOfSales;

      return {
        id: client.id,
        name: client.name,
        projectCount: projects.length,
        totalContractValue,
        revenue,
        costOfSales,
        grossProfit,
        totalMoneyIn: revenue,
        totalSpending: costOfSales,
        profit: grossProfit,
        soldOffIncome: 0,
        clientsOwe: owedByClient.get(client.id) ?? { unpaid: 0, overdue: 0 },
        projects,
      };
    })
    .filter((row) => row.projectCount > 0);
}

export async function getFinancialReportCompanyTotals(
  selection: FinancialReportSelection
): Promise<FinancialReportCompanyTotals> {
  const session = await requireFinancialReportAccess();
  return getFinancialReportOverviewData(session.user.companyId, selection);
}

export async function getFinancialReportDetailTotals(
  selection: FinancialReportSelection,
  metric: string
): Promise<FinancialReportCompanyTotals> {
  const session = await requireFinancialReportAccess();
  return getFinancialReportDetailOverview(
    session.user.companyId,
    selection,
    metric
  );
}

export async function getFinancialReportClientProjects(
  clientId: string,
  selection: FinancialReportSelection
): Promise<{
  clientName: string;
  totalContractValue: number;
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  totalMoneyIn: number;
  totalSpending: number;
  profit: number;
  clientsOwe: OwedBucket;
  vendorsOwe: OwedBucket;
  netPosition: number;
  projects: FinancialReportProjectRow[];
} | null> {
  const session = await requireFinancialReportAccess();
  const companyId = session.user.companyId;
  const calendar = financialReportCalendarRange(selection);
  const wage = financialReportWageRange(selection);
  const bank = selection.bank ?? FINANCIAL_REPORT_ALL_BANKS;
  const singleBank = isSingleBankSelection(bank);
  const booksOpenDate = await loadBooksOpenDate(companyId);

  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId, active: true },
    include: {
      projects: {
        where: FINANCIAL_REPORT_PROJECT_WHERE,
        select: {
          id: true,
          name: true,
          location: true,
          status: true,
          subCategory: true,
          billingMode: true,
          contractPrice: true,
          chargedTaxKind: true,
          requiresTaxInvoice: true,
          pphRatePercent: true,
          isGovernmentContract: true,
          sortOrder: true,
          invoicePeriods: {
            select: {
              status: true,
              milestonePercent: true,
              amount: true,
              revisedInvoiceAmount: true,
              ppnRatePercent: true,
              paidAt: true,
              dueAt: true,
              isCatchUp: true,
              bankAccountId: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!client) return null;

  const projectIds = client.projects.map((p) => p.id);
  const [
    inventoryByProject,
    wagesByProject,
    purchasesByProject,
    parkingByProject,
    payrollByProject,
    adjustmentsByProject,
    clientsOwe,
    vendorsOwe,
  ] = await Promise.all([
    inventoryCostByProjectIds(
      companyId,
      singleBank ? [] : projectIds,
      calendar.from,
      calendar.toExclusive
    ),
    getProjectWageCostsByProjectIds(singleBank ? [] : projectIds, {
      companyId,
      from: wage.from,
      toExclusive: wage.toExclusive,
    }),
    getProjectExpenseOutflowsByProjectIds(
      companyId,
      projectIds,
      calendar.from,
      calendar.toExclusive,
      bank
    ),
    computeParkingProjectTotals(
      companyId,
      projectIds,
      calendar.from,
      calendar.toExclusive,
      bank
    ),
    getPayrollManagementTotalsByProjectIds(
      projectIds,
      calendar.from,
      calendar.toExclusive
    ),
    getProjectPnlAdjustments(companyId, projectIds, {
      year: selection.year,
      month: selection.month,
      from: calendar.from,
      toExclusive: calendar.toExclusive,
      bank,
    }),
    getClientsOwed(companyId, clientId),
    getVendorsOwed(companyId, clientId),
  ]);

  let totalContractValue = 0;

  const projects: FinancialReportProjectRow[] = client.projects.map(
    (project) => {
      const contractValue = decimalToNumber(project.contractPrice);
      const purchasesOut = purchasesByProject.get(project.id) ?? 0;
      const incidents = adjustmentsByProject.get(project.id)?.incidents ?? 0;
      const paidPeriods = project.invoicePeriods.filter((period) => {
        if (period.status !== "PAID") return false;
        if (!period.paidAt) return false;
        if (!matchesBankAccount(period.bankAccountId, bank)) return false;
        if (
          !isLiveInvoiceIncome({
            isCatchUp: period.isCatchUp,
            paidAt: period.paidAt,
            booksOpenDate,
          })
        ) {
          return false;
        }
        return (
          period.paidAt.getTime() >= calendar.from.getTime() &&
          period.paidAt.getTime() < calendar.toExclusive.getTime()
        );
      });
      const awaitingPayment = isGcFacadeAwaitingPayment({
        subCategory: project.subCategory,
        status: project.status,
        billingMode: project.billingMode,
        invoicePeriods: project.invoicePeriods,
      });
      const clientsOweForProject = outstandingFromPeriods(
        project.invoicePeriods,
        project
      );
      const inventoryOut = inventoryByProject.get(project.id) ?? 0;
      const wagesOut = wagesByProject.get(project.id) ?? 0;
      const job = projectJobPnl({
        subCategory: project.subCategory,
        paidInvoiceRevenue: sumPaidForProject(paidPeriods),
        inventoryOut,
        wagesOut,
        purchasesOut,
        parking: parkingByProject.get(project.id) ?? null,
        payroll: singleBank
          ? { moneyIn: 0, moneyOut: 0 }
          : payrollByProject.get(project.id) ?? null,
        incidents,
      });
      totalContractValue += contractValue ?? 0;
      return {
        id: project.id,
        name: project.name,
        location: project.location,
        status: project.status,
        subCategory: project.subCategory,
        contractValue,
        revenue: job.revenue,
        costOfSales: job.costOfSales,
        grossProfit: job.grossProfit,
        moneyIn: job.revenue,
        moneyOut: job.costOfSales,
        inventoryOut:
          project.subCategory === "PARKING" ? purchasesOut : inventoryOut,
        wagesOut:
          project.subCategory === "PAYROLL_MANAGEMENT"
            ? job.costOfSales - incidents
            : wagesOut,
        profit: job.grossProfit,
        awaitingPayment,
        clientsOwe: clientsOweForProject,
      };
    }
  );

  const revenue = projects.reduce((sum, row) => sum + row.revenue, 0);
  const costOfSales = projects.reduce((sum, row) => sum + row.costOfSales, 0);
  const grossProfit = revenue - costOfSales;
  return {
    clientName: client.name,
    totalContractValue,
    revenue,
    costOfSales,
    grossProfit,
    totalMoneyIn: revenue,
    totalSpending: costOfSales,
    profit: grossProfit,
    clientsOwe,
    vendorsOwe,
    netPosition: grossProfit - vendorsOwe.unpaid,
    projects,
  };
}

export async function getFinancialReportProjectDetail(
  clientId: string,
  projectId: string,
  selection: FinancialReportSelection
): Promise<FinancialReportProjectDetail | null> {
  const session = await requireFinancialReportAccess();
  const companyId = session.user.companyId;
  const calendar = financialReportCalendarRange(selection);
  const wage = financialReportWageRange(selection);
  const bank = selection.bank ?? FINANCIAL_REPORT_ALL_BANKS;
  const singleBank = isSingleBankSelection(bank);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      clientId,
      companyId,
      ...FINANCIAL_REPORT_PROJECT_WHERE,
      client: { active: true },
    },
    select: {
      id: true,
      name: true,
      location: true,
      status: true,
      subCategory: true,
      contractPrice: true,
      clientId: true,
      client: { select: { name: true } },
      invoicePeriods: {
        where: {
          status: "PAID",
          paidAt: { gte: calendar.from, lt: calendar.toExclusive },
          ...bankAccountWhere(bank),
        },
        select: {
          id: true,
          label: true,
          amount: true,
          revisedInvoiceAmount: true,
          ppnRatePercent: true,
          paidAt: true,
          periodStart: true,
          periodEnd: true,
        },
        orderBy: [{ paidAt: "desc" }, { periodStart: "desc" }],
      },
    },
  });

  if (!project?.clientId || !project.client) return null;

  const contractValue = decimalToNumber(project.contractPrice);
  const paidLines: FinancialReportPaidLine[] = project.invoicePeriods.map(
    (period) => ({
      id: period.id,
      label: period.label,
      amount: recognizedIncomeAmount({
        amount: period.amount,
        revisedInvoiceAmount: period.revisedInvoiceAmount,
        ppnRatePercent: period.ppnRatePercent,
      }),
      paidAt: period.paidAt,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    })
  );

  const [
    inventoryOutBase,
    inventoryIssues,
    wageLines,
    purchasesByProject,
    parkingByProject,
    payrollByProject,
    payRecoveryLines,
    incidentAgg,
    clientsOwe,
  ] = await Promise.all([
    getProjectInventoryCost(project.id, {
      companyId,
      from: calendar.from,
      toExclusive: calendar.toExclusive,
    }),
    listProjectInventoryIssues(project.id, {
      companyId,
      from: calendar.from,
      toExclusive: calendar.toExclusive,
    }),
    listProjectWageCosts(project.id, {
      companyId,
      from: wage.from,
      toExclusive: wage.toExclusive,
    }),
    getProjectExpenseOutflowsByProjectIds(
      companyId,
      [project.id],
      calendar.from,
      calendar.toExclusive,
      bank
    ),
    computeParkingProjectTotals(
      companyId,
      [project.id],
      calendar.from,
      calendar.toExclusive,
      bank
    ),
    getPayrollManagementTotalsByProjectIds(
      [project.id],
      calendar.from,
      calendar.toExclusive
    ),
    listProjectLostStockPayRecovery(project.id, companyId),
    prisma.projectExpense.aggregate({
      where: {
        projectId: project.id,
        amount: { gt: 0 },
        incurredAt: { gte: calendar.from, lt: calendar.toExclusive },
        ...bankAccountWhere(bank),
      },
      _sum: { amount: true },
    }),
    getClientsOwed(companyId, clientId, project.id, { includeCatchUp: true }),
  ]);

  let inventoryOut = singleBank ? 0 : inventoryOutBase;
  let wagesOut = singleBank
    ? 0
    : wageLines.reduce((sum, row) => sum + row.wageCost, 0);
  const purchasesOut = purchasesByProject.get(project.id) ?? 0;
  const periodPayRecovery = singleBank
    ? []
    : payRecoveryLines.filter((row) => {
        if (row.year !== selection.year) return false;
        return selection.month == null || row.month === selection.month;
      });
  const payRecoveryOut = periodPayRecovery.reduce(
    (sum, row) => sum + row.amount,
    0
  );
  const incidentOut = decimalToNumber(incidentAgg._sum.amount) ?? 0;
  const parkingDealOut = parkingByProject.get(project.id)?.dealOut ?? 0;
  const job = projectJobPnl({
    subCategory: project.subCategory,
    paidInvoiceRevenue: paidLines.reduce((sum, line) => sum + line.amount, 0),
    inventoryOut,
    wagesOut,
    purchasesOut,
    parking: parkingByProject.get(project.id) ?? null,
    payroll: singleBank
      ? { moneyIn: 0, moneyOut: 0 }
      : payrollByProject.get(project.id) ?? null,
    incidents: incidentOut,
  });
  if (project.subCategory === "PAYROLL_MANAGEMENT") {
    inventoryOut = 0;
    wagesOut = job.costOfSales - incidentOut;
  }

  return {
    clientId: project.clientId,
    clientName: project.client.name,
    projectId: project.id,
    projectName: project.name,
    location: project.location,
    status: project.status,
    subCategory: project.subCategory,
    contractValue,
    revenue: job.revenue,
    costOfSales: job.costOfSales,
    grossProfit: job.grossProfit,
    moneyIn: job.revenue,
    moneyOut: job.costOfSales,
    inventoryOut,
    wagesOut,
    purchasesOut,
    incidentsOut: incidentOut,
    parkingDealOut,
    profit: job.grossProfit,
    marginPercent: profitMarginPercent(job.revenue, job.grossProfit),
    paidLines,
    inventoryIssues: inventoryIssues.filter(
      (row) => !isEquipmentItemType(row.item.itemType)
    ),
    wageLines,
    payRecoveryLines: periodPayRecovery,
    payRecoveryOut,
    clientsOwe,
  };
}

