"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { nextSortOrderFromMax, sortOrdersForIds } from "@/lib/reorder";
import {
  getEmployeeForUser,
  requireModule,
  toPermissionUser,
} from "@/lib/session";
import { canManageProjects } from "@/lib/project-access";
import { saveUpload } from "@/lib/upload";
import {
  contractCyclePeriodBounds,
  formatDateInput,
  parseDateInput,
  resolveContractCycleIndex,
  toUtcDateOnly,
} from "@/lib/invoice-period";
import { isCleaningProjectSubCategory } from "@/lib/project-subcategory";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";

async function progressError(key: string) {
  const locale = await getServerLocale();
  return new Error(translate(locale, `pages.progress.errors.${key}`));
}

/**
 * For MONTHLY (Regular) projects, attach reports to the anniversary cycle that
 * contains the report date (from real contract startDate).
 * For MILESTONE projects, leave invoicePeriodId null until a milestone invoice compiles them.
 */
async function ensureOngoingPeriod(projectId: string, reportDate: Date) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { billingMode: true, startDate: true },
  });

  if (!project || project.billingMode !== "MONTHLY" || !project.startDate) {
    return null;
  }

  const contractStart = toUtcDateOnly(project.startDate);
  const cycleIndex = resolveContractCycleIndex(contractStart, reportDate);
  const { periodStart, periodEnd, label } = contractCyclePeriodBounds(
    contractStart,
    cycleIndex
  );

  const existing = await prisma.projectInvoicePeriod.findUnique({
    where: {
      projectId_periodStart_periodEnd: {
        projectId,
        periodStart,
        periodEnd,
      },
    },
  });

  if (existing) return existing;

  return prisma.projectInvoicePeriod.create({
    data: {
      projectId,
      periodStart,
      periodEnd,
      label,
      status: "ONGOING",
    },
  });
}

export async function createProgressReport(formData: FormData) {
  const session = await requireModule("progress");
  const employee = await getEmployeeForUser(session.user.id);

  if (!employee) throw await progressError("employeeProfileNotFound");

  if (employee.placement !== "ON_PROJECT") {
    throw await progressError("onProjectOnly");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  // UI label: "Service Area" (zone cleaned). Kept as stageLabel in DB.
  const stageLabel = String(formData.get("stageLabel") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const photos = formData.getAll("photos") as File[];

  if (!projectId) throw await progressError("projectRequired");
  if (!stageLabel) throw await progressError("serviceAreaRequired");
  if (!notes) throw await progressError("notesRequired");

  const validPhotos = photos.filter((photo) => photo && photo.size > 0);
  if (validPhotos.length === 0) {
    throw await progressError("photoRequired");
  }

  const reportDate = dateStr
    ? parseDateInput(dateStr)
    : toUtcDateOnly(new Date());

  const assignment = await prisma.projectAssignment.findUnique({
    where: {
      projectId_employeeId: {
        projectId,
        employeeId: employee.id,
      },
    },
    include: {
      project: {
        select: { companyId: true, subCategory: true, status: true },
      },
    },
  });

  if (!assignment) {
    throw await progressError("notAssigned");
  }

  if (assignment.project.companyId !== session.user.companyId) {
    throw await progressError("notAssigned");
  }

  if (!isCleaningProjectSubCategory(assignment.project.subCategory)) {
    throw await progressError("cleaningOnly");
  }

  if (assignment.project.status !== "IN_PROGRESS") {
    throw await progressError("inProgressOnly");
  }

  const period = await ensureOngoingPeriod(projectId, reportDate);

  const topSort = await prisma.progressReport.findFirst({
    where: { project: { companyId: session.user.companyId } },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const report = await prisma.progressReport.create({
    data: {
      projectId,
      employeeId: employee.id,
      reportDate,
      stageLabel,
      notes,
      status: "SUBMITTED",
      sortOrder: nextSortOrderFromMax(topSort?.sortOrder),
      invoicePeriodId:
        period &&
        (period.status === "ONGOING" || period.status === "COMPILING")
          ? period.id
          : null,
    },
  });

  for (const photo of validPhotos) {
    const url = await saveUpload(photo, "uploads/progress");
    await prisma.progressReportPhoto.create({
      data: {
        progressReportId: report.id,
        url,
      },
    });
  }

  // Keep project status active when staff are reporting.
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "IN_PROGRESS" },
  });

  revalidatePath("/progress");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");

  return { id: report.id, date: formatDateInput(reportDate) };
}

export async function reorderProgressReports(ids: string[]) {
  const session = await requireModule("progress");
  const permissionUser = toPermissionUser(session);
  // Match UI: only project managers may reorder (not every progress viewer).
  if (!canManageProjects(permissionUser)) {
    throw await progressError("reorderDenied");
  }

  const companyId = session.user.companyId;
  if (!companyId) throw await progressError("companyNotFound");

  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw await progressError("nothingToReorder");
  }
  if (uniqueIds.length !== ids.length) {
    throw await progressError("duplicateReorderIds");
  }

  const existing = await prisma.progressReport.findMany({
    where: {
      id: { in: uniqueIds },
      project: { companyId },
    },
    select: { id: true },
  });

  if (existing.length !== uniqueIds.length) {
    throw await progressError("invalidReorderIds");
  }

  const updates = sortOrdersForIds(uniqueIds);
  await prisma.$transaction(async (tx) => {
    for (const { id, sortOrder } of updates) {
      await tx.progressReport.update({
        where: { id },
        data: { sortOrder },
      });
    }
  });

  revalidatePath("/progress");
  revalidatePath("/dashboard");
}

/** Persist dismissal of missing progress-report warning(s) for the signed-in user. */
export async function acknowledgeProgressWarnings(
  items: { projectId: string; date: string }[]
) {
  const session = await requireModule("progress");
  if (!items.length) return { count: 0 };

  const employee = await getEmployeeForUser(session.user.id);
  if (!employee) throw await progressError("employeeProfileNotFound");

  const normalized = items
    .map((item) => ({
      projectId: String(item.projectId ?? "").trim(),
      date: String(item.date ?? "").trim(),
    }))
    .filter((item) => item.projectId && item.date);

  if (normalized.length === 0) return { count: 0 };

  const projectIds = [...new Set(normalized.map((i) => i.projectId))];
  const assignments = await prisma.projectAssignment.findMany({
    where: {
      employeeId: employee.id,
      projectId: { in: projectIds },
      project: { companyId: session.user.companyId },
    },
    select: { projectId: true },
  });
  const assigned = new Set(assignments.map((a) => a.projectId));

  const rows = normalized
    .filter((item) => assigned.has(item.projectId))
    .map((item) => ({
      userId: session.user.id,
      projectId: item.projectId,
      reportDate: parseDateInput(item.date),
    }));

  if (rows.length === 0) return { count: 0 };

  await prisma.$transaction(
    rows.map((row) =>
      prisma.progressWarningAck.upsert({
        where: {
          userId_projectId_reportDate: {
            userId: row.userId,
            projectId: row.projectId,
            reportDate: row.reportDate,
          },
        },
        create: row,
        update: { acknowledgedAt: new Date() },
      })
    )
  );

  revalidatePath("/progress");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  for (const projectId of projectIds) {
    revalidatePath(`/projects/${projectId}`);
  }

  return { count: rows.length };
}
