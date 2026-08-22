import type { Prisma, ProjectSubCategory } from "@prisma/client";

import {
  ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID,
  isAttendanceInternalProject,
} from "@/lib/attendance-internal-sites";

export const SHIFTS_INTERNAL_ROUTE_CLIENT_ID = ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID;

export type ShiftsClientRow = {
  id: string;
  name: string;
  projectCount: number;
};

export type ShiftsProjectRow = {
  id: string;
  name: string;
  location: string | null;
  subCategory: ProjectSubCategory;
  serviceArea: string;
  staffCount: number;
};

export type ShiftsInternalSummary = {
  projectCount: number;
  siteNames: string[];
};

export type ShiftsDirectory = {
  clients: ShiftsClientRow[];
  internal: ShiftsInternalSummary | null;
};

export function shiftsRouteClientId(project: {
  clientId?: string | null;
  name?: string;
  serviceArea?: string | null;
  subCategory?: string | null;
}): string {
  if (
    !project.clientId ||
    (project.name != null &&
      isAttendanceInternalProject({
        name: project.name,
        serviceArea: project.serviceArea,
        subCategory: project.subCategory,
      }))
  ) {
    return SHIFTS_INTERNAL_ROUTE_CLIENT_ID;
  }
  return project.clientId;
}

export function shiftsClientHref(clientId: string): string {
  return `/shifts/${clientId}`;
}

export function shiftsProjectHref(input: {
  clientId?: string | null;
  projectId: string;
  name?: string;
  serviceArea?: string | null;
  subCategory?: string | null;
}): string {
  return `/shifts/${shiftsRouteClientId(input)}/${input.projectId}`;
}

/** Live roster rows counted on project cards (regular + current backup). */
export function shiftsLiveAssignmentWhere(
  today: Date
): Prisma.ProjectAssignmentWhereInput {
  return {
    employee: { status: { in: ["ACTIVE", "ON_LEAVE", "LEAVE_PENDING"] } },
    OR: [
      { isBackup: false },
      { isBackup: true, backupEndDate: { gte: today } },
    ],
  };
}
