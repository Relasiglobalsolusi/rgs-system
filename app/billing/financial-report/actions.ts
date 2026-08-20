"use server";

import { redirect } from "next/navigation";
import type { ProjectStatus, ProjectSubCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  getPayrollManagementTotalsByProjectIds,
  getProjectPnlAdjustments,
  getProjectWageCostsByProjectIds,
  getSoldOffIncome,
  getSoldOffIncomeByClientIds,
  listProjectWageCosts,
  commercialPeriodGross,
  recognizedIncomeAmount,
  profitMarginPercent,
  type ProjectWageEmployeeRow,
} from "@/lib/financial-report";
import {
  financialReportCalendarRange,
  financialReportWageRange,
  type FinancialReportSelection,
} from "@/lib/financial-report-query";
import {
  FINANCIAL_REPORT_JOB_STATUSES,
  getClientsOwed,
  getClientsOwedByClientIds,
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
  sumProjectDepositReturns,
  type LostStockPayRecoveryRow,
} from "@/lib/internal-payroll-month";
import { prisma } from "@/lib/prisma";
import { isGcFacadeAwaitingPayment } from "@/lib/project-awaiting-payment";
import { canViewFinancialReport } from "@/lib/project-access";
import { decimalToNumber } from "@/lib/project-billing";
import { requireFinanceChild, toPermissionUser } from "@/lib/session";

export type FinancialReportScopeClient = {
  id: string;
  name: string;
};

export type FinancialReportClientRow = {
  id: string;
  name: string;
  projectCount: number;
  totalContractValue: number;
  totalMoneyIn: number;
  /** Inventory issues + assigned-employee wage cost + project purchases / parking / PM. */
  totalSpending: number;
  /** Money in − money out. */
  profit: number;
  soldOffIncome: number;
  clientsOwe: OwedBucket;
};

export type FinancialReportCompanyTotals = FinancialReportOverview;

export type FinancialReportProjectRow = {
  id: string;
  name: string;
  location: string | null;
  status: ProjectStatus;
  subCategory: ProjectSubCategory;
  contractValue: number | null;
  moneyIn: number;
  /** Inventory issues + assigned-employee wage cost + project purchases. */
  moneyOut: number;
  inventoryOut: number;
  wagesOut: number;
  /** Money in − money out. */
  profit: number;
  awaitingPayment?: boolean;
  clientsOwe: OwedBucket;
};

