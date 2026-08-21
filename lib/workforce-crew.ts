import type { Prisma } from "@prisma/client";

import { OPEN_PROJECT_ASSIGNMENT_STATUSES } from "@/lib/employee-projects";
import { releaseProjectEquipmentToInventory } from "@/lib/inventory-project-release";
import {
  jakartaTodayAsUtcDateOnly,
  syncEmployeesLeaveEmploymentStatus,
} from "@/lib/leave-employment-status";
import { occupyingProjectAssignmentWhere } from "@/lib/petty-cash";
import { employeeTypeFromPlacement } from "@/lib/placement";
import {
  isInHouseCleaningStaffPosition,
  isOperationsManagerPosition,
} from "@/lib/positions";
import { isMilestoneSubCategory } from "@/lib/project-billing";
import { isExtendableContractSubCategory } from "@/lib/project-contract";
import { toUtcDateOnly } from "@/lib/invoice-period";
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
      slug: { in: ["cleaning-staff", "gc-staff", "technician"] },
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
  /** Include Cleaning / GC Operations crew (default true). */
  includeCleaningStaff?: boolean;
  /** Include In-House Cleaning Staff (Internal projects only). */
  includeInHouseCleaning?: boolean;
  /** Include Security staff (Security projects). */
  includeSecurityStaff?: boolean;
  /** Include Parking staff (Parking projects). */
  includeParkingStaff?: boolean;
  /** Keep employees already linked to this project in the picker. */
  includeAssignedToProjectId?: string;
};

function positionContainsWhere(term: string): Prisma.PositionWhereInput {
  return {
    active: true,
    OR: [
      { slug: { contains: term, mode: "insensitive" } },
      { name: { contains: term, mode: "insensitive" } },
    ],
  };
}

/** Available full-time Security staff for regular Security assignment. */
export function availableSecurityCrewWhere(
  companyId: string
): Prisma.EmployeeWhereInput {
  return {
    companyId,
    status: "ACTIVE",
    jobPosition: positionContainsWhere("security"),
    employmentType: "FULL_TIME",
    placement: "AVAILABLE",
  };
}

/** Available full-time Parking staff for regular Parking assignment. */
export function availableParkingCrewWhere(
  companyId: string
): Prisma.EmployeeWhereInput {
  return {
    companyId,
    status: "ACTIVE",
    jobPosition: positionContainsWhere("parking"),
    employmentType: "FULL_TIME",
    placement: "AVAILABLE",
  };
}

export function crewOptionsForSubCategory(
  subCategory: string | null | undefined
): AssignableCrewWhereOptions {
  if (subCategory === "SECURITY" || subCategory === "ONE_TIME_SECURITY") {
    return {
      includeCleaningStaff: false,
      includeSecurityStaff: true,
      includeParkingStaff: false,
    };
  }
  if (subCategory === "PARKING") {
    return {
      includeCleaningStaff: false,
      includeSecurityStaff: false,
      includeParkingStaff: true,
    };
  }
  if (subCategory === "INTERNAL") {
    return {
      includeCleaningStaff: true,
      includeInHouseCleaning: true,
      includeSecurityStaff: false,
      includeParkingStaff: false,
    };
  }
  return {
    includeCleaningStaff: true,
    includeSecurityStaff: false,
    includeParkingStaff: false,
  };
}

