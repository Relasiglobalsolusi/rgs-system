import type { EmployeeType, Placement, ServiceArea } from "@prisma/client";

import { OPEN_PROJECT_ASSIGNMENT_STATUSES } from "@/lib/employee-projects";
import { canApproveServiceArea } from "@/lib/om-approval";
import { prisma } from "@/lib/prisma";
import { isHeadOfficePlacement } from "@/lib/placement";
import {
  isHoAdminAccount,
  type AccountTypeUser,
  type PermissionUser,
} from "@/lib/permissions";
import {
  isCrewPickerPosition,
  isDirectorPosition,
  isOperationsManagerPosition,
  isParkingStaffPosition,
  isSecurityStaffPosition,
} from "@/lib/positions";

export type LeaveRequesterTier =
  | "DIRECTOR"
  | "OPERATIONS_MANAGER"
  | "HO_STAFF"
  | "FIELD_CREW";

export type LeaveRequesterProfile = {
  employeeId: string;
  userId?: string | null;
  employeeType?: EmployeeType | null;
  placement?: Placement | null;
  jobPosition?: { slug?: string | null; name?: string | null } | null;
  projectServiceAreas?: ServiceArea[];
};

export type LeaveReviewerProfile = {
  userId: string;
  username?: string | null;
  isHoAdmin: boolean;
  employeeId?: string | null;
  jobPosition?: { slug?: string | null; name?: string | null } | null;
  omApprovalAreas?: ServiceArea[] | null;
};

export const leaveRequestEmployeeSelect = {
  id: true,
  userId: true,
  employeeType: true,
  placement: true,
  jobPosition: { select: { slug: true, name: true } },
  projectAssignments: {
    select: {
      project: { select: { serviceArea: true, status: true } },
    },
  },
} as const;

export type LeaveRequestWithEmployee = {
  id: string;
  employee: {
    id: string;
    userId: string | null;
    employeeType: EmployeeType;
    placement: Placement;
    jobPosition: { slug: string; name: string } | null;
    projectAssignments: Array<{
      project: { serviceArea: ServiceArea; status: string };
    }>;
  };
};

export function isHeadOfficeEmployeeProfile(profile: {
  employeeType?: EmployeeType | null;
  placement?: Placement | null;
}): boolean {
  return (
    profile.employeeType === "HEAD_OFFICE" ||
    isHeadOfficePlacement(profile.placement)
  );
}

/** Classify the requester for hierarchical leave approval. */
export function getLeaveRequesterTier(
  requester: LeaveRequesterProfile
): LeaveRequesterTier {
  const position = requester.jobPosition;
  if (position && isDirectorPosition(position)) return "DIRECTOR";
  if (position && isOperationsManagerPosition(position)) {
    return "OPERATIONS_MANAGER";
  }
  if (isHeadOfficeEmployeeProfile(requester)) return "HO_STAFF";
  return "FIELD_CREW";
}

/** Default service area from position when no active project assignment applies. */
export function serviceAreaFromPosition(
  position?: { slug?: string | null; name?: string | null } | null
): ServiceArea {
  if (!position) return "CLEANING";
  if (isSecurityStaffPosition(position)) return "SECURITY";
  if (isParkingStaffPosition(position)) return "PARKING";
  if (isCrewPickerPosition(position)) return "CLEANING";
  return "CLEANING";
}

function activeProjectServiceAreas(
  assignments: LeaveRequestWithEmployee["employee"]["projectAssignments"]
): ServiceArea[] {
  const areas = assignments
    .filter((row) =>
      OPEN_PROJECT_ASSIGNMENT_STATUSES.includes(
        row.project.status as (typeof OPEN_PROJECT_ASSIGNMENT_STATUSES)[number]
      )
    )
    .map((row) => row.project.serviceArea)
    .filter((area) => area !== "HEAD_OFFICE");

  return [...new Set(areas)];
}

/**
 * Service areas that determine which OM approval checkboxes apply to this requester.
 * HO staff → Head Office. Field crew → active project area(s) or position default.
 */
export function getLeaveRequesterServiceAreas(
  requester: LeaveRequesterProfile
): ServiceArea[] {
  const tier = getLeaveRequesterTier(requester);

  if (tier === "HO_STAFF") return ["HEAD_OFFICE"];

  if (tier === "FIELD_CREW") {
    const fromProjects = requester.projectServiceAreas ?? [];
    if (fromProjects.length > 0) {
      return fromProjects;
    }
    return [serviceAreaFromPosition(requester.jobPosition)];
  }

  return [];
}

export function leaveRequesterFromEmployee(
  employee: LeaveRequestWithEmployee["employee"]
): LeaveRequesterProfile {
  return {
    employeeId: employee.id,
    userId: employee.userId,
    employeeType: employee.employeeType,
    placement: employee.placement,
    jobPosition: employee.jobPosition,
    projectServiceAreas: activeProjectServiceAreas(employee.projectAssignments),
  };
}

