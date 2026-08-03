"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModule, getEmployeeForUser, toPermissionUser } from "@/lib/session";
import {
  isHoAdminAccount,
} from "@/lib/permissions";
import {
  CICO_GEOFENCE_RADIUS_METERS,
  haversineDistanceMeters,
  isWithinGeofence,
} from "@/lib/geo";
import {
  isLateCheckIn,
  resolveExpectedShiftStart,
} from "@/lib/operating-hours";
import { toUtcDateOnly } from "@/lib/invoice-period";
import { resolveCicoWorkDay } from "@/lib/cico-work-day";
import { findOpenCicoAttendance } from "@/lib/cico-attendance";
import { isCleaningProjectSubCategory } from "@/lib/project-subcategory";
import { saveUpload } from "@/lib/upload";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import {
  ensureLeaveEmploymentSyncedForUser,
  getOperationsBlockedErrorKey,
  isEmployeeActiveForOperations,
  syncEmployeeLeaveEmploymentStatus,
} from "@/lib/leave-employment-status";

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

async function getProjectForCicoCheckIn(
  employeeId: string,
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

    if (project.status !== "IN_PROGRESS") {
      throw await cicoError("inProgressOnly");
    }

    if (project.latitude == null || project.longitude == null) {
      throw await cicoError("noSiteLocation");
    }

    const assignment = await prisma.projectAssignment.findFirst({
      where: { employeeId, projectId },
    });

    return {
      project,
      assignment: {
        shiftStart: assignment?.shiftStart ?? null,
        shiftEnd: assignment?.shiftEnd ?? null,
      },
    };
  }

  return getAssignedProjectForEmployee(employeeId, projectId);
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

  const project = assignment.project;

  if (!isCleaningProjectSubCategory(project.subCategory)) {
    throw await cicoError("cleaningOnly");
  }

  if (project.status !== "IN_PROGRESS") {
    throw await cicoError("inProgressOnly");
  }

  if (project.latitude == null || project.longitude == null) {
    throw await cicoError("noSiteLocation");
  }

  return { project, assignment };
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

  const employee =
    (await ensureLeaveEmploymentSyncedForUser(session.user.id)) ??
    (await getEmployeeForUser(session.user.id));
  if (!employee) throw await cicoError("employeeProfileNotFound");

  if (employee.archivedFromDirectory) {
    throw await cicoError("inactiveEmployee");
  }

  if (adminFieldMode) {
    return { session, employee, adminFieldMode: true as const };
  }

  if (employee.placement !== "ON_PROJECT") {
    throw await cicoError("onProjectOnly");
  }

  return { session, employee, adminFieldMode: false as const };
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
  const { project, assignment } = await getProjectForCicoCheckIn(
    employee.id,
    projectId,
    adminFieldMode
  );

  const radius = CICO_GEOFENCE_RADIUS_METERS;
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

  const existing = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId: employee.id,
        date: workDay,
      },
    },
  });

  if (existing?.checkIn) {
    throw await cicoError("alreadyCheckedIn");
  }

  const photo = await requireCicoPhoto(formData, "checkIn");
  const checkInPhotoUrl = await saveUpload(photo, "uploads/cico");

  const checkInAt = now;
  const expectedStart = resolveExpectedShiftStart(assignment);
  const late = isLateCheckIn(checkInAt, expectedStart);
  const lateNote =
    late === true && expectedStart
      ? translate(
          await getServerLocale(),
          "pages.cico.errors.lateCheckInNote",
          { time: expectedStart }
        )
      : null;

  await prisma.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId: employee.id,
        date: workDay,
      },
    },
    update: {
      checkIn: checkInAt,
      projectId: project.id,
      checkInLat: latitude,
      checkInLng: longitude,
      checkInDistanceMeters: distance,
      checkInPhotoUrl,
      ...(lateNote ? { note: lateNote } : {}),
    },
    create: {
      employeeId: employee.id,
      date: workDay,
      checkIn: checkInAt,
      projectId: project.id,
      checkInLat: latitude,
      checkInLng: longitude,
      checkInDistanceMeters: distance,
      checkInPhotoUrl,
      note: lateNote,
    },
  });

  revalidatePath("/cico");
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
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

  // Canonical flow: no Progress Report for this shift/work day → block check-out.
  const hasProgress = await hasProgressReportForWorkDay(
    employee.id,
    existing.projectId,
    existing.date
  );
  if (!hasProgress) {
    throw await cicoError("progressRequiredBeforeCheckOut");
  }

  if (
    !existing.project ||
    existing.project.latitude == null ||
    existing.project.longitude == null
  ) {
    throw await cicoError("checkInProjectNoLocation");
  }

  const photo = await requireCicoPhoto(formData, "checkOut");
  const checkOutPhotoUrl = await saveUpload(photo, "uploads/cico");

  const radius = CICO_GEOFENCE_RADIUS_METERS;
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

  await prisma.attendance.update({
    where: { id: existing.id },
    data: {
      checkOut: now,
      checkOutLat: latitude,
      checkOutLng: longitude,
      checkOutDistanceMeters: distance,
      checkOutPhotoUrl,
    },
  });

  // Leave takes effect only after check-out — sync may flip ACTIVE → ON_LEAVE.
  await syncEmployeeLeaveEmploymentStatus(prisma, employee.id, now);

  revalidatePath("/cico");
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
  revalidatePath("/progress");
}
