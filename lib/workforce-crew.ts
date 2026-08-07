import type { Prisma } from "@prisma/client";

import { OPEN_PROJECT_ASSIGNMENT_STATUSES } from "@/lib/employee-projects";
import { releaseProjectEquipmentToInventory } from "@/lib/inventory-project-release";
import { syncEmployeesLeaveEmploymentStatus } from "@/lib/leave-employment-status";
import { employeeTypeFromPlacement } from "@/lib/placement";
import {
  isInHouseCleaningStaffPosition,
  isOperationsManagerPosition,
} from "@/lib/positions";
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
 * In-House Cleaning Staff (Corporate / Warehouse) for Internal HO/Warehouse sites.
 * Start as HEAD_OFFICE; AVAILABLE after Employees → Release.
 */
export function availableInHouseCleaningCrewWhere(
  companyId: string
): Prisma.EmployeeWhereInput {
  return {
    companyId,
    status: "ACTIVE",
    employmentType: "FULL_TIME",
    placement: { in: ["HEAD_OFFICE", "AVAILABLE"] },
    category: {
      active: true,
      slug: { in: ["corporate", "warehouse"] },
    },
    jobPosition: {
      active: true,
      slug: "in-house-cleaning-staff",
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

export type AssignableCrewWhereOptions = {
  /** Include In-House Cleaning Staff (Internal projects only). */
  includeInHouseCleaning?: boolean;
  /** Include Security staff (Security projects). */
  includeSecurityStaff?: boolean;
  /** Keep employees already linked to this project in the picker. */
  includeAssignedToProjectId?: string;
};

/** Available FT Security staff for Security project assignment. */
export function availableSecurityCrewWhere(
  companyId: string
): Prisma.EmployeeWhereInput {
  return {
    companyId,
    status: "ACTIVE",
    employmentType: "FULL_TIME",
    placement: "AVAILABLE",
    jobPosition: {
      active: true,
      OR: [
        { slug: { contains: "security", mode: "insensitive" } },
        { name: { contains: "Security", mode: "insensitive" } },
      ],
    },
  };
}

/** Staff picker / eligibility OR branches for project assignment. */
export function assignableProjectCrewOrWhere(
  companyId: string,
  options?: AssignableCrewWhereOptions
): Prisma.EmployeeWhereInput[] {
  const branches: Prisma.EmployeeWhereInput[] = [
    availableFullTimeCrewWhere(companyId),
    partTimeRosterWhere(companyId),
  ];
  if (options?.includeInHouseCleaning) {
    branches.push(availableInHouseCleaningCrewWhere(companyId));
  }
  if (options?.includeSecurityStaff) {
    branches.push(availableSecurityCrewWhere(companyId));
  }
  if (options?.includeAssignedToProjectId) {
    branches.push({
      projectAssignments: {
        some: { projectId: options.includeAssignedToProjectId },
      },
    });
  }
  return branches;
}

/**
 * HO / invalid crew must not be assignable as project staff.
 * Commercial: Available FT Ops Cleaning/GC + PT roster.
 * Internal: also In-House Cleaning Staff (Corporate / Warehouse).
 */
type CrewEligibilityDb = Pick<
  Prisma.TransactionClient,
  "employee" | "leaveRequest" | "projectAssignment"
>;

export async function assertProjectCrewEligible(
  db: CrewEligibilityDb,
  companyId: string,
  employeeIds: string[],
  errorMessage = "Select Available Full Time Operations crew (Cleaning/GC) and/or Part Time staff only.",
  options?: {
    allowInHouseCleaning?: boolean;
    allowSecurityStaff?: boolean;
  }
) {
  const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  await syncEmployeesLeaveEmploymentStatus(db, uniqueIds);

  const validCount = await db.employee.count({
    where: {
      id: { in: uniqueIds },
      OR: assignableProjectCrewOrWhere(companyId, {
        includeInHouseCleaning: options?.allowInHouseCleaning,
        includeSecurityStaff: options?.allowSecurityStaff,
      }),
    },
  });

  if (validCount !== uniqueIds.length) {
    if (options?.allowSecurityStaff) {
      throw new Error(
        "Select Available Full Time Security staff and/or Part Time staff only."
      );
    }
    throw new Error(
      options?.allowInHouseCleaning
        ? "Select Available Full Time Operations crew (Cleaning/GC), In-House Cleaning Staff, and/or Part Time staff only."
        : errorMessage
    );
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
  jobPosition: { select: { slug: true, name: true } },
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

    // In-House Cleaning → HEAD_OFFICE desk pool; Ops crew → AVAILABLE.
    const placement = isInHouseCleaningStaffPosition(employee.jobPosition ?? {})
      ? ("HEAD_OFFICE" as const)
      : ("AVAILABLE" as const);
    const employeeType = employeeTypeFromPlacement(placement);

    await db.employee.update({
      where: { id: employee.id },
      data: {
        placement,
        employeeType,
      },
    });

    await syncEmployeePortalLogin(db, {
      companyId: employee.companyId,
      employeeId: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeNo: employee.employeeNo,
      employmentType: employee.employmentType,
      placement,
      portalAccessRequested: employee.portalAccessRequested,
      status: employee.status,
      userId: employee.userId,
      employeeType,
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
 * Billing review agree / period approve must NEVER auto-release crew or equipment.
 *
 * - GC / Facade (MILESTONE or ON_COMPLETION): release only when the project is
 *   marked COMPLETED (Finish / final completion path) — never when a part closes.
 * - Regular Cleaning + Security (`isContractCycleSubCategory`): release only on
 *   End Contract (`finishProject`), not on monthly billing agree. Mid-contract
 *   assign/release stays manual.
 *
 * Do not key “don’t release” solely on `billingMode === MONTHLY` — that wrongly
 * conflates Regular Cleaning with other MONTHLY modes. Call sites keep this gate
 * so product rules stay explicit.
 */
export function shouldReleaseCrewAfterBillingReviewAgree(_opts: {
  subCategory: string | null | undefined;
  billingMode: string | null | undefined;
  milestonePercent: number | null | undefined;
}): boolean {
  return false;
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
