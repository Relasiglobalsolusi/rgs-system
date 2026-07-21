"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModule, getEmployeeForUser } from "@/lib/session";
import { haversineDistanceMeters, isWithinGeofence } from "@/lib/geo";
import {
  isLateCheckIn,
  resolveExpectedShiftStart,
} from "@/lib/operating-hours";
import { saveUpload } from "@/lib/upload";

function todayDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
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
    throw new Error("You are not assigned to this project.");
  }

  const project = assignment.project;

  if (project.status !== "IN_PROGRESS") {
    throw new Error(
      "Check-in is only available for In Progress projects (work order received)."
    );
  }

  if (project.latitude == null || project.longitude == null) {
    throw new Error("This project has no site location configured yet.");
  }

  return { project, assignment };
}

function parseCoords(formData: FormData) {
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new Error("Location is required. Allow browser location access.");
  }

  return { latitude, longitude };
}

/** CICO always acts as the signed-in user's linked employee — never trust client ids. */
async function requireCicoEmployee(formData?: FormData) {
  const session = await requireModule("cico");

  // Client portal accounts never use CICO (employees only).
  if (session.user.clientId) {
    throw new Error("CICO is only available for employee accounts.");
  }

  if (formData?.has("employeeId")) {
    throw new Error("Invalid request.");
  }

  const employee = await getEmployeeForUser(session.user.id);
  if (!employee) throw new Error("Employee profile not found.");

  if (employee.placement !== "ON_PROJECT") {
    throw new Error(
      "Check-in is only available while you are assigned to an In Progress project (On project)."
    );
  }

  return { session, employee };
}

export async function checkIn(formData: FormData) {
  const { employee } = await requireCicoEmployee(formData);

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw new Error("Select a project to check in.");

  const { latitude, longitude } = parseCoords(formData);
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
    throw new Error(
      `You are ${Math.round(distance)} m from ${siteLabel}. Check in within ${radius} m of that project site.`
    );
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
    throw new Error("Already checked in today.");
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size <= 0) {
    throw new Error(
      "A check-in photo is required. Take a photo that shows you at this project site."
    );
  }
  if (!photo.type.startsWith("image/")) {
    throw new Error("Check-in photo must be an image file.");
  }

  const checkInPhotoUrl = await saveUpload(photo, "uploads/cico");

  const checkInAt = new Date();
  const expectedStart = resolveExpectedShiftStart(assignment);
  const late = isLateCheckIn(checkInAt, expectedStart);
  const lateNote =
    late === true && expectedStart
      ? `Late check-in (expected before ${expectedStart}).`
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

  const { latitude, longitude } = parseCoords(formData);
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
    throw new Error("You must check in first.");
  }

  if (existing.checkOut) {
    throw new Error("Already checked out today.");
  }

  if (
    !existing.project ||
    existing.project.latitude == null ||
    existing.project.longitude == null
  ) {
    throw new Error("Today's check-in project has no site location.");
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
    throw new Error(
      `You are ${Math.round(distance)} m from ${siteLabel}. Check out within ${radius} m of that project site.`
    );
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
