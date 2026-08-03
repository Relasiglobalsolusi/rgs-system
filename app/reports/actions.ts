"use server";

import type { ProjectSubCategory } from "@prisma/client";
import { getServerLocale } from "@/lib/i18n/locale";
import { prisma } from "@/lib/prisma";
import {
  buildProjectMonthlyDayFeed,
  type ProjectMonthlyDayFeed,
} from "@/lib/project-monthly-feed";
import {
  getReportPeriodBounds,
  isReportPeriodInBounds,
  type ReportPeriodBounds,
} from "@/lib/report-period-bounds";
import { requireModule } from "@/lib/session";
import {
  buildMonthlyReport,
  type MonthlyReportData,
  type ProjectMonthlyReport,
} from "@/lib/monthly-report";
import { getProjectWhereForUser } from "@/lib/project-access";

export type ReportClientRow = {
  id: string;
  name: string;
  projectCount: number;
};

export type ReportProjectRow = {
  id: string;
  name: string;
  location: string | null;
  subCategory: ProjectSubCategory;
  reportCount: number;
};

export type MonthlyReportFilters = {
  subCategory?: ProjectSubCategory;
  /** Case-insensitive project name / client / location search. */
  q?: string;
};

function matchesReportSearch(
  query: string | undefined,
  project: ProjectMonthlyReport
) {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return true;

  return [project.projectName, project.clientName, project.location].some(
    (field) => field?.toLowerCase().includes(normalized)
  );
}

async function applyReportFilters(
  companyId: string,
  projects: ProjectMonthlyReport[],
  filters: MonthlyReportFilters
) {
  let result = projects;

  if (filters.subCategory) {
    const hasSubCategories = result.every((project) => project.subCategory);
    if (hasSubCategories) {
      result = result.filter(
        (project) => project.subCategory === filters.subCategory
      );
    } else {
      // Some rows may omit subCategory — resolve from live projects.
      const matching = await prisma.project.findMany({
        where: {
          companyId,
          subCategory: filters.subCategory,
          id: { in: result.map((project) => project.projectId) },
        },
        select: { id: true },
      });
      const allowed = new Set(matching.map((project) => project.id));
      result = result.filter((project) => allowed.has(project.projectId));
    }
  }

  return result.filter((project) => matchesReportSearch(filters.q, project));
}

export async function getReportClients(): Promise<ReportClientRow[]> {
  const session = await requireModule("reports");
  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
  });

  const clients = await prisma.client.findMany({
    where: {
      companyId: session.user.companyId,
      active: true,
      ...(session.user.clientId ? { id: session.user.clientId } : {}),
      projects: { some: projectWhere },
    },
    include: {
      projects: {
        where: projectWhere,
        select: { id: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return clients
    .map((client) => ({
      id: client.id,
      name: client.name,
      projectCount: client.projects.length,
    }))
    .filter((client) => client.projectCount > 0);
}

export async function getReportProjectsForClient(
  clientId: string
): Promise<{ clientName: string; projects: ReportProjectRow[] } | null> {
  const session = await requireModule("reports");

  if (session.user.clientId && session.user.clientId !== clientId) {
    return null;
  }

  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
  });

  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      companyId: session.user.companyId,
      active: true,
    },
    include: {
      projects: {
        where: projectWhere,
        select: {
          id: true,
          name: true,
          location: true,
          subCategory: true,
          _count: { select: { progressReports: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!client) return null;

  return {
    clientName: client.name,
    projects: client.projects.map((project) => ({
      id: project.id,
      name: project.name,
      location: project.location,
      subCategory: project.subCategory,
      reportCount: project._count.progressReports,
    })),
  };
}

export type ReportProjectContext = {
  projectName: string;
  clientName: string;
  bounds: ReportPeriodBounds;
};

async function getAccessibleReportProject(
  clientId: string,
  projectId: string
) {
  const session = await requireModule("reports");

  if (session.user.clientId && session.user.clientId !== clientId) {
    return null;
  }

  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
  });

  return prisma.project.findFirst({
    where: {
      id: projectId,
      clientId,
      companyId: session.user.companyId,
      ...projectWhere,
    },
    select: {
      id: true,
      name: true,
      startDate: true,
      estimatedStartDate: true,
      endDate: true,
      createdAt: true,
      client: { select: { name: true } },
    },
  });
}

export async function getReportProjectContext(
  clientId: string,
  projectId: string
): Promise<ReportProjectContext | null> {
  const project = await getAccessibleReportProject(clientId, projectId);
  if (!project?.client) return null;

  return {
    projectName: project.name,
    clientName: project.client.name,
    bounds: getReportPeriodBounds(project),
  };
}

export async function getProjectMonthlyDayFeedForUser(
  clientId: string,
  projectId: string,
  year: number,
  month: number
): Promise<ProjectMonthlyDayFeed | null> {
  const project = await getAccessibleReportProject(clientId, projectId);
  if (!project?.client) return null;

  const bounds = getReportPeriodBounds(project);
  if (!isReportPeriodInBounds(year, month, bounds)) return null;

  return buildProjectMonthlyDayFeed(projectId, year, month);
}

export async function getMonthlyReport(
  year: number,
  month: number,
  filters: MonthlyReportFilters = {}
): Promise<MonthlyReportData> {
  const session = await requireModule("reports");

  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
  });

  const locale = await getServerLocale();
  const report = await buildMonthlyReport(
    session.user.companyId,
    year,
    month,
    {
      ...projectWhere,
      ...(filters.subCategory ? { subCategory: filters.subCategory } : {}),
    },
    locale
  );

  return {
    ...report,
    projects: await applyReportFilters(
      session.user.companyId,
      report.projects,
      filters
    ),
  };
}
