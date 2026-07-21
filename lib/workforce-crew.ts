import type { Prisma } from "@prisma/client";

import { isCrewPickerPosition } from "@/lib/positions";
import { syncEmployeePortalLogin } from "@/lib/workforce-login";

/**
 * Default crew picker for Planning → In Progress:
 * Available FT in Operations with Cleaning/GC positions (exclude OM).
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

/** Part Time Roster — never labeled “available”; ready to add to a project. */
export function partTimeRosterWhere(
  companyId: string
): Prisma.EmployeeWhereInput {
  return {
    companyId,
    status: "ACTIVE",
    employmentType: "PART_TIME",
  };
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

/**
 * After GC/Facade progress review is approved: release assigned staff → AVAILABLE.
 * Regular Cleaning keeps staff after reconcile — do not call this for MONTHLY/RC.
 */
export async function releaseProjectCrewAfterProgressApproved(
  db: Prisma.TransactionClient,
  projectId: string
) {
  const assignments = await db.projectAssignment.findMany({
    where: { projectId },
    select: {
      employeeId: true,
      employee: {
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
          category: { select: { slug: true, prefix: true } },
        },
      },
    },
  });

  for (const row of assignments) {
    const employee = row.employee;
    await db.projectAssignment.deleteMany({
      where: { projectId, employeeId: employee.id },
    });

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
    // PT always needs portal while On project; FT keep existing / default Yes for site work.
    const portalAccessRequested =
      employee.employmentType === "PART_TIME"
        ? true
        : employee.portalAccessRequested || true;

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
