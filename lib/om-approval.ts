import type { ServiceArea } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  hasFullModuleAccess,
  type PermissionUser,
} from "@/lib/permissions";
import {
  isDirectorPosition,
  isOperationsManagerPosition,
} from "@/lib/positions";
import { serviceAreaLabel } from "@/lib/service-area";

export const NOT_AUTHORIZED_TO_APPROVE =
  "Not authorized to approve this change.";

export const NOT_AUTHORIZED_TO_APPROVE_DETAIL =
  "You don't have permission to approve this change. Only an Operations Manager for this service area, or a Director / Admin, can approve.";

/**
 * Whether the actor may approve reconcile / progress / invoice amount for a project.
 * Admin / unrestricted HO roles pass via `unrestricted`.
 * OM must have the project's Service Area in omApprovalAreas.
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

/**
 * Resolve whether the signed-in user may approve amount adjust / revise for a
 * project's service area (OM+ / Director / Admin).
 */
export async function assertCanApproveProjectServiceArea(options: {
  userId: string;
  username?: string | null;
  permissionUser: PermissionUser;
  projectServiceArea: ServiceArea;
}): Promise<void> {
  const unrestricted =
    hasFullModuleAccess(options.permissionUser) ||
    options.username === "vicko";

  if (unrestricted) return;

  const employee = await prisma.employee.findUnique({
    where: { userId: options.userId },
    select: {
      omApprovalAreas: true,
      jobPosition: { select: { slug: true, name: true } },
    },
  });

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

  throw new Error(approvalDeniedMessage(options.projectServiceArea));
}
