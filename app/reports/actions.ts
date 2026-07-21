"use server";

import { revalidatePath } from "next/cache";
import type { ProjectSubCategory } from "@prisma/client";
import { getServerLocale } from "@/lib/i18n/locale";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import {
  buildMonthlyReport,
  type MonthlyReportData,
  type ProjectMonthlyReport,
} from "@/lib/monthly-report";
import { getProjectWhereForUser } from "@/lib/project-access";

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
      // Legacy locked snapshots may omit subCategory — resolve from live projects.
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

export async function getMonthlyReport(
  year: number,
  month: number,
  filters: MonthlyReportFilters = {}
): Promise<MonthlyReportData & { locked: boolean }> {
  const session = await requireModule("reports");

  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
  });

  const existing = await prisma.invoiceCompilation.findUnique({
    where: {
      companyId_year_month: {
        companyId: session.user.companyId,
        year,
        month,
      },
    },
  });

  if (existing?.locked && existing.snapshotData) {
    const snapshot = existing.snapshotData as unknown as MonthlyReportData;
    let scopedProjects = snapshot.projects ?? [];

    if (session.user.clientId) {
      const allowed = await prisma.project.findMany({
        where: {
          companyId: session.user.companyId,
          clientId: session.user.clientId,
        },
        select: { id: true },
      });
      const allowedIds = new Set(allowed.map((project) => project.id));
      scopedProjects = scopedProjects.filter((project) =>
        allowedIds.has(project.projectId)
      );
    }

    return {
      ...snapshot,
      projects: await applyReportFilters(
        session.user.companyId,
        scopedProjects,
        filters
      ),
      locked: true,
    };
  }

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
    locked: existing?.locked ?? false,
  };
}

export async function lockMonthlyReport(year: number, month: number) {
  const session = await requireModule("reports");

  if (session.user.clientId) {
    throw new Error("Client portal users cannot lock monthly reports.");
  }

  const locale = await getServerLocale();
  const report = await buildMonthlyReport(
    session.user.companyId,
    year,
    month,
    {},
    locale
  );

  await prisma.invoiceCompilation.upsert({
    where: {
      companyId_year_month: {
        companyId: session.user.companyId,
        year,
        month,
      },
    },
    update: {
      locked: true,
      snapshotData: report,
      createdById: session.user.id,
    },
    create: {
      companyId: session.user.companyId,
      year,
      month,
      locked: true,
      snapshotData: report,
      createdById: session.user.id,
    },
  });

  revalidatePath("/reports");
}
