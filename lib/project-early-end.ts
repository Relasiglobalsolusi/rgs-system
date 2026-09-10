import { prisma } from "@/lib/prisma";
import { formatDateInput, toUtcDateOnly } from "@/lib/invoice-period";
import { jakartaWorkDateKey } from "@/lib/shift-pay";
import { decimalToNumber, usesInvoicePeriods } from "@/lib/project-billing";
import { releaseAllProjectCrew } from "@/lib/workforce-crew";

/** Reconcile only after the last working day is fully closed (Jakarta next day). */
export function isReadyToReconcileAfterLastDay(
  lastDay: Date,
  now: Date = new Date()
): boolean {
  return jakartaWorkDateKey(now) > formatDateInput(toUtcDateOnly(lastDay));
}

export async function finalizePendingEarlyEndIfDue(options: {
  projectId: string;
  userId: string;
  lastDay: Date;
  clientId: string | null;
  contractPrice: Parameters<typeof decimalToNumber>[0];
}): Promise<{ sent: boolean; error: string | null }> {
  if (!isReadyToReconcileAfterLastDay(options.lastDay)) {
    return { sent: false, error: null };
  }

  const lastPeriod = await prisma.projectInvoicePeriod.findFirst({
    where: {
      projectId: options.projectId,
      periodEnd: toUtcDateOnly(options.lastDay),
    },
    orderBy: { periodStart: "desc" },
    select: {
      id: true,
      status: true,
      reconciledAt: true,
      amount: true,
    },
  });
  if (!lastPeriod) {
    const project = await prisma.project.findUnique({
      where: { id: options.projectId },
      select: { subCategory: true },
    });
    if (project && !usesInvoicePeriods(project.subCategory)) {
      await prisma.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: options.projectId },
          data: { pendingEarlyEndReconcile: false },
        });
        await releaseAllProjectCrew(tx, options.projectId, {
          keepAssignmentHistory: true,
        });
      });
      return { sent: false, error: null };
    }
    return { sent: false, error: "Last billing period is missing." };
  }
  if (
    lastPeriod.status !== "ONGOING" &&
    lastPeriod.status !== "COMPILING" &&
    lastPeriod.status !== "AWAITING_CLIENT_REVIEW"
  ) {
    await prisma.project.update({
      where: { id: options.projectId },
      data: { pendingEarlyEndReconcile: false },
    });
    return { sent: false, error: null };
  }

  // Crew leaves after the last day. HO still reconciles Keep / deductions
  // and sends the last period — do not auto-reconcile or auto-send.
  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: options.projectId },
      data: { pendingEarlyEndReconcile: false },
    });
    await releaseAllProjectCrew(tx, options.projectId, {
      keepAssignmentHistory: true,
    });
  });
  return { sent: false, error: null };
}

export async function processPendingEarlyEndReconciles(options: {
  companyId: string;
  userId: string;
}): Promise<void> {
  const projects = await prisma.project.findMany({
    where: {
      companyId: options.companyId,
      pendingEarlyEndReconcile: true,
      status: { in: ["IN_PROGRESS", "WAITING_FOR_APPROVAL"] },
    },
    select: {
      id: true,
      clientId: true,
      endDate: true,
      contractPrice: true,
    },
  });

  for (const project of projects) {
    if (!project.endDate) continue;
    await finalizePendingEarlyEndIfDue({
      projectId: project.id,
      userId: options.userId,
      lastDay: project.endDate,
      clientId: project.clientId,
      contractPrice: project.contractPrice,
    });
  }
}
