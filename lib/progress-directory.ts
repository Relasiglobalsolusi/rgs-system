import type { ProjectSubCategory } from "@prisma/client";

import {
  ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID,
  isAttendanceInternalProject,
} from "@/lib/attendance-internal-sites";

export const PROGRESS_INTERNAL_ROUTE_CLIENT_ID =
  ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID;

export type ProgressClientRow = {
  id: string;
  name: string;
  shortCode: string;
  projectNames: string[];
  projectCount: number;
  reportCount: number;
};

export type ProgressProjectRow = {
  id: string;
  name: string;
  location: string | null;
  subCategory: ProjectSubCategory;
  reportCount: number;
};

export type ProgressInternalSummary = {
  projectCount: number;
  siteNames: string[];
  reportCount: number;
};

export type ProgressDirectory = {
  clients: ProgressClientRow[];
  internal: ProgressInternalSummary | null;
};

export function progressRouteClientId(project: {
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
    return PROGRESS_INTERNAL_ROUTE_CLIENT_ID;
  }
  return project.clientId;
}
