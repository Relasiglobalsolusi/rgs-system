import type { Placement, Prisma, ProjectStatus } from "@prisma/client";

/** Live projects staff may still be linked to (Planning + In Progress). */
export const OPEN_PROJECT_ASSIGNMENT_STATUSES: ProjectStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
];

type DbClient = {
  project: Prisma.ProjectDelegate;
  projectAssignment: Prisma.ProjectAssignmentDelegate;
};

export type AssignmentShiftInput = {
  projectId: string;
  shiftStart?: string | null;
  shiftEnd?: string | null;
};

export async function syncProjectAssignments(
  db: DbClient,
  employeeId: string,
  projectIds: string[],
  shifts?: AssignmentShiftInput[]
) {
  const { voidScheduledPartTimePays } = await import("@/lib/petty-cash");
  await voidScheduledPartTimePays(db as never, { employeeIds: [employeeId] });
  await db.projectAssignment.deleteMany({
    where: { employeeId },
  });

  if (projectIds.length === 0) {
    return;
  }

  const shiftByProject = new Map(
    (shifts ?? []).map((shift) => [shift.projectId, shift])
  );

  await db.projectAssignment.createMany({
    data: projectIds.map((projectId) => {
      const shift = shiftByProject.get(projectId);
      return {
        projectId,
        employeeId,
        shiftStart: shift?.shiftStart ?? null,
        shiftEnd: shift?.shiftEnd ?? null,
      };
    }),
  });
}

/**
 * Release from projects → AVAILABLE (ops) or keep HEAD_OFFICE if corporate.
 * Callers pass the target placement.
 */
export async function releaseEmployeeFromProjects(
  db: DbClient & { employee: Prisma.EmployeeDelegate },
  employeeId: string,
  nextPlacement: Placement = "AVAILABLE"
) {
  await syncProjectAssignments(db, employeeId, []);
  await db.employee.update({
    where: { id: employeeId },
    data: { placement: nextPlacement },
  });
}
