import type { Prisma, ServiceArea } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  isOwnerAccount,
  type PermissionUser,
} from "@/lib/permissions";
import {
  isAreaManagerPosition,
  isDirectorPosition,
  isOperationsManagerPosition,
} from "@/lib/positions";
import { serviceAreaLabel } from "@/lib/service-area";

export const NOT_AUTHORIZED_TO_APPROVE_DETAIL =
  "You don't have permission to approve this change. Only an Operations Manager for this service area, an Area Manager for this project, or a Director / Admin, can approve.";

/**
 * Whether the actor may approve reconcile / progress / invoice amount for a project.
 * Admin / unrestricted HO roles pass via `unrestricted`.
 * OM must have the project's Service Area in omApprovalAreas.
 * Area Manager must have the project in their managed list.
 */
export function canApproveServiceArea(options: {
  unrestricted?: boolean;
  omApprovalAreas?: ServiceArea[] | null;
  projectServiceArea: ServiceArea;
}): boolean {
  if (options.unrestricted) return true;
  const areas = options.omApprovalAreas ?? [];
  return areas.includes(options.projectServiceArea);
}

export function approvalDeniedMessage(projectServiceArea: ServiceArea): string {
  return `${NOT_AUTHORIZED_TO_APPROVE_DETAIL} This project is ${serviceAreaLabel(projectServiceArea)}.`;
}

type ApprovalEmployee = {
  id: string;
  omApprovalAreas: ServiceArea[];
  manageAllProjects: boolean;
  jobPosition: { slug: string; name: string } | null;
  areaManagedProjects: Array<{ projectId: string }>;
};

async function loadApprovalEmployee(
  userId: string
): Promise<ApprovalEmployee | null> {
  return prisma.employee.findUnique({
    where: { userId },
    select: {
      id: true,
      omApprovalAreas: true,
      manageAllProjects: true,
      jobPosition: { select: { slug: true, name: true } },
      areaManagedProjects: { select: { projectId: true } },
    },
  });
}

/** OM with no saved project list still covers every project in their areas. */
export function managerCoversAllProjects(options: {
  isOperationsManager?: boolean;
  manageAllProjects?: boolean | null;
  managedProjectCount?: number;
}): boolean {
  if (options.manageAllProjects) return true;
  if (
    options.isOperationsManager &&
    (options.managedProjectCount ?? 0) === 0
  ) {
    return true;
  }
  return false;
}

function managedProjectIdsOf(employee: ApprovalEmployee): string[] {
  return employee.areaManagedProjects.map((row) => row.projectId);
}

function omCoversProject(employee: ApprovalEmployee, projectId: string): boolean {
  if (
    managerCoversAllProjects({
      isOperationsManager: true,
      manageAllProjects: employee.manageAllProjects,
      managedProjectCount: employee.areaManagedProjects.length,
    })
  ) {
    return true;
  }
  return managedProjectIdsOf(employee).includes(projectId);
}

function amCoversProject(employee: ApprovalEmployee, projectId: string): boolean {
  if (employee.manageAllProjects) return true;
  return managedProjectIdsOf(employee).includes(projectId);
}

/**
 * Resolve whether the signed-in user may approve amount adjust / revise /
 * material requests for a project's service area (OM+ / Area Manager / Director / Admin).
 */
export async function assertCanApproveProjectServiceArea(options: {
  userId: string;
  username?: string | null;
  permissionUser: PermissionUser;
  projectServiceArea: ServiceArea;
  projectId?: string | null;
}): Promise<void> {
  if (isOwnerAccount({ username: options.username })) return;

  const employee = await loadApprovalEmployee(options.userId);

  if (employee?.jobPosition && isDirectorPosition(employee.jobPosition)) {
    return;
  }

  const isOm =
    employee?.jobPosition != null &&
    isOperationsManagerPosition(employee.jobPosition);

  if (
    isOm &&
    employee &&
    canApproveServiceArea({
      omApprovalAreas: employee.omApprovalAreas,
      projectServiceArea: options.projectServiceArea,
    }) &&
    (!options.projectId || omCoversProject(employee, options.projectId))
  ) {
    return;
  }

  const isAm =
    employee?.jobPosition != null &&
    isAreaManagerPosition(employee.jobPosition);

  if (
    isAm &&
    employee &&
    options.projectId &&
    amCoversProject(employee, options.projectId)
  ) {
    return;
  }

  throw new Error(approvalDeniedMessage(options.projectServiceArea));
}

