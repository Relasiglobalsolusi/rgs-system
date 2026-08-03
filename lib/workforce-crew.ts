import type { Prisma } from "@prisma/client";

import { OPEN_PROJECT_ASSIGNMENT_STATUSES } from "@/lib/employee-projects";
import { releaseProjectEquipmentToInventory } from "@/lib/inventory-project-release";
import { syncEmployeesLeaveEmploymentStatus } from "@/lib/leave-employment-status";
import { isCrewPickerPosition, isOperationsManagerPosition } from "@/lib/positions";
import { syncEmployeePortalLogin } from "@/lib/workforce-login";

/**
 * Default crew picker for Planning → In Progress:
 * Available FT in Operations with Cleaning/GC positions (exclude OM).
 * Assignment-only: ACTIVE (ON_LEAVE stays roster-active for login, not crew).
 */
export function availableFullTimeCrewWhere(
  companyId: string
): Prisma.EmployeeWhereInput {
  return {
    companyId,
    status: "ACTIVE",
    employmentType: "FULL_TIME",
    placement: "AVAILABLE",
    category: {
      active: true,
      slug: "operations",
    },
    jobPosition: {
      active: true,
      slug: { in: ["cleaning-staff", "gc-staff"] },
    },
  };
}

/**
 * Part Time Roster — never labeled “available”; ready to add to a project.
 * Assignment-only: ACTIVE (ON_LEAVE excluded from assignable crew).
 */
export function partTimeRosterWhere(
  companyId: string
): Prisma.EmployeeWhereInput {
  return {
    companyId,
    status: "ACTIVE",
    employmentType: "PART_TIME",
  };
}

/**
 * HO / invalid crew must not be assignable as project staff.
 * Same eligibility as Move to In Progress: Available FT Ops Cleaning/GC + PT roster.
 */
type CrewEligibilityDb = Pick<
  Prisma.TransactionClient,
  "employee" | "leaveRequest" | "projectAssignment"
>;

export async function assertProjectCrewEligible(
  db: CrewEligibilityDb,
  companyId: string,
  employeeIds: string[],
  errorMessage = "Select Available Full Time Operations crew (Cleaning/GC) and/or Part Time staff only."
) {
  const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  await syncEmployeesLeaveEmploymentStatus(db, uniqueIds);

  const validCount = await db.employee.count({
    where: {
      id: { in: uniqueIds },
      OR: [
        availableFullTimeCrewWhere(companyId),
        partTimeRosterWhere(companyId),
      ],
    },
  });

  if (validCount !== uniqueIds.length) {
    throw new Error(errorMessage);
  }
}

/** Operations Manager — may supervise multiple open projects at once. */
export function isMultiProjectSupervisorEmployee(employee: {
  jobPosition?: { slug?: string | null; name?: string | null } | null;
}): boolean {
  return isOperationsManagerPosition(employee.jobPosition ?? {});
}

export type OtherProjectAssignmentConflict = {
  employeeId: string;
  projectId: string;
  projectName: string;
};

type ProjectAssignmentDb = Pick<
  Prisma.TransactionClient,
  "projectAssignment" | "employee"
>;

/**
 * Crew already linked to a different Planning / In Progress project.
 * Operations Managers are excluded — they may supervise multiple sites.
 */
export async function findEmployeesOnOtherOpenProjects(
  db: ProjectAssignmentDb,
  companyId: string,
  employeeIds: string[],
  excludeProjectId?: string
): Promise<OtherProjectAssignmentConflict[]> {
  const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const employees = await db.employee.findMany({
    where: { id: { in: uniqueIds }, companyId },
    select: {
      id: true,
      jobPosition: { select: { slug: true, name: true } },
    },
  });

  const crewIds = employees
    .filter((employee) => !isMultiProjectSupervisorEmployee(employee))
    .map((employee) => employee.id);
  if (crewIds.length === 0) return [];

  const rows = await db.projectAssignment.findMany({
    where: {
      employeeId: { in: crewIds },
      ...(excludeProjectId ? { projectId: { not: excludeProjectId } } : {}),
      project: {
        companyId,
        status: { in: OPEN_PROJECT_ASSIGNMENT_STATUSES },
      },
    },
    select: {
      employeeId: true,
      projectId: true,
      project: { select: { name: true } },
    },
  });

  const seen = new Set<string>();
  const conflicts: OtherProjectAssignmentConflict[] = [];
  for (const row of rows) {
    if (seen.has(row.employeeId)) continue;
    seen.add(row.employeeId);
    conflicts.push({
      employeeId: row.employeeId,
      projectId: row.projectId,
      projectName: row.project.name,
    });
  }
  return conflicts;
}

/** Reject crew who already have an open assignment on a different project. */
export async function assertEmployeesNotOnOtherProject(
  db: ProjectAssignmentDb,
  companyId: string,
  employeeIds: string[],
  options?: {
    excludeProjectId?: string;
    message?: string;
    messageForProject?: (projectName: string) => string;
  }
) {
  const conflicts = await findEmployeesOnOtherOpenProjects(
    db,
    companyId,
    employeeIds,
    options?.excludeProjectId
  );
  if (conflicts.length === 0) return;

  const projectName = conflicts[0]?.projectName?.trim();
  const message =
    (projectName && options?.messageForProject?.(projectName)) ||
    options?.message ||
    (projectName
      ? `This employee is already assigned to ${projectName}.`
      : "This employee is already assigned to another project.");
  throw new Error(message);
}

export function annotateStaffPickerConflicts<T extends { id: string }>(
  employees: T[],
  conflicts: OtherProjectAssignmentConflict[]
): Array<T & { blockedProjectName: string | null }> {
  const byEmployee = new Map(
    conflicts.map((row) => [row.employeeId, row.projectName])
  );
  return employees.map((employee) => ({
    ...employee,
    blockedProjectName: byEmployee.get(employee.id) ?? null,
  }));
}

