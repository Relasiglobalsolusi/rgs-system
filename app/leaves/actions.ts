"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  requireSession,
  getEmployeeForUser,
} from "@/lib/session";
import { saveUpload } from "@/lib/upload";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import {
  canApproveLeaveRequest,
  leaveRequestEmployeeSelect,
  leaveRequesterFromEmployee,
  resolveLeaveReviewerProfile,
} from "@/lib/leave-approval-hierarchy";
import {
  ensureLeaveEmploymentSyncedForUser,
  getOperationsBlockedErrorKey,
  isEmployeeActiveForOperations,
  syncEmployeeLeaveEmploymentStatus,
} from "@/lib/leave-employment-status";
import { isOwnerAccount } from "@/lib/permissions";
import { toPermissionUser } from "@/lib/session";

async function leaveError(key: string) {
  const locale = await getServerLocale();
  return new Error(translate(locale, `pages.leaves.errors.${key}`));
}

export async function createLeaveRequest(formData: FormData) {
  const session = await requireModule("leaves");
  const employee =
    (await ensureLeaveEmploymentSyncedForUser(session.user.id)) ??
    (await getEmployeeForUser(session.user.id));

  if (!employee) throw await leaveError("employeeProfileNotFound");

  if (!isEmployeeActiveForOperations(employee.status)) {
    throw await leaveError(getOperationsBlockedErrorKey(employee.status));
  }

  const type = String(formData.get("type") ?? "PERMISSION");
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const proof = formData.get("proof") as File | null;

  if (!startDate || !endDate) throw await leaveError("datesRequired");
  if (!reason) throw await leaveError("reasonRequired");

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw await leaveError("invalidDates");
  }
  if (end < start) throw await leaveError("endBeforeStart");

  let proofUrl: string | null = null;

  if (proof && proof.size > 0) {
    proofUrl = await saveUpload(proof, "proofs");
  }

  const ownerLeave = isOwnerAccount(session.user);

  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.create({
      data: {
        employeeId: employee.id,
        type: type as "PERMISSION" | "SICK",
        startDate: start,
        endDate: end,
        reason,
        proofUrl,
        status: ownerLeave ? "APPROVED" : "PENDING",
        reviewedById: ownerLeave ? session.user.id : undefined,
        reviewedAt: ownerLeave ? new Date() : undefined,
      },
    });

    if (ownerLeave) {
      await syncEmployeeLeaveEmploymentStatus(tx, employee.id);
    }
  });

  revalidatePath("/leaves");
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
}

export async function reviewLeaveRequest(
  id: string,
  approved: boolean,
  reviewNote?: string
) {
  const session = await requireModule("approvals");
  const companyId = session.user.companyId;
  if (!companyId) throw await leaveError("companyNotFound");

  const existing = await prisma.leaveRequest.findFirst({
    where: {
      id,
      employee: { companyId },
    },
    select: {
      status: true,
      employeeId: true,
      employee: { select: leaveRequestEmployeeSelect },
    },
  });

  if (!existing) throw await leaveError("leaveNotFound");
  if (existing.status !== "PENDING") {
    throw await leaveError("alreadyReviewed");
  }

  const reviewer = await resolveLeaveReviewerProfile({
    userId: session.user.id,
    username: session.user.username,
    permissionUser: toPermissionUser(session),
  });

  if (
    !canApproveLeaveRequest(
      leaveRequesterFromEmployee(existing.employee),
      reviewer
    )
  ) {
    throw await leaveError("notAllowedToApprove");
  }

  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        reviewNote: reviewNote || null,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    });

    await syncEmployeeLeaveEmploymentStatus(tx, existing.employeeId);
  });

  revalidatePath("/leaves");
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
  revalidatePath("/cico");
}

/** Persist dismissal of leave-approved dashboard notification(s) for the signed-in user. */
export async function acknowledgeLeaveApprovals(leaveRequestIds: string[]) {
  const session = await requireSession();
  if (!leaveRequestIds.length) return { count: 0 };

  const employee = await getEmployeeForUser(session.user.id);
  if (!employee) throw await leaveError("employeeProfileNotFound");

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
