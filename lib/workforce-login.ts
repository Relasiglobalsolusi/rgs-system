import type {
  EmployeeType,
  EmploymentType,
  Placement,
  Prisma,
} from "@prisma/client";

import { softDeactivateEmployeeLogin } from "@/lib/linked-login-lifecycle";
import { employeeTypeFromPlacement } from "@/lib/placement";
import {
  isInHouseCleaningStaffPosition,
  isWarehouseStaffPosition,
  isWarehouseSupervisorPosition,
} from "@/lib/positions";
import { provisionEmployeeUser } from "@/lib/provision-linked-user";

type Tx = Prisma.TransactionClient;

export const LOGIN_REVOKED_PT_OFF_PROJECT =
  "Part Time portal access is only available while you are assigned to a project (On Project). Contact operations if you believe this is a mistake.";

/**
 * Whether this employee should currently have an active portal login.
 * - FT: yes only when portalAccessRequested (Portal No must revoke even if linked)
 * - PT: only when ON_PROJECT and portal is requested
 * hasLinkedUser is kept for call-site compatibility; it must not keep FT active.
 */
export function shouldHaveActivePortalLogin(options: {
  employmentType: EmploymentType;
  placement: Placement;
  portalAccessRequested: boolean;
  /** Retained for call sites; must not keep Full Time login active when portal is No. */
  hasLinkedUser: boolean;
  status: string;
  jobPosition?: { slug?: string | null; name?: string | null } | null;
}): boolean {
  void options.hasLinkedUser;
  void options.jobPosition;

  if (
    options.status !== "ACTIVE" &&
    options.status !== "ON_LEAVE" &&
    options.status !== "LEAVE_PENDING"
  ) {
    return false;
  }

  if (options.employmentType === "FULL_TIME") {
    return options.portalAccessRequested;
  }

  // PT: revoke when not ON_PROJECT; restore/create when ON_PROJECT
  return options.placement === "ON_PROJECT" && options.portalAccessRequested;
}

/**
 * Default portal Yes/No for create/import when not specified.
 * - Warehouse Staff → No (floor crew; Supervisor directs them)
 * - Warehouse Supervisor / In-House Cleaning / Corporate desk / field crew → Yes
 */
export function defaultPortalAccessRequested(options: {
  placement: Placement;
  categorySlug?: string | null;
  jobPosition?: { slug?: string | null; name?: string | null } | null;
}): boolean {
  if (isWarehouseStaffPosition(options.jobPosition ?? {})) {
    return false;
  }
  if (
    isWarehouseSupervisorPosition(options.jobPosition ?? {}) ||
    isInHouseCleaningStaffPosition(options.jobPosition ?? {})
  ) {
    return true;
  }
  if (options.placement === "HEAD_OFFICE") {
    return true;
  }
  const slug = (options.categorySlug ?? "").trim().toLowerCase();
  if (slug === "corporate" || slug === "warehouse") {
    return true;
  }
  // Site / operations crew default need access for CICO
  return true;
}

export async function syncEmployeePortalLogin(
  tx: Tx,
  options: {
    companyId: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    employeeNo: string;
    employmentType: EmploymentType;
    placement: Placement;
    portalAccessRequested: boolean;
    status: string;
    userId?: string | null;
    employeeType?: EmployeeType;
    jobPosition?: { slug?: string | null; name?: string | null } | null;
  }
) {
  const employeeType =
    options.employeeType ?? employeeTypeFromPlacement(options.placement);

  const shouldActive = shouldHaveActivePortalLogin({
    employmentType: options.employmentType,
    placement: options.placement,
    portalAccessRequested: options.portalAccessRequested,
    hasLinkedUser: Boolean(options.userId),
    status: options.status,
    jobPosition: options.jobPosition,
  });

  if (shouldActive) {
    await provisionEmployeeUser(tx, {
      companyId: options.companyId,
      employeeId: options.employeeId,
      firstName: options.firstName,
      lastName: options.lastName,
      employeeNo: options.employeeNo,
      placement: options.placement,
      employeeType,
    });
    const linked = await tx.employee.findUnique({
      where: { id: options.employeeId },
      select: { user: { select: { active: true } } },
    });
    if (linked?.user?.active) {
      await tx.employee.update({
        where: { id: options.employeeId },
        data: { loginRevokedReason: null },
      });
      return { active: true as const };
    }
    return { active: false as const };
  }

  if (options.userId) {
    await softDeactivateEmployeeLogin(tx, options.userId);
    const reason =
      options.employmentType === "PART_TIME" &&
      options.placement !== "ON_PROJECT"
        ? LOGIN_REVOKED_PT_OFF_PROJECT
        : null;
    await tx.employee.update({
      where: { id: options.employeeId },
      data: { loginRevokedReason: reason },
    });
  }

  return { active: false as const };
}
