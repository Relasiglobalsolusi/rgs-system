"use server";

import { revalidatePath } from "next/cache";
import type {
  EmployeeType,
  EmploymentStatus,
  InternalHomeSite,
  Placement,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule, getEmployeeForUser, toPermissionUser } from "@/lib/session";
import {
  isHoAdminAccount,
} from "@/lib/permissions";
import {
  haversineDistanceMeters,
  isWithinGeofence,
  resolveGeofenceRadiusMeters,
} from "@/lib/geo";
import {
  isEarlyCheckOut,
  isLateCheckIn,
  resolveExpectedShiftStart,
} from "@/lib/operating-hours";
import { toUtcDateOnly } from "@/lib/invoice-period";
import { resolveCicoWorkDay } from "@/lib/cico-work-day";
import { findOpenCicoAttendance } from "@/lib/cico-attendance";
import {
  isFieldCicoEligibleProjectSubCategory,
  isInternalProjectSubCategory,
} from "@/lib/project-subcategory";
import { isProjectOpenForSiteWork } from "@/lib/project-status";
import {
  isBackupAssignmentActiveOnJakartaDay,
  tryPostPartTimePayForCompletedDay,
} from "@/lib/petty-cash";
import { saveUpload } from "@/lib/upload";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { applyResignIfLastDayReached } from "@/lib/employee-resign";
import { releaseExpiredBackupCrew } from "@/lib/workforce-crew";
import {
  ensureLeaveEmploymentSyncedForUser,
  getOperationsBlockedErrorKey,
  isEmployeeActiveForOperations,
  syncEmployeeLeaveEmploymentStatus,
} from "@/lib/leave-employment-status";
import {
  canUseOfficeCico,
  internalHomeSiteToProjectName,
  isOfficeClockEarlyLeave,
  isOfficeClockLate,
} from "@/lib/office-cico";
import {
  isCicoFieldEligible,
  requiresCicoProgressReport,
} from "@/lib/cico-access";

/** Hard gate: check-out requires ≥1 Progress Report for this employee × project × work day. */
async function hasProgressReportForWorkDay(
  employeeId: string,
  projectId: string,
  workDay: Date
) {
  const reportDate = toUtcDateOnly(workDay);
  const count = await prisma.progressReport.count({
    where: {
      employeeId,
      projectId,
      reportDate,
    },
  });
  return count > 0;
}

async function cicoError(
  key: string,
  params?: Record<string, string | number>
) {
  const locale = await getServerLocale();
  return new Error(translate(locale, `pages.cico.errors.${key}`, params));
}

async function requireCicoPhoto(formData: FormData, kind: "checkIn" | "checkOut") {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size <= 0) {
    throw await cicoError(
      kind === "checkIn" ? "photoRequired" : "checkOutPhotoRequired"
    );
  }
  if (!photo.type.startsWith("image/")) {
    throw await cicoError(
      kind === "checkIn" ? "photoMustBeImage" : "checkOutPhotoMustBeImage"
    );
  }
  return photo;
}

type CicoCheckInEmployee = {
  id: string;
  companyId: string;
  placement: Placement;
  employeeType: EmployeeType;
  internalHomeSite: InternalHomeSite;
  status: EmploymentStatus;
  archivedFromDirectory: boolean;
  progressExempt: boolean;
  jobPosition?: { name?: string | null; slug?: string | null } | null;
};

async function getProjectForCicoCheckIn(
  employee: CicoCheckInEmployee,
  projectId: string,
  adminFieldMode: boolean
) {
  if (adminFieldMode) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw await cicoError("selectProject");
    }

    if (!isProjectOpenForSiteWork(project.status)) {
      throw await cicoError("inProgressOnly");
    }

    if (project.latitude == null || project.longitude == null) {
      throw await cicoError("noSiteLocation");
    }

    const assignment = await prisma.projectAssignment.findFirst({
      where: { employeeId: employee.id, projectId },
    });
    if (
      assignment &&
      !isBackupAssignmentActiveOnJakartaDay(assignment)
    ) {
      throw await cicoError("backupWindow");
    }

    return {
      project,
      assignment: {
        shiftStart: assignment?.shiftStart ?? null,
        shiftEnd: assignment?.shiftEnd ?? null,
      },
      mode: isInternalProjectSubCategory(project.subCategory)
        ? ("office" as const)
        : ("field" as const),
    };
  }

  // Cleaning assignment wins over office clock.
  const assigned = await prisma.projectAssignment.findFirst({
    where: { employeeId: employee.id, projectId },
    select: { id: true },
  });
  if (assigned || isCicoFieldEligible(employee)) {
    return getAssignedProjectForEmployee(employee.id, projectId);
  }

  if (canUseOfficeCico(employee)) {
    return getOfficeHomeProjectForEmployee(employee, projectId);
  }

  throw await cicoError("onProjectOnly");
}

