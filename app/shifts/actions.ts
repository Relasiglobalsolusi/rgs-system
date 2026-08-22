"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { toActionError } from "@/lib/prisma-errors";
import {
  applyAssignmentToShift,
  addNamedProjectShift,
  parseShiftTime,
  removeNamedProjectShift,
  saveProjectShiftTimes,
} from "@/lib/project-shifts";

async function requireShiftsSession() {
  const session = await requireModule("shifts");
  if (session.user.clientId || session.user.vendorId) {
    throw new Error("Portal users cannot edit shifts.");
  }
  const companyId = session.user.companyId;
  if (!companyId) throw new Error("Company not found.");
  return { session, companyId };
}

function revalidateShiftPaths(projectId?: string) {
  revalidatePath("/shifts", "layout");
  revalidatePath("/cico");
  revalidatePath("/progress");
  revalidatePath("/employees");
  revalidatePath("/projects");
  revalidatePath("/billing/payroll");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function updateProjectShiftWindow(
  shiftId: string,
  formData: FormData
) {
  try {
    const { companyId } = await requireShiftsSession();
    const startTime = parseShiftTime(formData.get("startTime"));
    const endTime = parseShiftTime(formData.get("endTime"));
    if (!startTime || !endTime) {
      throw new Error("Set both shift start and end.");
    }

    const shift = await prisma.projectShift.findFirst({
      where: { id: shiftId, project: { companyId } },
      select: { id: true, projectId: true },
    });
    if (!shift) throw new Error("Shift not found.");

    await saveProjectShiftTimes(prisma, {
      shiftId: shift.id,
      startTime,
      endTime,
    });
    revalidateShiftPaths(shift.projectId);
  } catch (error) {
    throw toActionError(error, "Failed to update shift.");
  }
}

export async function assignEmployeeShift(
  assignmentId: string,
  formData: FormData
) {
  try {
    const { companyId } = await requireShiftsSession();
    const raw = String(formData.get("shiftId") ?? "").trim();
    const shiftId = !raw || raw === "__none__" ? null : raw;

    const assignment = await prisma.projectAssignment.findFirst({
      where: {
        id: assignmentId,
        isBackup: false,
        project: { companyId },
      },
      select: { id: true, projectId: true },
    });
    if (!assignment) throw new Error("Assignment not found.");

    if (shiftId) {
      const shift = await prisma.projectShift.findFirst({
        where: { id: shiftId, projectId: assignment.projectId },
        select: { id: true },
      });
      if (!shift) throw new Error("Shift not found.");
    }

    await applyAssignmentToShift(prisma, {
      assignmentId: assignment.id,
      shiftId,
    });
    revalidateShiftPaths(assignment.projectId);
  } catch (error) {
    throw toActionError(error, "Failed to update shift.");
  }
}

export async function addProjectShift(projectId: string, formData: FormData) {
  try {
    const { companyId } = await requireShiftsSession();
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: { id: true },
    });
    if (!project) throw new Error("Project not found.");

    const startRaw = String(formData.get("startTime") ?? "").trim();
    const endRaw = String(formData.get("endTime") ?? "").trim();
    const times =
      startRaw || endRaw
        ? {
            startTime: parseShiftTime(startRaw),
            endTime: parseShiftTime(endRaw),
          }
        : undefined;

    await addNamedProjectShift(prisma, project.id, times);
    revalidateShiftPaths(project.id);
  } catch (error) {
    throw toActionError(error, "Failed to add shift.");
  }
}

export async function removeProjectShift(formData: FormData) {
  try {
    const { companyId } = await requireShiftsSession();
    const shiftId = String(formData.get("shiftId") ?? "").trim();
    if (!shiftId) throw new Error("Select the shift to remove.");

    const shift = await prisma.projectShift.findFirst({
      where: { id: shiftId, project: { companyId } },
      select: { id: true, projectId: true },
    });
    if (!shift) throw new Error("Shift not found.");

    await removeNamedProjectShift(prisma, shift.projectId, shift.id);
    revalidateShiftPaths(shift.projectId);
  } catch (error) {
    throw toActionError(error, "Failed to remove shift.");
  }
}

