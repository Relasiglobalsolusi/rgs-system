import type { Placement, Prisma, ProjectStatus } from "@prisma/client";

const ASSIGNABLE_STATUSES: ProjectStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
];

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
      status: { in: ASSIGNABLE_STATUSES },
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

/** Assign employee to projects and set placement ON_PROJECT. */
export async function assignEmployeeToProjects(
  db: DbClient & { employee: Prisma.EmployeeDelegate },
  employeeId: string,
  projectIds: string[],
  shifts?: AssignmentShiftInput[]
) {
  if (projectIds.length === 0) {
    throw new Error("Select at least one project to assign.");
  }
  await syncProjectAssignments(db, employeeId, projectIds, shifts);
  await db.employee.update({
    where: { id: employeeId },
    data: { placement: "ON_PROJECT" },
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