async function getAssignedProjectForEmployee(
  employeeId: string,
  projectId: string
) {
  const assignment = await prisma.projectAssignment.findFirst({
    where: { employeeId, projectId },
    include: { project: true },
  });

  if (!assignment) {
    throw await cicoError("notAssigned");
  }
  if (!isBackupAssignmentActiveOnJakartaDay(assignment)) {
    throw await cicoError("backupWindow");
  }

  const project = assignment.project;

  if (!isFieldCicoEligibleProjectSubCategory(project.subCategory)) {
    throw await cicoError("cleaningOnly");
  }

  if (
    !isProjectOpenForSiteWork(project.status) ||
    project.pendingEarlyEndReconcile
  ) {
    throw await cicoError("inProgressOnly");
  }

  if (project.latitude == null || project.longitude == null) {
    throw await cicoError("noSiteLocation");
  }

  return { project, assignment, mode: "field" as const };
}

/** Office clock: HO/Warehouse desk staff check into their home Internal site (no assignment). */
async function getOfficeHomeProjectForEmployee(
  employee: {
    id: string;
    companyId: string;
    internalHomeSite: InternalHomeSite;
  },
  projectId: string
) {
  const expectedName = internalHomeSiteToProjectName(employee.internalHomeSite);
  if (!expectedName) {
    throw await cicoError("selectProject");
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      companyId: employee.companyId,
      status: { in: ["IN_PROGRESS", "WAITING_FOR_APPROVAL"] },
      OR: [{ subCategory: "INTERNAL" }, { name: expectedName }],
    },
  });

  if (!project) {
    throw await cicoError("selectProject");
  }

  // Must match the employee's home site (HO ops → Head Office, warehouse → Warehouse).
  const { isAttendanceHeadOfficeName, isAttendanceWarehouseName } = await import(
    "@/lib/attendance-internal-sites"
  );
  const nameOk =
    (employee.internalHomeSite === "HEAD_OFFICE_OPERATIONS" &&
      isAttendanceHeadOfficeName(project.name)) ||
    (employee.internalHomeSite === "WAREHOUSE" &&
      isAttendanceWarehouseName(project.name));
  if (!nameOk) {
    throw await cicoError("selectProject");
  }

  if (project.latitude == null || project.longitude == null) {
    throw await cicoError("noSiteLocation");
  }

  return {
    project,
    assignment: { shiftStart: "09:00", shiftEnd: "17:00" },
    mode: "office" as const,
  };
}

async function parseCoords(formData: FormData) {
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw await cicoError("locationRequired");
  }

  return { latitude, longitude };
}

/** CICO always acts as the signed-in user's linked employee — never trust client ids. */
async function requireCicoSessionEmployee(formData?: FormData) {
  const session = await requireModule("cico");
  const adminFieldMode = isHoAdminAccount(toPermissionUser(session));

  // Client portal accounts never use CICO (employees only).
  if (session.user.clientId) {
    throw await cicoError("employeeAccountsOnly");
  }

  if (formData?.has("employeeId")) {
    throw await cicoError("invalidRequest");
  }

  // Sync leave status first, then reload with jobPosition (office CICO exemption).
  await ensureLeaveEmploymentSyncedForUser(session.user.id);
  if (session.user.companyId) {
    await releaseExpiredBackupCrew(prisma as never, session.user.companyId);
  }
  const employee = await getEmployeeForUser(session.user.id);
  if (!employee) throw await cicoError("employeeProfileNotFound");

  if (employee.archivedFromDirectory) {
    throw await cicoError("inactiveEmployee");
  }

  if (adminFieldMode) {
    return { session, employee, adminFieldMode: true as const };
  }

  if (isCicoFieldEligible(employee) || canUseOfficeCico(employee)) {
    return { session, employee, adminFieldMode: false as const };
  }

  throw await cicoError("onProjectOnly");
}