export function isDefaultCrewEmployee(employee: {
  employmentType: string;
  placement: string;
  category?: { slug?: string | null } | null;
  jobPosition?: { slug?: string | null; name?: string | null } | null;
}): boolean {
  if (employee.employmentType !== "FULL_TIME") return false;
  if (employee.placement !== "AVAILABLE") return false;
  if (employee.category?.slug !== "operations") return false;
  if (!employee.jobPosition) return false;
  return isCrewPickerPosition(employee.jobPosition);
}

const employeeReleaseSelect = {
  id: true,
  companyId: true,
  firstName: true,
  lastName: true,
  employeeNo: true,
  employmentType: true,
  portalAccessRequested: true,
  userId: true,
  user: { select: { active: true } },
  status: true,
} as const;

function isEmployeeLoginRevoked(employee: {
  userId: string | null;
  user?: { active: boolean } | null;
}) {
  return employee.userId != null && employee.user?.active === false;
}

/**
 * Drop project assignments for the given employees and release to AVAILABLE
 * (Unassigned) + Portal 2A sync when they have no remaining project links.
 * Same placement/portal outcome as Employees → Release.
 */
export async function releaseEmployeesFromProject(
  db: Prisma.TransactionClient,
  projectId: string,
  employeeIds: string[]
) {
  const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  await db.projectAssignment.deleteMany({
    where: { projectId, employeeId: { in: uniqueIds } },
  });

  const employees = await db.employee.findMany({
    where: { id: { in: uniqueIds } },
    select: employeeReleaseSelect,
  });

  for (const employee of employees) {
    const remaining = await db.projectAssignment.count({
      where: { employeeId: employee.id },
    });
    if (remaining > 0) continue;

    // Ops → AVAILABLE (never auto HEAD_OFFICE on project release)
    await db.employee.update({
      where: { id: employee.id },
      data: {
        placement: "AVAILABLE",
        employeeType: "PROJECT_SITE",
      },
    });

    await syncEmployeePortalLogin(db, {
      companyId: employee.companyId,
      employeeId: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeNo: employee.employeeNo,
      employmentType: employee.employmentType,
      placement: "AVAILABLE",
      portalAccessRequested: employee.portalAccessRequested,
      status: employee.status,
      userId: employee.userId,
      employeeType: "PROJECT_SITE",
    });
  }
}

/**
 * Release every assignee on a project → AVAILABLE + portal sync.
 * Also returns Equipment inventory issued to the project (machines / assets)
 * back to on-hand stock — same demobilization moment as crew → pool.
 */
export async function releaseAllProjectCrew(
  db: Prisma.TransactionClient,
  projectId: string
) {
  const assignments = await db.projectAssignment.findMany({
    where: { projectId },
    select: { employeeId: true },
  });
  await releaseEmployeesFromProject(
    db,
    projectId,
    assignments.map((row) => row.employeeId)
  );
  await releaseProjectEquipmentToInventory(db, projectId);
}

/**
 * True when both-parties agree on an ops-done billing package should release crew:
 * ON_COMPLETION completion approve, or final MILESTONE ≥100%.
 * Never for Regular / MONTHLY (End Contract only). Intermediate milestones stay held.
 */
export function shouldReleaseCrewAfterBillingReviewAgree(opts: {
  subCategory: string | null | undefined;
  billingMode: string | null | undefined;
  milestonePercent: number | null | undefined;
}): boolean {
  const isRegularCleaning =
    opts.subCategory === "REGULAR_CLEANING" || opts.billingMode === "MONTHLY";
  if (isRegularCleaning) return false;
  return (
    opts.billingMode === "ON_COMPLETION" ||
    (opts.milestonePercent != null && opts.milestonePercent >= 100)
  );
}

/**
 * Release assigned staff → AVAILABLE after ops-done progress approval.
 * Call only when `shouldReleaseCrewAfterBillingReviewAgree` is true.
 */
export async function releaseProjectCrewAfterProgressApproved(
  db: Prisma.TransactionClient,
  projectId: string
) {
  await releaseAllProjectCrew(db, projectId);
}

/** Mark selected employees ON_PROJECT and sync portal (PT restore). */
export async function markEmployeesOnProject(
  db: Prisma.TransactionClient,
  employeeIds: string[],
  companyId: string
) {
  if (employeeIds.length === 0) return;

  const employees = await db.employee.findMany({
    where: { id: { in: employeeIds }, companyId, status: "ACTIVE" },
    select: {
      id: true,
      companyId: true,
      firstName: true,
      lastName: true,
      employeeNo: true,
      employmentType: true,
      portalAccessRequested: true,
      userId: true,
      user: { select: { active: true } },
      status: true,
    },
  });

  for (const employee of employees) {
    // Portal 2A: PT forced Yes On Project; FT keep existing Yes/No (do not force).
    // Revoked logins stay off until Users → Restore Access.
    const portalAccessRequested =
      employee.employmentType === "PART_TIME" &&
      !isEmployeeLoginRevoked(employee)
        ? true
        : employee.portalAccessRequested;

    await db.employee.update({
      where: { id: employee.id },
      data: {
        placement: "ON_PROJECT",
        employeeType: "PROJECT_SITE",
        portalAccessRequested,
      },
    });

    await syncEmployeePortalLogin(db, {
      companyId: employee.companyId,
      employeeId: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeNo: employee.employeeNo,
      employmentType: employee.employmentType,
      placement: "ON_PROJECT",
      portalAccessRequested,
      status: employee.status,
      userId: employee.userId,
      employeeType: "PROJECT_SITE",
    });
  }
}