export type FinancialReportPaidLine = {
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
  moneyIn: number;
  /** Inventory + wages. */
  moneyOut: number;
  inventoryOut: number;
  wagesOut: number;
  /** Money in − money out. */
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
  toExclusive?: Date
) {
  const [purchases, petty] = await Promise.all([
    getProjectPurchaseOutflowsByProjectIds(
      companyId,
      projectIds,
      from,
      toExclusive
    ),
    getProjectPettyCashOutflowsByProjectIds(
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
  }[]
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
    const amount = commercialPeriodGross({
      amount: period.amount,
      revisedInvoiceAmount: period.revisedInvoiceAmount,
    });
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
          contractPrice: true,
          subCategory: true,
          invoicePeriods: {
            where: {
              status: "PAID",
              paidAt: { gte: calendar.from, lt: calendar.toExclusive },
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
    soldOffByClient,
    adjustmentsByProject,
    owedByClient,
  ] = await Promise.all([
    inventoryCostByProjectIds(
      companyId,
      projectIds,
      calendar.from,
      calendar.toExclusive
    ),
    getProjectWageCostsByProjectIds(projectIds, {
      companyId,
      from: wage.from,
      toExclusive: wage.toExclusive,
    }),
    getProjectExpenseOutflowsByProjectIds(
      companyId,
      projectIds,
      calendar.from,
      calendar.toExclusive
    ),
    computeParkingProjectTotals(
      companyId,
      projectIds,
      calendar.from,
      calendar.toExclusive
    ),
    getPayrollManagementTotalsByProjectIds(
      projectIds,
      calendar.from,
      calendar.toExclusive
    ),
    getSoldOffIncomeByClientIds(
      companyId,
      clientIds,
      calendar.from,
      calendar.toExclusive
    ),
    getProjectPnlAdjustments(companyId, projectIds, {
      year: selection.year,
      month: selection.month,
      from: calendar.from,
      toExclusive: calendar.toExclusive,
    }),
    getClientsOwedByClientIds(companyId, clientIds),
  ]);

  return clients
    .map((client) => {
      let totalContractValue = 0;
      let totalMoneyIn = soldOffByClient.get(client.id) ?? 0;
      let totalSpending = 0;

      for (const project of client.projects) {
        totalContractValue += decimalToNumber(project.contractPrice) ?? 0;
        const purchasesOut = purchasesByProject.get(project.id) ?? 0;
        const adj = adjustmentsByProject.get(project.id);
        const depositReturned = adj?.depositReturned ?? 0;
        const keptDeposit = adj?.keptDeposit ?? 0;
        const payRecovery = adj?.payRecovery ?? 0;
        const incidents = adj?.incidents ?? 0;
        if (project.subCategory === "PARKING") {
          const parking = parkingByProject.get(project.id);
          totalMoneyIn += (parking?.moneyIn ?? 0) + keptDeposit + payRecovery;
          totalSpending +=
            (parking?.dealOut ?? 0) +
            purchasesOut +
            (wagesByProject.get(project.id) ?? 0) +
            depositReturned +
            incidents;
          continue;
        }
        if (project.subCategory === "PAYROLL_MANAGEMENT") {
          const payroll = payrollByProject.get(project.id);
          totalMoneyIn += (payroll?.moneyIn ?? 0) + keptDeposit + payRecovery;
          totalSpending +=
            (payroll?.moneyOut ?? 0) + depositReturned + incidents;
          continue;
        }
        totalMoneyIn +=
          sumPaidForProject(project.invoicePeriods) +
          keptDeposit +
          payRecovery;
        totalSpending +=
          (inventoryByProject.get(project.id) ?? 0) +
          (wagesByProject.get(project.id) ?? 0) +
          purchasesOut +
          depositReturned +
          incidents;
      }

      return {
        id: client.id,
        name: client.name,
        projectCount: client.projects.length,
        totalContractValue,
        totalMoneyIn,
        totalSpending,
        profit: totalMoneyIn - totalSpending,
        soldOffIncome: soldOffByClient.get(client.id) ?? 0,
        clientsOwe: owedByClient.get(client.id) ?? { unpaid: 0, overdue: 0 },
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

export async function getFinancialReportClientProjects(
  clientId: string,
  selection: FinancialReportSelection
): Promise<{
  clientName: string;
  totalContractValue: number;
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
    clientSoldOff,
    adjustmentsByProject,
    clientsOwe,
    vendorsOwe,
  ] = await Promise.all([
    inventoryCostByProjectIds(
      companyId,
      projectIds,
      calendar.from,
      calendar.toExclusive
    ),
    getProjectWageCostsByProjectIds(projectIds, {
      companyId,
      from: wage.from,
      toExclusive: wage.toExclusive,
    }),
    getProjectExpenseOutflowsByProjectIds(
      companyId,
      projectIds,
      calendar.from,
      calendar.toExclusive
    ),
    computeParkingProjectTotals(
      companyId,
      projectIds,
      calendar.from,
      calendar.toExclusive
    ),
    getPayrollManagementTotalsByProjectIds(
      projectIds,
      calendar.from,
      calendar.toExclusive
    ),
    getSoldOffIncome({
      companyId,
      clientId,
      from: calendar.from,
      toExclusive: calendar.toExclusive,
    }),
    getProjectPnlAdjustments(companyId, projectIds, {
      year: selection.year,
      month: selection.month,
      from: calendar.from,
      toExclusive: calendar.toExclusive,
    }),
    getClientsOwed(companyId, clientId),
    getVendorsOwed(companyId, clientId),
  ]);

  let totalContractValue = 0;
  let totalMoneyIn = clientSoldOff;
  let totalSpending = 0;

  const projects: FinancialReportProjectRow[] = client.projects.map(
    (project) => {
      const contractValue = decimalToNumber(project.contractPrice);
      const purchasesOut = purchasesByProject.get(project.id) ?? 0;
      const adj = adjustmentsByProject.get(project.id);
      const depositReturned = adj?.depositReturned ?? 0;
      const keptDeposit = adj?.keptDeposit ?? 0;
      const payRecovery = adj?.payRecovery ?? 0;
      const incidents = adj?.incidents ?? 0;
      const paidPeriods = project.invoicePeriods.filter((period) => {
        if (period.status !== "PAID") return false;
        if (!period.paidAt) return false;
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
        project.invoicePeriods
      );
      let moneyIn = sumPaidForProject(paidPeriods);
      let inventoryOut = inventoryByProject.get(project.id) ?? 0;
      let wagesOut = wagesByProject.get(project.id) ?? 0;
      if (project.subCategory === "PARKING") {
        const parking = parkingByProject.get(project.id);
        moneyIn = parking?.moneyIn ?? 0;
        inventoryOut = purchasesOut;
        wagesOut = wagesByProject.get(project.id) ?? 0;
        moneyIn += keptDeposit + payRecovery;
        const moneyOut =
          (parking?.dealOut ?? 0) +
          purchasesOut +
          wagesOut +
          depositReturned +
          incidents;
        totalContractValue += contractValue ?? 0;
        totalMoneyIn += moneyIn;
        totalSpending += moneyOut;
        return {
          id: project.id,
          name: project.name,
          location: project.location,
          status: project.status,
          subCategory: project.subCategory,
          contractValue,
          moneyIn,
          moneyOut,
          inventoryOut,
          wagesOut,
          profit: moneyIn - moneyOut,
          awaitingPayment,
          clientsOwe: clientsOweForProject,
        };
      }
      if (project.subCategory === "PAYROLL_MANAGEMENT") {
        const payroll = payrollByProject.get(project.id);
        moneyIn = payroll?.moneyIn ?? 0;
        wagesOut = payroll?.moneyOut ?? 0;
        inventoryOut = 0;
        moneyIn += keptDeposit + payRecovery;
        const moneyOut = wagesOut + depositReturned + incidents;
        totalContractValue += contractValue ?? 0;
        totalMoneyIn += moneyIn;
        totalSpending += moneyOut;
        return {
          id: project.id,
          name: project.name,
          location: project.location,
          status: project.status,
          subCategory: project.subCategory,
          contractValue,
          moneyIn,
          moneyOut,
          inventoryOut,
          wagesOut,
          profit: moneyIn - moneyOut,
          awaitingPayment,
          clientsOwe: clientsOweForProject,
        };
      }
      moneyIn += keptDeposit + payRecovery;
      const moneyOut =
        inventoryOut + wagesOut + purchasesOut + depositReturned + incidents;
      totalContractValue += contractValue ?? 0;
      totalMoneyIn += moneyIn;
      totalSpending += moneyOut;

      const profit = moneyIn - moneyOut;

      return {
        id: project.id,
        name: project.name,
        location: project.location,
        status: project.status,
        subCategory: project.subCategory,
        contractValue,
        moneyIn,
        moneyOut,
        inventoryOut,
        wagesOut,
        profit,
        awaitingPayment,
        clientsOwe: clientsOweForProject,
      };
    }
  );

  const profit = totalMoneyIn - totalSpending;
  return {
    clientName: client.name,
    totalContractValue,
    totalMoneyIn,
    totalSpending,
    profit,
    clientsOwe,
    vendorsOwe,
    netPosition: profit - vendorsOwe.unpaid,
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

  let moneyIn = paidLines.reduce((sum, line) => sum + line.amount, 0);
  const [
    inventoryOutBase,
    inventoryIssues,
    wageLines,
    purchasesByProject,
    parkingByProject,
    payrollByProject,
    payRecoveryLines,
    depositReturned,
    keptDepositIn,
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
      calendar.toExclusive
    ),
    computeParkingProjectTotals(
      companyId,
      [project.id],
      calendar.from,
      calendar.toExclusive
    ),
    getPayrollManagementTotalsByProjectIds(
      [project.id],
      calendar.from,
      calendar.toExclusive
    ),
    listProjectLostStockPayRecovery(project.id, companyId),
    sumProjectDepositReturns(project.id, companyId, {
      year: selection.year,
      month: selection.month,
    }),
    Promise.resolve(0),
    prisma.projectExpense.aggregate({
      where: {
        projectId: project.id,
        incurredAt: { gte: calendar.from, lt: calendar.toExclusive },
      },
      _sum: { amount: true },
    }),
    getClientsOwed(companyId, clientId, project.id),
  ]);
  let inventoryOut = inventoryOutBase;
  let wagesOut = wageLines.reduce((sum, row) => sum + row.wageCost, 0);
  const purchasesOut = purchasesByProject.get(project.id) ?? 0;
  const periodPayRecovery = payRecoveryLines.filter((row) => {
    if (row.year !== selection.year) return false;
    return selection.month == null || row.month === selection.month;
  });
  const payRecoveryOut = periodPayRecovery.reduce(
    (sum, row) => sum + row.amount,
    0
  );
  const incidentOut = decimalToNumber(incidentAgg._sum.amount) ?? 0;
  let moneyOut =
    inventoryOut + wagesOut + purchasesOut + depositReturned + incidentOut;
  if (project.subCategory === "PARKING") {
    const parking = parkingByProject.get(project.id);
    moneyIn = parking?.moneyIn ?? 0;
    inventoryOut = purchasesOut;
    moneyOut = (parking?.dealOut ?? 0) + purchasesOut + wagesOut + incidentOut;
  } else if (project.subCategory === "PAYROLL_MANAGEMENT") {
    const payroll = payrollByProject.get(project.id);
    moneyIn = payroll?.moneyIn ?? 0;
    inventoryOut = 0;
    wagesOut = payroll?.moneyOut ?? 0;
    moneyOut = wagesOut + incidentOut;
  }
  moneyIn += keptDepositIn + payRecoveryOut;
  const profit = moneyIn - moneyOut;

  return {
    clientId: project.clientId,
    clientName: project.client.name,
    projectId: project.id,
    projectName: project.name,
    location: project.location,
    status: project.status,
    subCategory: project.subCategory,
    contractValue,
    moneyIn,
    moneyOut,
    inventoryOut,
    wagesOut,
    profit,
    marginPercent: profitMarginPercent(moneyIn, profit),
    paidLines,
    inventoryIssues,
    wageLines,
    payRecoveryLines: periodPayRecovery,
    payRecoveryOut,
    clientsOwe,
  };
}