async function requireCicoEmployeeForCheckIn(formData?: FormData) {
  const { session, employee, adminFieldMode } =
    await requireCicoSessionEmployee(formData);

  if (adminFieldMode) {
    return { session, employee, adminFieldMode };
  }

  if (!isEmployeeActiveForOperations(employee.status)) {
    throw await cicoError(getOperationsBlockedErrorKey(employee.status));
  }

  return { session, employee, adminFieldMode };
}

async function requireCicoEmployeeForCheckOut(formData?: FormData) {
  const { session, employee, adminFieldMode } =
    await requireCicoSessionEmployee(formData);

  if (adminFieldMode) {
    return { session, employee, adminFieldMode };
  }

  if (isEmployeeActiveForOperations(employee.status)) {
    return { session, employee, adminFieldMode };
  }

  if (employee.status === "ON_LEAVE") {
    const open = await findOpenCicoAttendance(employee.id);
    if (open?.record?.checkIn && !open.record.checkOut) {
      return { session, employee, adminFieldMode };
    }
  }

  throw await cicoError(getOperationsBlockedErrorKey(employee.status));
}

export async function checkIn(formData: FormData) {
  const { employee, adminFieldMode } = await requireCicoEmployeeForCheckIn(formData);

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw await cicoError("selectProject");

  const { latitude, longitude } = await parseCoords(formData);
  const { project, assignment, mode } = await getProjectForCicoCheckIn(
    employee,
    projectId,
    adminFieldMode
  );

  const radius = resolveGeofenceRadiusMeters(project.locationRadiusMeters);
  const distance = haversineDistanceMeters(
    latitude,
    longitude,
    project.latitude!,
    project.longitude!
  );

  if (
    !isWithinGeofence(
      latitude,
      longitude,
      project.latitude!,
      project.longitude!,
      radius
    )
  ) {
    const siteLabel = project.location
      ? `${project.name} (${project.location})`
      : project.name;
    throw await cicoError("tooFarCheckIn", {
      distance: Math.round(distance),
      site: siteLabel,
      radius,
    });
  }

  const now = new Date();
  // Overnight-aware Asia/Jakarta work day — one check-in / one check-out per shift day.
  const workDay = resolveCicoWorkDay(
    assignment.shiftStart,
    assignment.shiftEnd,
    now
  );

  const openSession = await prisma.attendance.findFirst({
    where: {
      employeeId: employee.id,
      checkIn: { not: null },
      checkOut: null,
    },
    include: { project: { select: { name: true } } },
    orderBy: { checkIn: "desc" },
  });
  if (openSession) {
    throw await cicoError("mustCheckOutBeforeNextSite", {
      site: openSession.project?.name ?? "site 1",
    });
  }

  const existingForSite = await prisma.attendance.findFirst({
    where: {
      employeeId: employee.id,
      date: workDay,
      projectId: project.id,
    },
  });

  if (existingForSite?.checkIn) {
    throw await cicoError("alreadyCheckedIn");
  }

  const photo = await requireCicoPhoto(formData, "checkIn");
  const checkInPhotoUrl = await saveUpload(photo, "uploads/cico");

  const checkInAt = now;
  const expectedStart =
    mode === "office"
      ? "09:00"
      : resolveExpectedShiftStart(assignment);
  const late =
    mode === "office"
      ? isOfficeClockLate(checkInAt)
      : isLateCheckIn(checkInAt, expectedStart);
  const lateNote =
    late === true && expectedStart
      ? translate(
          await getServerLocale(),
          "pages.cico.errors.lateCheckInNote",
          { time: expectedStart }
        )
      : null;

  if (existingForSite) {
    await prisma.attendance.update({
      where: { id: existingForSite.id },
      data: {
        checkIn: checkInAt,
        projectId: project.id,
        checkInLat: latitude,
        checkInLng: longitude,
        checkInDistanceMeters: distance,
        checkInPhotoUrl,
        lateCheckIn: late === true,
        ...(lateNote ? { note: lateNote } : {}),
      },
    });
  } else {
    await prisma.attendance.create({
      data: {
        employeeId: employee.id,
        date: workDay,
        checkIn: checkInAt,
        projectId: project.id,
        checkInLat: latitude,
        checkInLng: longitude,
        checkInDistanceMeters: distance,
        checkInPhotoUrl,
        lateCheckIn: late === true,
        note: lateNote,
      },
    });
  }

  revalidatePath("/cico");
  revalidatePath("/progress");
  revalidatePath("/dashboard");
  revalidatePath("/billing/petty-cash");
}

