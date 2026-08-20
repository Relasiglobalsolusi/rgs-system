import { prisma } from "@/lib/prisma";
import { toUtcDateOnly } from "@/lib/invoice-period";
import { decimalToNumber } from "@/lib/project-billing";

/** Reconcile only after the last working day is fully closed (lastDay + 1). */
export function isReadyToReconcileAfterLastDay(
  lastDay: Date,
  now: Date = new Date()
): boolean {
  return toUtcDateOnly(now).getTime() > toUtcDateOnly(lastDay).getTime();
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

  if (!lastPeriod.reconciledAt) {
    const fallback = decimalToNumber(options.contractPrice);
    await prisma.projectInvoicePeriod.update({
      where: { id: lastPeriod.id },
      data: {
        reconciledAt: new Date(),
        reconciledById: options.userId,
        ...(fallback != null && fallback > 0 && lastPeriod.amount == null
          ? { amount: fallback }
          : {}),
      },
    });
  }

  try {
    const { sendPeriodForClientReview } = await import(
      "@/app/billing/reconciliation/actions"
    );
    await sendPeriodForClientReview(lastPeriod.id, "RECONCILIATION");
    await prisma.project.update({
      where: { id: options.projectId },
      data: { pendingEarlyEndReconcile: false },
    });
    return { sent: true, error: null };
  } catch (error) {
    return {
      sent: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send the last period to the client.",
    };
  }
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
