import type { Prisma } from "@prisma/client";

/**
 * Temporary Add Project backlog. When the user finishes typing Ongoing /
 * Completed jobs, delete this module, CatchUpIntake, and the Add Project
 * pills. Do not delete Project, ProjectInvoicePeriod, or ProjectExpense.
 */
export type CatchUpIntakeKind = "ONGOING" | "COMPLETED";

export function isCatchUpIntakeKind(
  value: string | null | undefined
): value is CatchUpIntakeKind {
  return value === "ONGOING" || value === "COMPLETED";
}

export function intakeKindOf(project: {
  catchUpIntake?: { kind: string } | null;
  catchUpKind?: string | null;
}): CatchUpIntakeKind | null {
  const raw = project.catchUpIntake?.kind ?? project.catchUpKind;
  return isCatchUpIntakeKind(raw) ? raw : null;
}

export async function openCatchUpIntake(
  tx: Prisma.TransactionClient,
  projectId: string,
  kind: CatchUpIntakeKind
) {
  await tx.catchUpIntake.upsert({
    where: { projectId },
    create: { projectId, kind },
    update: { kind },
  });
  await tx.project.update({
    where: { id: projectId },
    data: { catchUpKind: kind },
  });
}

/** Intake is finished for this project. The project row stays. */
export async function closeCatchUpIntake(
  tx: Prisma.TransactionClient,
  projectId: string,
  opts?: { completeProject?: boolean }
) {
  await tx.catchUpIntake.deleteMany({ where: { projectId } });
  await tx.project.update({
    where: { id: projectId },
    data: {
      catchUpKind: "NONE",
      ...(opts?.completeProject ? { status: "COMPLETED" } : {}),
    },
  });
}
