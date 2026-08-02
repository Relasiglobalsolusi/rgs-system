"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModule, getEmployeeForUser } from "@/lib/session";
import { haversineDistanceMeters, isWithinGeofence } from "@/lib/geo";
import {
  isLateCheckIn,
  resolveExpectedShiftStart,
} from "@/lib/operating-hours";
import { toUtcDateOnly } from "@/lib/invoice-period";
import { saveUpload } from "@/lib/upload";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";

function todayDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Hard gate: check-out requires ≥1 progress report for this employee × project × work day. */
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
async function requireCicoEmployee(formData?: FormData) {
  const session = await requireModule("cico");

  // Client portal accounts never use CICO (employees only).
  if (session.user.clientId) {
    throw await cicoError("employeeAccountsOnly");
  }

  if (formData?.has("employeeId")) {
    throw await cicoError("invalidRequest");
  }

  const employee = await getEmployeeForUser(session.user.id);
  if (!employee) throw await cicoError("employeeProfileNotFound");

  if (employee.placement !== "ON_PROJECT") {
    throw await cicoError("onProjectOnly");
  }

  return { session, employee };
}

export async function checkIn(formData: FormData) {
  const { employee } = await requireCicoEmployee(formData);

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw await cicoError("selectProject");

  const { latitude, longitude } = await parseCoords(formData);
  const { project, assignment } = await getAssignedProjectForEmployee(
    employee.id,
    projectId
  );
  const radius = project.locationRadiusMeters ?? 50;
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

  const today = todayDate();

  const existing = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId: employee.id,
        date: today,
      },
    },
  });

  if (existing?.checkIn) {
    throw await cicoError("alreadyCheckedIn");
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size <= 0) {
    throw await cicoError("photoRequired");
  }
  if (!photo.type.startsWith("image/")) {
    throw await cicoError("photoMustBeImage");
  }

  const checkInPhotoUrl = await saveUpload(photo, "uploads/cico");

  const checkInAt = new Date();
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
        date: today,
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
      date: today,
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
  const { employee } = await requireCicoEmployee(formData);

  const { latitude, longitude } = await parseCoords(formData);
  const today = todayDate();

  const existing = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId: employee.id,
        date: today,
      },
    },
    include: { project: true },
  });

  if (!existing?.checkIn) {
    throw await cicoError("mustCheckInFirst");
  }

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

  const radius = existing.project.locationRadiusMeters ?? 50;
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
      checkOut: new Date(),
      checkOutLat: latitude,
      checkOutLng: longitude,
      checkOutDistanceMeters: distance,
    },
  });

  revalidatePath("/cico");
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
}
