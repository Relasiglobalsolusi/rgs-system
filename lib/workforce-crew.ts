import type { Prisma } from "@prisma/client";

import { isCrewPickerPosition } from "@/lib/positions";
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
export async function assertProjectCrewEligible(
  db: { employee: { count: (args: { where: Prisma.EmployeeWhereInput }) => Promise<number> } },
  companyId: string,
  employeeIds: string[],
  errorMessage = "Select Available Full Time Operations crew (Cleaning/GC) and/or Part Time staff only."
) {
  const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

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
  status: true,
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

/** Release every assignee on a project → AVAILABLE + portal sync. */
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
      status: true,
    },
  });

  for (const employee of employees) {
    // Portal 2A: PT forced Yes On Project; FT keep existing Yes/No (do not force).
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
