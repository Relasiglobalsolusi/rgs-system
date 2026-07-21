"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  requireSession,
  getEmployeeForUser,
} from "@/lib/session";
import { saveUpload } from "@/lib/upload";

export async function createLeaveRequest(formData: FormData) {
  const session = await requireModule("leaves");
  const employee = await getEmployeeForUser(session.user.id);

  if (!employee) throw new Error("Employee profile not found.");

  if (employee.placement !== "AVAILABLE") {
    throw new Error(
      "Leave and sick requests are only available when your placement is Available."
    );
  }

  const type = String(formData.get("type") ?? "PERMISSION");
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const proof = formData.get("proof") as File | null;

  if (!startDate || !endDate) throw new Error("Dates are required.");
  if (!reason) throw new Error("Reason is required.");

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid dates.");
  }
  if (end < start) throw new Error("End date cannot be before start date.");

  let proofUrl: string | null = null;

  if (proof && proof.size > 0) {
    proofUrl = await saveUpload(proof, "proofs");
  }

  await prisma.leaveRequest.create({
    data: {
      employeeId: employee.id,
      type: type as "PERMISSION" | "SICK",
      startDate: start,
      endDate: end,
      reason,
      proofUrl,
      status: "PENDING",
    },
  });

  revalidatePath("/leaves");
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
}

export async function reviewLeaveRequest(
  id: string,
  approved: boolean,
  reviewNote?: string
) {
  const session = await requireModule("approvals");

  const existing = await prisma.leaveRequest.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) throw new Error("Leave request not found.");
  if (existing.status !== "PENDING") {
    throw new Error("This request has already been reviewed.");
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: approved ? "APPROVED" : "REJECTED",
      reviewNote: reviewNote || null,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
    },
  });

  revalidatePath("/leaves");
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
}

/** Persist dismissal of leave-approved dashboard notification(s) for the signed-in user. */
export async function acknowledgeLeaveApprovals(leaveRequestIds: string[]) {
  const session = await requireSession();
  if (!leaveRequestIds.length) return { count: 0 };

  const employee = await getEmployeeForUser(session.user.id);
  if (!employee) throw new Error("Employee profile not found.");

  const ids = [
    ...new Set(
      leaveRequestIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    ),
  ];
  if (ids.length === 0) return { count: 0 };

  const owned = await prisma.leaveRequest.findMany({
    where: {
      id: { in: ids },
      employeeId: employee.id,
      status: "APPROVED",
    },
    select: { id: true },
  });

  if (owned.length === 0) return { count: 0 };

  await prisma.$transaction(
    owned.map((leave) =>
      prisma.leaveApprovalAck.upsert({
        where: {
          userId_leaveRequestId: {
            userId: session.user.id,
            leaveRequestId: leave.id,
          },
        },
        create: {
          userId: session.user.id,
          leaveRequestId: leave.id,
        },
        update: { acknowledgedAt: new Date() },
      })
    )
  );

  revalidatePath("/dashboard");
  revalidatePath("/leaves");

  return { count: owned.length };
}