/** Area Manager, Operations Manager, Director, or Admin for this project. */
export async function canAssignSiteCover(options: {
  userId: string;
  username?: string | null;
  permissionUser: PermissionUser;
  projectServiceArea: ServiceArea;
  projectId?: string | null;
}): Promise<boolean> {
  try {
    await assertCanApproveProjectServiceArea(options);
    return true;
  } catch {
    return false;
  }
}

/**
 * List/filter scope for Operations Manager (service area) or Area Manager (projects).
 * Directors, Head Office admin, and other staff get no extra filter (null).
 */
export async function getOmServiceAreaListFilter(options: {
  userId?: string | null;
  username?: string | null;
  clientId?: string | null;
}): Promise<Prisma.ProjectWhereInput | null> {
  if (!options.userId || options.clientId) return null;
  if (options.username === "vicko") return null;

  const employee = await loadApprovalEmployee(options.userId);

  if (!employee?.jobPosition) return null;
  if (isDirectorPosition(employee.jobPosition)) return null;

  if (isOperationsManagerPosition(employee.jobPosition)) {
    const areas = employee.omApprovalAreas ?? [];
    if (areas.length === 0) {
      return { id: { in: [] } };
    }
    const allProjects = managerCoversAllProjects({
      isOperationsManager: true,
      manageAllProjects: employee.manageAllProjects,
      managedProjectCount: employee.areaManagedProjects.length,
    });
    if (allProjects) {
      return { serviceArea: { in: areas } };
    }
    const ids = employee.areaManagedProjects.map((row) => row.projectId);
    return {
      AND: [{ serviceArea: { in: areas } }, { id: { in: ids } }],
    };
  }

  if (isAreaManagerPosition(employee.jobPosition)) {
    if (employee.manageAllProjects) {
      return { subCategory: { not: "INTERNAL" } };
    }
    const ids = employee.areaManagedProjects.map((row) => row.projectId);
    return { id: { in: ids } };
  }

  return null;
}

export async function assertCanWriteProject(options: {
  userId: string;
  username?: string | null;
  projectId: string;
  serviceArea: ServiceArea;
}): Promise<void> {
  if (isOwnerAccount({ username: options.username })) return;

  const employee = await loadApprovalEmployee(options.userId);
  if (!employee?.jobPosition) return;
  if (isDirectorPosition(employee.jobPosition)) return;

  if (isOperationsManagerPosition(employee.jobPosition)) {
    if (
      canApproveServiceArea({
        omApprovalAreas: employee.omApprovalAreas,
        projectServiceArea: options.serviceArea,
      }) &&
      omCoversProject(employee, options.projectId)
    ) {
      return;
    }
    throw new Error(approvalDeniedMessage(options.serviceArea));
  }

  if (isAreaManagerPosition(employee.jobPosition)) {
    if (amCoversProject(employee, options.projectId)) {
      return;
    }
    throw new Error(approvalDeniedMessage(options.serviceArea));
  }
}

export async function assertCanCreateProjectInScope(options: {
  userId: string;
  username?: string | null;
  serviceArea: ServiceArea;
}): Promise<{ areaManagerEmployeeId: string | null }> {
  if (isOwnerAccount({ username: options.username })) {
    return { areaManagerEmployeeId: null };
  }

  const employee = await loadApprovalEmployee(options.userId);
  if (employee?.jobPosition && isDirectorPosition(employee.jobPosition)) {
    return { areaManagerEmployeeId: null };
  }

  if (
    employee?.jobPosition &&
    isOperationsManagerPosition(employee.jobPosition)
  ) {
    if (
      canApproveServiceArea({
        omApprovalAreas: employee.omApprovalAreas,
        projectServiceArea: options.serviceArea,
      })
    ) {
      const all = managerCoversAllProjects({
        isOperationsManager: true,
        manageAllProjects: employee.manageAllProjects,
        managedProjectCount: employee.areaManagedProjects.length,
      });
      return { areaManagerEmployeeId: all ? null : employee.id };
    }
    throw new Error(approvalDeniedMessage(options.serviceArea));
  }

  if (employee?.jobPosition && isAreaManagerPosition(employee.jobPosition)) {
    return { areaManagerEmployeeId: employee.id };
  }

  return { areaManagerEmployeeId: null };
}