function isReviewerDirector(reviewer: LeaveReviewerProfile): boolean {
  return (
    reviewer.jobPosition != null && isDirectorPosition(reviewer.jobPosition)
  );
}

function isReviewerOperationsManager(reviewer: LeaveReviewerProfile): boolean {
  return (
    reviewer.jobPosition != null &&
    isOperationsManagerPosition(reviewer.jobPosition)
  );
}

function omCanApproveRequesterAreas(
  reviewer: LeaveReviewerProfile,
  requesterAreas: ServiceArea[]
): boolean {
  if (!isReviewerOperationsManager(reviewer) || requesterAreas.length === 0) {
    return false;
  }

  return requesterAreas.some((area) =>
    canApproveServiceArea({
      omApprovalAreas: reviewer.omApprovalAreas,
      projectServiceArea: area,
    })
  );
}

/**
 * Whether `reviewer` may approve a leave request from `requester`.
 *
 * | Requester tier   | Main HO admin | Director | OM (matching area) |
 * |------------------|---------------|----------|----------------------|
 * | Field crew       | yes           | yes      | yes                  |
 * | HO staff         | yes           | yes      | Head Office only     |
 * | Operations Mgr   | yes           | yes      | no                   |
 * | Director         | yes           | no       | no                   |
 */
export function canApproveLeaveRequest(
  requester: LeaveRequesterProfile,
  reviewer: LeaveReviewerProfile
): boolean {
  if (
    (reviewer.employeeId && reviewer.employeeId === requester.employeeId) ||
    (reviewer.userId &&
      requester.userId &&
      reviewer.userId === requester.userId)
  ) {
    return false;
  }

  if (reviewer.isHoAdmin) return true;

  const tier = getLeaveRequesterTier(requester);
  const isDirector = isReviewerDirector(reviewer);

  switch (tier) {
    case "DIRECTOR":
      return false;
    case "OPERATIONS_MANAGER":
    case "HO_STAFF":
      return (
        isDirector ||
        omCanApproveRequesterAreas(
          reviewer,
          getLeaveRequesterServiceAreas(requester)
        )
      );
    case "FIELD_CREW":
      return (
        isDirector ||
        omCanApproveRequesterAreas(
          reviewer,
          getLeaveRequesterServiceAreas(requester)
        )
      );
    default:
      return false;
  }
}

export async function resolveLeaveReviewerProfile(options: {
  userId: string;
  username?: string | null;
  permissionUser: PermissionUser & AccountTypeUser;
}): Promise<LeaveReviewerProfile> {
  const { userId, username, permissionUser } = options;

  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: {
      id: true,
      omApprovalAreas: true,
      jobPosition: { select: { slug: true, name: true } },
    },
  });

  return {
    userId,
    username: username ?? null,
    isHoAdmin: isHoAdminAccount({
      ...permissionUser,
      username: username ?? undefined,
    }),
    employeeId: employee?.id ?? null,
    jobPosition: employee?.jobPosition ?? null,
    omApprovalAreas: employee?.omApprovalAreas ?? [],
  };
}

export function filterLeaveRequestsForReviewer<T extends LeaveRequestWithEmployee>(
  requests: T[],
  reviewer: LeaveReviewerProfile
): T[] {
  return requests.filter((request) =>
    canApproveLeaveRequest(
      leaveRequesterFromEmployee(request.employee),
      reviewer
    )
  );
}

/** True when the reviewer is the same person as the leave requester. */
export function isOwnLeaveRequest(
  request: LeaveRequestWithEmployee,
  reviewer: LeaveReviewerProfile
): boolean {
  const requester = leaveRequesterFromEmployee(request.employee);
  return Boolean(
    (reviewer.employeeId &&
      reviewer.employeeId === requester.employeeId) ||
      (reviewer.userId &&
        requester.userId &&
        reviewer.userId === requester.userId)
  );
}

/**
 * Pending leave submitted by the signed-in reviewer — visible for tracking,
 * but not actionable (self-approval is never allowed).
 */
export function filterOwnPendingLeaveRequests<
  T extends LeaveRequestWithEmployee,
>(requests: T[], reviewer: LeaveReviewerProfile): T[] {
  return requests.filter((request) => isOwnLeaveRequest(request, reviewer));
}

export async function countPendingLeaveRequestsForReviewer(options: {
  companyId: string;
  reviewer: LeaveReviewerProfile;
}): Promise<number> {
  const pending = await prisma.leaveRequest.findMany({
    where: {
      status: "PENDING",
      employee: { companyId: options.companyId },
    },
    select: {
      id: true,
      employee: { select: leaveRequestEmployeeSelect },
    },
  });

  return filterLeaveRequestsForReviewer(pending, options.reviewer).length;
}
