"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { toActionError } from "@/lib/prisma-errors";

function parseShiftTime(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error("Shift times must use HH:mm format.");
  }
  const [hours, minutes] = value.split(":").map(Number);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error("Shift times must use HH:mm format.");
  }
  return value;
}

/**
 * Update planned shift start/end for an existing project assignment.
 * Assign Staff (Projects) still only chooses who; Shifts sets when.
 */
export async function updateAssignmentShift(
  assignmentId: string,
  formData: FormData
) {
  try {
    const session = await requireModule("shifts");
    if (session.user.clientId || session.user.vendorId) {
      throw new Error("Portal users cannot edit shifts.");
    }

    const companyId = session.user.companyId;
    if (!companyId) throw new Error("Company not found.");

    const shiftStart = parseShiftTime(formData.get("shiftStart"));
    const shiftEnd = parseShiftTime(formData.get("shiftEnd"));

    if ((shiftStart && !shiftEnd) || (!shiftStart && shiftEnd)) {
      throw new Error("Set both shift start and end, or clear both.");
    }

    const assignment = await prisma.projectAssignment.findFirst({
      where: {
        id: assignmentId,
        project: { companyId },
      },
      select: { id: true, projectId: true },
    });
    if (!assignment) {
      throw new Error("Assignment not found.");
    }

    await prisma.projectAssignment.update({
      where: { id: assignmentId },
      data: { shiftStart, shiftEnd },
    });

    revalidatePath("/shifts");
    revalidatePath(`/shifts?projectId=${assignment.projectId}`);
    revalidatePath("/cico");
    revalidatePath("/attendance");
    revalidatePath("/employees");
    revalidatePath("/projects");
  } catch (error) {
    throw toActionError(error, "Failed to update shift.");
  }
}
