"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { nextSortOrderFromMax } from "@/lib/reorder";
import { getEmployeeForUser, requireModule } from "@/lib/session";
import {
  ensureLeaveEmploymentSyncedForUser,
  getOperationsBlockedErrorKey,
  isEmployeeActiveForOperations,
  jakartaTodayAsUtcDateOnly,
} from "@/lib/leave-employment-status";
import { deleteLocalUpload, saveUpload } from "@/lib/upload";
import {
  customDayCyclePeriodBounds,
  formatDateInput,
  monthPeriodBounds,
  parseDateInput,
  resolveBillingCycleDays,
  resolveCustomDayCycleIndex,
  toUtcDateOnly,
} from "@/lib/invoice-period";
import {
  findOpenCicoAttendance,
  hasOpenCicoForProjectWorkDay,
} from "@/lib/cico-attendance";
import { canSubmitFieldProgressReport } from "@/lib/cico-access";
import { usesInvoicePeriods } from "@/lib/project-billing";
import { isProjectOpenForSiteWork } from "@/lib/project-status";
import {
  isBackupAssignmentActiveOnJakartaDay,
  tryPostPartTimePayForCompletedDay,
} from "@/lib/petty-cash";
import {
  isProgressEligibleProjectSubCategory,
  isInternalProjectSubCategory,
} from "@/lib/project-subcategory";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";

const PROGRESS_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Reasonable per-file cap — no artificial count limit on photos per report. */
const MAX_PROGRESS_PHOTO_BYTES = 10 * 1024 * 1024;

async function progressError(key: string) {
  const locale = await getServerLocale();
  return new Error(translate(locale, `pages.progress.errors.${key}`));
}

async function requireSyncedActiveEmployee(userId: string) {
  const employee =
    (await ensureLeaveEmploymentSyncedForUser(userId)) ??
    (await getEmployeeForUser(userId));

  if (!employee) throw await progressError("employeeProfileNotFound");

  if (!isEmployeeActiveForOperations(employee.status)) {
    throw await progressError(getOperationsBlockedErrorKey(employee.status));
  }

  return employee;
}

async function requireSyncedEmployee(userId: string) {
  const employee =
    (await ensureLeaveEmploymentSyncedForUser(userId)) ??
    (await getEmployeeForUser(userId));

  if (!employee) throw await progressError("employeeProfileNotFound");

  return employee;
}

async function assertCanCreateProgressReport(
  employee: { id: string; status: string },
  projectId: string,
  reportDate: Date
) {
  if (isEmployeeActiveForOperations(employee.status)) return;

  if (employee.status === "ON_LEAVE") {
    const hasOpenCheckout = await hasOpenCicoForProjectWorkDay(
      employee.id,
      projectId,
      reportDate
    );
    if (hasOpenCheckout) return;
  }

  throw await progressError(getOperationsBlockedErrorKey(employee.status));
}

/**
 * Create requires an open CICO for the selected project; report date must match
 * that attendance work day (overnight-aware). Free-date create without check-in
 * is not allowed.
 */
async function assertOpenCicoRequiredForCreate(
  employeeId: string,
  projectId: string,
  reportDate: Date
) {
  const open = await findOpenCicoAttendance(employeeId);
  if (!open?.record?.checkIn || open.record.checkOut || !open.record.projectId) {
    throw await progressError("checkInRequired");
  }
  if (open.record.projectId !== projectId) {
    throw await progressError("checkInRequiredForProject");
  }

  const workDay = toUtcDateOnly(open.record.date);
  if (toUtcDateOnly(reportDate).getTime() !== workDay.getTime()) {
    throw await progressError("reportDateMustMatchCico");
  }
}

function sameUtcDate(a: Date, b: Date) {
  return toUtcDateOnly(a).getTime() === toUtcDateOnly(b).getTime();
}

function collectPhotoFiles(formData: FormData, field = "photos"): File[] {
  return (formData.getAll(field) as File[]).filter(
    (photo) => photo && typeof photo === "object" && "size" in photo && photo.size > 0
  );
}