/** Staff picker / eligibility OR branches for project assignment. */
export function assignableProjectCrewOrWhere(
  companyId: string,
  options?: AssignableCrewWhereOptions
): Prisma.EmployeeWhereInput[] {
  const includeCleaning = options?.includeCleaningStaff !== false;
  const branches: Prisma.EmployeeWhereInput[] = [];
  if (includeCleaning) {
    branches.push({
      AND: [availableFullTimeCrewWhere(companyId), { operationsTeamMembership: null }],
    });
  }
  if (options?.includeInHouseCleaning) {
    branches.push(availableInHouseCleaningCrewWhere(companyId));
  }
  if (options?.includeSecurityStaff) {
    branches.push(availableSecurityCrewWhere(companyId));
  }
  if (options?.includeParkingStaff) {
    branches.push(availableParkingCrewWhere(companyId));
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
 * Commercial: Available FT Ops Cleaning/GC. Part-time backups use Assign Backup.
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
    allowParkingStaff?: boolean;
    includeCleaningStaff?: boolean;
  }
) {
  const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  await syncEmployeesLeaveEmploymentStatus(db, uniqueIds);

  const validCount = await db.employee.count({
    where: {
      id: { in: uniqueIds },
      OR: assignableProjectCrewOrWhere(companyId, {
        includeCleaningStaff: options?.includeCleaningStaff,
        includeInHouseCleaning: options?.allowInHouseCleaning,
        includeSecurityStaff: options?.allowSecurityStaff,
        includeParkingStaff: options?.allowParkingStaff,
      }),
    },
  });

  if (validCount !== uniqueIds.length) {
    if (options?.allowSecurityStaff) {
      throw new Error(
        "Select Available Security Staff and/or Part Time Security staff only."
      );
    }
    if (options?.allowParkingStaff) {
      throw new Error(
        "Select Available Parking Staff and/or Part Time Parking staff only."
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
      AND: [occupyingProjectAssignmentWhere()],
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

  const { voidScheduledPartTimePays } = await import("@/lib/petty-cash");
  await voidScheduledPartTimePays(db, { projectId, employeeIds: uniqueIds });

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
 * Billing review agree / period approve:
 *
 * - GC / Facade: release crew + equipment when the client approves the FINAL
 *   part (100% / last scheduled / one-shot ON_COMPLETION). Intermediate parts
 *   keep the crew — remaining work is still on site.
 * - Regular Cleaning + Security: never release on monthly period agree. Crew
 *   stays until End Contract (`finishProject`).
 *
 * Mark Paid / money arriving must NOT call this. Project Complete is a later
 * step (last invoice collected), not the demobilization moment.
 */
export function isFinalGcFacadePart(opts: {
  billingMode: string | null | undefined;
  milestonePercent: number | null | undefined;
  schedulePercents?: Array<number | null | undefined>;
}): boolean {
  if (opts.billingMode === "ON_COMPLETION") return true;
  const pct = opts.milestonePercent;
  if (pct == null || !Number.isFinite(pct)) return false;
  const scheduled = (opts.schedulePercents ?? []).filter(
    (p): p is number => p != null && Number.isFinite(p)
  );
  const maxScheduled = scheduled.length > 0 ? Math.max(...scheduled) : 100;
  return pct >= 100 || pct >= maxScheduled;
}

export function shouldReleaseCrewAfterBillingReviewAgree(opts: {
  subCategory: string | null | undefined;
  billingMode: string | null | undefined;
  milestonePercent: number | null | undefined;
  schedulePercents?: Array<number | null | undefined>;
  periodEnd?: Date | null;
  contractEndDate?: Date | null;
  isLastVisit?: boolean;
}): boolean {
  if (opts.billingMode === "MULTI_VISIT") {
    return opts.isLastVisit === true;
  }
  if (isMilestoneSubCategory(opts.subCategory)) {
    return isFinalGcFacadePart(opts);
  }
  if (
    isExtendableContractSubCategory(opts.subCategory) &&
    opts.periodEnd &&
    opts.contractEndDate
  ) {
    return (
      toUtcDateOnly(opts.periodEnd).getTime() >=
      toUtcDateOnly(opts.contractEndDate).getTime()
    );
  }
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

/**
 * After a backup end date, the part-timer is no longer on that site.
 * Keep the assignment row for payroll history. Void leftover scheduled
 * petty cash, and return them to Available when they have no other live cover.
 */
export async function releaseExpiredBackupCrew(
  db: Pick<Prisma.TransactionClient, "projectAssignment" | "employee">,
  companyId: string,
  referenceDate: Date = new Date()
) {
  const today = jakartaTodayAsUtcDateOnly(referenceDate);
  const expired = await db.projectAssignment.findMany({
    where: {
      isBackup: true,
      backupEndDate: { lt: today },
      project: { companyId },
      employee: { placement: "ON_PROJECT", status: "ACTIVE" },
    },
    select: {
      projectId: true,
      employeeId: true,
      employee: { select: employeeReleaseSelect },
    },
  });
  if (expired.length === 0) return;

  const { voidScheduledPartTimePays } = await import("@/lib/petty-cash");
  const seenPays = new Set<string>();
  for (const row of expired) {
    const key = `${row.projectId}:${row.employeeId}`;
    if (seenPays.has(key)) continue;
    seenPays.add(key);
    await voidScheduledPartTimePays(db as never, {
      projectId: row.projectId,
      employeeIds: [row.employeeId],
    });
  }

  const employeeIds = [...new Set(expired.map((row) => row.employeeId))];
  const remaining = await db.projectAssignment.findMany({
    where: {
      employeeId: { in: employeeIds },
      AND: [occupyingProjectAssignmentWhere(referenceDate)],
      project: { status: { in: OPEN_PROJECT_ASSIGNMENT_STATUSES } },
    },
    select: { employeeId: true },
  });
  const stillOnSite = new Set(remaining.map((row) => row.employeeId));
  const byEmployee = new Map(
    expired.map((row) => [row.employeeId, row.employee])
  );

  for (const employeeId of employeeIds) {
    if (stillOnSite.has(employeeId)) continue;
    const employee = byEmployee.get(employeeId);
    if (!employee) continue;

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

    await syncEmployeePortalLogin(db as Prisma.TransactionClient, {
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

export async function stampEmployeeDepositSourceProject(
  db: Prisma.TransactionClient,
  employeeIds: string[],
  project: { id: string; subCategory: string }
) {
  if (employeeIds.length === 0) return;
  if (project.subCategory === "INTERNAL") return;
  await db.employee.updateMany({
    where: { id: { in: employeeIds } },
    data: { depositSourceProjectId: project.id },
  });
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
    // Portal 2A: PT forced Yes On Project so backups can CICO the same day.
    // FT keep existing Yes/No (do not force).
    const portalAccessRequested =
      employee.employmentType === "PART_TIME"
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
