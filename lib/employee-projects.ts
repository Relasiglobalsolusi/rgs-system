import type { Placement, Prisma, ProjectStatus } from "@prisma/client";

/** Live projects staff may still be linked to (Planning + In Progress). */
export const OPEN_PROJECT_ASSIGNMENT_STATUSES: ProjectStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
];

/**
 * Release specific employees from one project only.
 * Callers that need AVAILABLE + portal sync should use
 * `releaseEmployeesFromProject` from `lib/workforce-crew.ts`.
 */
export async function clearEmployeesFromProject(
  db: DbClient,
  projectId: string,
  employeeIds: string[]
) {
  const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;
  await db.projectAssignment.deleteMany({
    where: { projectId, employeeId: { in: uniqueIds } },
  });
}

type DbClient = {
  project: Prisma.ProjectDelegate;
  projectAssignment: Prisma.ProjectAssignmentDelegate;
};

/**
 * Project links are required when placing ON_PROJECT; optional for FIELD;
 * cleared for AVAILABLE / HEAD_OFFICE.
 */
export async function resolveProjectIdsForPlacement(
  db: DbClient,
  placement: Placement,
  rawValue: FormDataEntryValue | null,
  companyId: string
): Promise<string[]> {
  if (placement === "AVAILABLE" || placement === "HEAD_OFFICE") {
    return [];
  }

  const projectIds = await parseProjectIds(db, rawValue, companyId);

  if (placement === "ON_PROJECT" && projectIds.length === 0) {
    throw new Error(
      "Select at least one site or project for On project placement."
    );
  }

  return projectIds;
}

export async function parseProjectIds(
  db: DbClient,
  rawValue: FormDataEntryValue | null,
  companyId: string
): Promise<string[]> {
  const raw = String(rawValue ?? "").trim();
  if (!raw) {
    return [];
  }

  const projectIds = [
    ...new Set(
      raw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ];

  if (projectIds.length === 0) {
    return [];
  }

  const projects = await db.project.findMany({
    where: {
      id: { in: projectIds },
      companyId,
      status: { in: OPEN_PROJECT_ASSIGNMENT_STATUSES },
    },
    select: { id: true },
  });

  if (projects.length !== projectIds.length) {
    throw new Error("One or more selected sites are invalid or inactive.");
  }

  return projectIds;
}

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
