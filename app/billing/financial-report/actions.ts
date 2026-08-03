"use server";

import { redirect } from "next/navigation";
import type { ProjectStatus, ProjectSubCategory } from "@prisma/client";

import {
  getProjectWageCostsByProjectIds,
  listProjectWageCosts,
  paidPeriodAmount,
  profitMarginPercent,
  type ProjectWageEmployeeRow,
} from "@/lib/financial-report";
import {
  excludeEquipmentFromProjectInventoryCost,
  getProjectInventoryCost,
  listProjectInventoryIssues,
  type ProjectInventoryIssueRow,
} from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { canViewFinancialReport } from "@/lib/project-access";
import { decimalToNumber } from "@/lib/project-billing";
import { requireFinanceChild, toPermissionUser } from "@/lib/session";

export type FinancialReportClientRow = {
  id: string;
  name: string;
  projectCount: number;
  totalContractValue: number;
  totalMoneyIn: number;
  /** Inventory issues + assigned-employee wage cost. */
  totalSpending: number;
  /** Contract value − spending. */
  profit: number;
};

export type FinancialReportProjectRow = {
  id: string;
  name: string;
  location: string | null;
  status: ProjectStatus;
  subCategory: ProjectSubCategory;
  contractValue: number | null;
  moneyIn: number;
  /** Inventory issues + assigned-employee wage cost. */
  moneyOut: number;
  inventoryOut: number;
  wagesOut: number;
  /** Contract value − money out when contract value is set; else money in − money out. */
  profit: number;
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
};

/** Only In Progress projects appear in Financial Report (Planning excluded). */
const FINANCIAL_REPORT_PROJECT_STATUS = "IN_PROGRESS" as const;

// TODO(FR): Include InventorySale.totalPrice (non-voided SOLD_OFF) in company/yearly
// money-in / income aggregations. Sale proceeds are stored on InventorySale; do not
// treat SOLD_OFF movements as project expense (they have no projectId).

async function requireFinancialReportAccess() {
  const session = await requireFinanceChild("financialReport");
  const user = toPermissionUser(session);
  if (!canViewFinancialReport(user)) {
    redirect("/dashboard");
  }
  return session;
}

function sumPaidForProject(
  periods: {
    amount: Parameters<typeof decimalToNumber>[0];
    revisedInvoiceAmount: Parameters<typeof decimalToNumber>[0];
  }[],
  contractPrice: Parameters<typeof decimalToNumber>[0]
): number {
  return periods.reduce(
    (sum, period) =>
      sum +
      paidPeriodAmount({
        amount: period.amount,
        revisedInvoiceAmount: period.revisedInvoiceAmount,
        projectContractPrice: contractPrice,
      }),
    0
  );
}

