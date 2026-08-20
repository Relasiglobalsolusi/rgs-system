import type { Prisma, ServiceArea } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  hasFullModuleAccess,
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

export function canApproveManagedProject(options: {
  unrestricted?: boolean;
  managedProjectIds?: string[] | null;
  projectId: string;
}): boolean {
  if (options.unrestricted) return true;
  const ids = options.managedProjectIds ?? [];
  return ids.includes(options.projectId);
}

export function approvalDeniedMessage(projectServiceArea: ServiceArea): string {
  return `${NOT_AUTHORIZED_TO_APPROVE_DETAIL} This project is ${serviceAreaLabel(projectServiceArea)}.`;
}

type ApprovalEmployee = {
  omApprovalAreas: ServiceArea[];
  jobPosition: { slug: string; name: string } | null;
  areaManagedProjects: Array<{ projectId: string }>;
};

async function loadApprovalEmployee(
  userId: string
): Promise<ApprovalEmployee | null> {
  return prisma.employee.findUnique({
    where: { userId },
    select: {
      omApprovalAreas: true,
      jobPosition: { select: { slug: true, name: true } },
      areaManagedProjects: { select: { projectId: true } },
    },
  });
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
  const unrestricted = hasFullModuleAccess({
    ...options.permissionUser,
    username: options.username ?? undefined,
  });

  if (unrestricted) return;

  const employee = await loadApprovalEmployee(options.userId);

  if (employee?.jobPosition && isDirectorPosition(employee.jobPosition)) {
    return;
  }

  const isOm =
    employee?.jobPosition != null &&
    isOperationsManagerPosition(employee.jobPosition);

  if (
    isOm &&
    canApproveServiceArea({
      omApprovalAreas: employee?.omApprovalAreas,
      projectServiceArea: options.projectServiceArea,
    })
  ) {
    return;
  }

  const isAm =
    employee?.jobPosition != null &&
    isAreaManagerPosition(employee.jobPosition);

  if (
    isAm &&
    options.projectId &&
    canApproveManagedProject({
      managedProjectIds: employee?.areaManagedProjects.map(
        (row) => row.projectId
      ),
      projectId: options.projectId,
    })
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
    return { serviceArea: { in: areas } };
  }

  if (isAreaManagerPosition(employee.jobPosition)) {
    const ids = employee.areaManagedProjects.map((row) => row.projectId);
    return { id: { in: ids } };
  }

  return null;
}
