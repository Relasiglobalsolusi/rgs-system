"use server";

import type { ProjectSubCategory } from "@prisma/client";
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

export async function getReportClients(): Promise<ReportClientRow[]> {
  const session = await requireModule("reports");
  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
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
    userId: session.user.id,
    username: session.user.username,
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
    userId: session.user.id,
    username: session.user.username,
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