async function inventoryCostByProjectIds(
  companyId: string,
  projectIds: string[]
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

export async function getFinancialReportClients(): Promise<
  FinancialReportClientRow[]
> {
  const session = await requireFinancialReportAccess();
  const companyId = session.user.companyId;

  const clients = await prisma.client.findMany({
    where: {
      companyId,
      active: true,
      projects: { some: { status: FINANCIAL_REPORT_PROJECT_STATUS } },
    },
    include: {
      projects: {
        where: { status: FINANCIAL_REPORT_PROJECT_STATUS },
        select: {
          id: true,
          contractPrice: true,
          invoicePeriods: {
            where: { status: "PAID" },
            select: {
              amount: true,
              revisedInvoiceAmount: true,
            },
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const projectIds = clients.flatMap((c) => c.projects.map((p) => p.id));
  const [inventoryByProject, wagesByProject] = await Promise.all([
    inventoryCostByProjectIds(companyId, projectIds),
    getProjectWageCostsByProjectIds(projectIds, { companyId }),
  ]);

  return clients
    .map((client) => {
      let totalContractValue = 0;
      let totalMoneyIn = 0;
      let totalSpending = 0;

      for (const project of client.projects) {
        totalContractValue += decimalToNumber(project.contractPrice) ?? 0;
        totalMoneyIn += sumPaidForProject(
          project.invoicePeriods,
          project.contractPrice
        );
        totalSpending +=
          (inventoryByProject.get(project.id) ?? 0) +
          (wagesByProject.get(project.id) ?? 0);
      }

      return {
        id: client.id,
        name: client.name,
        projectCount: client.projects.length,
        totalContractValue,
        totalMoneyIn,
        totalSpending,
        profit: totalContractValue - totalSpending,
      };
    })
    .filter((row) => row.projectCount > 0);
}

export async function getFinancialReportClientProjects(
  clientId: string
): Promise<{
  clientName: string;
  totalContractValue: number;
  totalMoneyIn: number;
  totalSpending: number;
  profit: number;
  projects: FinancialReportProjectRow[];
} | null> {
  const session = await requireFinancialReportAccess();
  const companyId = session.user.companyId;

  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId, active: true },
    include: {
      projects: {
        where: { status: FINANCIAL_REPORT_PROJECT_STATUS },
        select: {
          id: true,
          name: true,
          location: true,
          status: true,
          subCategory: true,
          contractPrice: true,
          sortOrder: true,
          invoicePeriods: {
            where: { status: "PAID" },
            select: {
              amount: true,
              revisedInvoiceAmount: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!client) return null;

  const projectIds = client.projects.map((p) => p.id);
  const [inventoryByProject, wagesByProject] = await Promise.all([
    inventoryCostByProjectIds(companyId, projectIds),
    getProjectWageCostsByProjectIds(projectIds, { companyId }),
  ]);

  let totalContractValue = 0;
  let totalMoneyIn = 0;
  let totalSpending = 0;

  const projects: FinancialReportProjectRow[] = client.projects.map(
    (project) => {
      const contractValue = decimalToNumber(project.contractPrice);
      const moneyIn = sumPaidForProject(
        project.invoicePeriods,
        project.contractPrice
      );
      const inventoryOut = inventoryByProject.get(project.id) ?? 0;
      const wagesOut = wagesByProject.get(project.id) ?? 0;
      const moneyOut = inventoryOut + wagesOut;
      totalContractValue += contractValue ?? 0;
      totalMoneyIn += moneyIn;
      totalSpending += moneyOut;

      const profit =
        contractValue != null ? contractValue - moneyOut : moneyIn - moneyOut;

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
      };
    }
  );

  return {
    clientName: client.name,
    totalContractValue,
    totalMoneyIn,
    totalSpending,
    profit: totalContractValue - totalSpending,
    projects,
  };
}

export async function getFinancialReportProjectDetail(
  clientId: string,
  projectId: string
): Promise<FinancialReportProjectDetail | null> {
  const session = await requireFinancialReportAccess();
  const companyId = session.user.companyId;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      clientId,
      companyId,
      status: FINANCIAL_REPORT_PROJECT_STATUS,
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
        where: { status: "PAID" },
        select: {
          id: true,
          label: true,
          amount: true,
          revisedInvoiceAmount: true,
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
      amount: paidPeriodAmount({
        amount: period.amount,
        revisedInvoiceAmount: period.revisedInvoiceAmount,
        projectContractPrice: project.contractPrice,
      }),
      paidAt: period.paidAt,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    })
  );

  const moneyIn = paidLines.reduce((sum, line) => sum + line.amount, 0);
  const [inventoryOut, inventoryIssues, wageLines] = await Promise.all([
    getProjectInventoryCost(project.id, { companyId }),
    listProjectInventoryIssues(project.id, { companyId }),
    listProjectWageCosts(project.id, { companyId }),
  ]);
  const wagesOut = wageLines.reduce((sum, row) => sum + row.wageCost, 0);
  const moneyOut = inventoryOut + wagesOut;
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
  };
}