export async function checkOut(formData: FormData) {
  const { employee } = await requireCicoEmployeeForCheckOut(formData);

  const { latitude, longitude } = await parseCoords(formData);
  const now = new Date();

  const open = await findOpenCicoAttendance(employee.id, now);
  if (!open?.record?.checkIn) {
    throw await cicoError("mustCheckInFirst");
  }

  const existing = open.record;

  if (existing.checkOut) {
    throw await cicoError("alreadyCheckedOut");
  }

  if (!existing.projectId) {
    throw await cicoError("mustCheckInFirst");
  }

  // Progress required for cleaning positions — not on Payroll Management jobs.
  if (
    requiresCicoProgressReport(employee) &&
    existing.project?.subCategory !== "PAYROLL_MANAGEMENT"
  ) {
    const hasProgress = await hasProgressReportForWorkDay(
      employee.id,
      existing.projectId,
      existing.date
    );
    if (!hasProgress) {
      throw await cicoError("progressRequiredBeforeCheckOut");
    }
  }

  const assignedToOpenProject = existing.projectId
    ? await prisma.projectAssignment.findFirst({
        where: { employeeId: employee.id, projectId: existing.projectId },
        select: { id: true },
      })
    : null;
  const officeDeskCheckout =
    existing.project != null &&
    isInternalProjectSubCategory(existing.project.subCategory) &&
    !assignedToOpenProject &&
    canUseOfficeCico(employee);

  if (
    !existing.project ||
    existing.project.latitude == null ||
    existing.project.longitude == null
  ) {
    throw await cicoError("checkInProjectNoLocation");
  }

  const photo = await requireCicoPhoto(formData, "checkOut");
  const checkOutPhotoUrl = await saveUpload(photo, "uploads/cico");

  const radius = resolveGeofenceRadiusMeters(
    existing.project.locationRadiusMeters
  );
  const distance = haversineDistanceMeters(
    latitude,
    longitude,
    existing.project.latitude,
    existing.project.longitude
  );

  if (
    !isWithinGeofence(
      latitude,
      longitude,
      existing.project.latitude,
      existing.project.longitude,
      radius
    )
  ) {
    const siteLabel = existing.project.location
      ? `${existing.project.name} (${existing.project.location})`
      : existing.project.name;
    throw await cicoError("tooFarCheckOut", {
      distance: Math.round(distance),
      site: siteLabel,
      radius,
    });
  }

  const assignment = existing.projectId
    ? await prisma.projectAssignment.findFirst({
        where: { employeeId: employee.id, projectId: existing.projectId },
        select: { shiftStart: true, shiftEnd: true },
      })
    : null;
  const fieldEarly =
    !officeDeskCheckout &&
    isEarlyCheckOut(now, assignment?.shiftStart, assignment?.shiftEnd) === true;
  const officeEarly = officeDeskCheckout && isOfficeClockEarlyLeave(now);
  const early = fieldEarly || officeEarly;
  const earlyNote = early
    ? translate(await getServerLocale(), "pages.cico.errors.earlyCheckOutNote")
    : null;

  await prisma.attendance.update({
    where: { id: existing.id },
    data: {
      checkOut: now,
      checkOutLat: latitude,
      checkOutLng: longitude,
      checkOutDistanceMeters: distance,
      checkOutPhotoUrl,
      earlyCheckOut: early,
      ...(earlyNote
        ? {
            note: existing.note
              ? `${existing.note} · ${earlyNote}`
              : earlyNote,
          }
        : {}),
    },
  });

  // Leave takes effect only after check-out — sync may flip ACTIVE → ON_LEAVE.
  await syncEmployeeLeaveEmploymentStatus(prisma, employee.id, now);
  await applyResignIfLastDayReached(prisma, employee.id, now);

  if (existing.projectId) {
    await tryPostPartTimePayForCompletedDay({
      employeeId: employee.id,
      projectId: existing.projectId,
      workDay: existing.date,
    });
  }

  revalidatePath("/cico");
  revalidatePath("/progress");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
  revalidatePath("/progress");
  revalidatePath("/billing/petty-cash");
}