async function assertValidProgressPhotos(photos: File[]) {
  for (const photo of photos) {
    if (!PROGRESS_IMAGE_TYPES.has(photo.type)) {
      throw await progressError("photoMustBeImage");
    }
    if (photo.size > MAX_PROGRESS_PHOTO_BYTES) {
      throw await progressError("photoTooLarge");
    }
  }
}

/**
 * For MONTHLY (Regular) projects, attach reports to the anniversary cycle that
 * contains the report date (from real contract startDate).
 * For MILESTONE projects, leave invoicePeriodId null until a milestone invoice compiles them.
 */
async function ensureOngoingPeriod(projectId: string, reportDate: Date) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      billingMode: true,
      startDate: true,
      subCategory: true,
      billingPeriodBasis: true,
      billingCycleStartDay: true,
      billingCycleEndDay: true,
    },
  });

  if (
    !project ||
    project.billingMode !== "MONTHLY" ||
    !project.startDate ||
    !usesInvoicePeriods(project.subCategory)
  ) {
    return null;
  }

  const contractStart = toUtcDateOnly(project.startDate);
  const basis = project.billingPeriodBasis ?? "CONTRACT_CYCLE";
  const days = resolveBillingCycleDays(
    contractStart,
    project.billingCycleStartDay,
    project.billingCycleEndDay
  );
  const { periodStart, periodEnd, label } =
    basis === "CALENDAR_MONTH"
      ? monthPeriodBounds(reportDate)
      : customDayCyclePeriodBounds(
          days.fromDay,
          days.toDay,
          resolveCustomDayCycleIndex(
            days.fromDay,
            days.toDay,
            contractStart,
            reportDate
          ),
          contractStart
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

function revalidateProgressPaths(projectId: string) {
  revalidatePath("/progress");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/cico");
}

export async function createProgressReport(formData: FormData) {
  const session = await requireModule("progress");
  const employee = await requireSyncedEmployee(session.user.id);

  if (employee.placement !== "ON_PROJECT") {
    throw await progressError("onProjectOnly");
  }

  // Cleaning positions + Security staff (Security projects). Not a CICO checkout gate.
  if (!canSubmitFieldProgressReport(employee)) {
    throw await progressError("cleaningPositionOnly");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  // UI label: "Service Area" (zone cleaned). Kept as stageLabel in DB.
  const stageLabel = String(formData.get("stageLabel") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const photos = collectPhotoFiles(formData);

  if (!projectId) throw await progressError("projectRequired");
  if (!stageLabel) throw await progressError("serviceAreaRequired");
  if (!notes) throw await progressError("notesRequired");

  if (photos.length === 0) {
    throw await progressError("photoRequired");
  }
  await assertValidProgressPhotos(photos);

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
  if (
    assignment.isBackup &&
    !isBackupAssignmentActiveOnJakartaDay(assignment, reportDate)
  ) {
    throw await progressError("backupWindow");
  }

  if (assignment.project.companyId !== session.user.companyId) {
    throw await progressError("notAssigned");
  }

  // Desk HO cannot submit — exception: assigned to an Internal (HO/Warehouse) cleaning site.
  if (
    employee.employeeType === "HEAD_OFFICE" &&
    !isInternalProjectSubCategory(assignment.project.subCategory)
  ) {
    throw await progressError("headOfficeNotAllowed");
  }

  if (!isProgressEligibleProjectSubCategory(assignment.project.subCategory)) {
    throw await progressError("cleaningOnly");
  }

  if (!isProjectOpenForSiteWork(assignment.project.status)) {
    throw await progressError("inProgressOnly");
  }

  // Cleaning: open CICO required. Security: anytime (separate service requirement).
  if (assignment.project.subCategory !== "SECURITY") {
    await assertOpenCicoRequiredForCreate(employee.id, projectId, reportDate);
  }
  await assertCanCreateProgressReport(employee, projectId, reportDate);

  const period = isInternalProjectSubCategory(assignment.project.subCategory)
    ? null
    : await ensureOngoingPeriod(projectId, reportDate);

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

  for (const photo of photos) {
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

  await tryPostPartTimePayForCompletedDay({
    employeeId: employee.id,
    projectId,
    workDay: reportDate,
  });

  revalidateProgressPaths(projectId);
  revalidatePath("/billing/petty-cash");

  return { id: report.id, date: formatDateInput(reportDate) };
}

/**
 * Edit an existing progress report (service area, notes, photos).
 * Author only — managers and clients are view-only.
 * Editable only while reportDate is still Asia/Jakarta today.
 */
export async function updateProgressReport(formData: FormData) {
  const session = await requireModule("progress");
  const employee = await requireSyncedActiveEmployee(session.user.id);

  if (!canSubmitFieldProgressReport(employee)) {
    throw await progressError("cleaningPositionOnly");
  }

  const reportId = String(formData.get("reportId") ?? "").trim();
  if (!reportId) throw await progressError("reportNotFound");

  const stageLabel = String(formData.get("stageLabel") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const keepPhotoIds = formData
    .getAll("keepPhotoIds")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const newPhotos = collectPhotoFiles(formData);

  if (!stageLabel) throw await progressError("serviceAreaRequired");
  if (!notes) throw await progressError("notesRequired");
  if (!dateStr) throw await progressError("dateRequired");

  await assertValidProgressPhotos(newPhotos);

  const existing = await prisma.progressReport.findFirst({
    where: {
      id: reportId,
      project: { companyId: session.user.companyId },
    },
    include: {
      photos: { select: { id: true, url: true } },
      project: {
        select: { id: true, companyId: true, subCategory: true, status: true },
      },
    },
  });

  if (!existing) throw await progressError("reportNotFound");

  if (existing.employeeId !== employee.id) {
    throw await progressError("editDenied");
  }

  // Same-day lock: after the Jakarta calendar day ends, edit is blocked.
  if (!sameUtcDate(existing.reportDate, jakartaTodayAsUtcDateOnly())) {
    throw await progressError("editDayLocked");
  }

  if (!isProgressEligibleProjectSubCategory(existing.project.subCategory)) {
    throw await progressError("cleaningOnly");
  }

  const existingPhotoIds = new Set(existing.photos.map((p) => p.id));
  const keptIds = keepPhotoIds.filter((id) => existingPhotoIds.has(id));
  if (keptIds.length + newPhotos.length === 0) {
    throw await progressError("photoRequired");
  }

  // Staff cannot reassign a report to another calendar day.
  const reportDate = parseDateInput(dateStr);
  if (!sameUtcDate(reportDate, existing.reportDate)) {
    throw await progressError("reportDateLocked");
  }
  const lockedReportDate = toUtcDateOnly(existing.reportDate);
  const period = await ensureOngoingPeriod(existing.projectId, lockedReportDate);

  const removedPhotos = existing.photos.filter((p) => !keptIds.includes(p.id));
  const uploadedUrls: string[] = [];
  for (const photo of newPhotos) {
    uploadedUrls.push(await saveUpload(photo, "uploads/progress"));
  }

  await prisma.$transaction(async (tx) => {
    await tx.progressReport.update({
      where: { id: reportId },
      data: {
        stageLabel,
        notes,
        reportDate: lockedReportDate,
        invoicePeriodId:
          period &&
          (period.status === "ONGOING" || period.status === "COMPILING")
            ? period.id
            : existing.invoicePeriodId,
      },
    });

    if (removedPhotos.length > 0) {
      await tx.progressReportPhoto.deleteMany({
        where: { id: { in: removedPhotos.map((p) => p.id) } },
      });
    }

    for (const url of uploadedUrls) {
      await tx.progressReportPhoto.create({
        data: {
          progressReportId: reportId,
          url,
        },
      });
    }
  });

  for (const photo of removedPhotos) {
    await deleteLocalUpload(photo.url);
  }

  revalidateProgressPaths(existing.projectId);

  return { id: reportId, date: formatDateInput(lockedReportDate) };
}
