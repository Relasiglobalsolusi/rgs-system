import type {
  EmployeeType,
  EmploymentType,
  Placement,
  Prisma,
} from "@prisma/client";

import { softDeactivateEmployeeLogin } from "@/lib/linked-login-lifecycle";
import { employeeTypeFromPlacement } from "@/lib/placement";
import { provisionEmployeeUser } from "@/lib/provision-linked-user";

type Tx = Prisma.TransactionClient;

export const LOGIN_REVOKED_PT_OFF_PROJECT =
  "Part-time portal access is only available while you are assigned to a project (On project). Contact operations if you believe this is a mistake.";

export const LOGIN_REVOKED_PT_OFF_PROJECT_ID =
  "Akses portal paruh waktu hanya tersedia saat Anda ditugaskan ke proyek (Di proyek). Hubungi operasional jika ini keliru.";

/**
 * Whether this employee should currently have an active portal login.
 * - FT: yes when portalAccessRequested (or already has an account to keep on)
 * - PT: only when ON_PROJECT and portal is requested / needed
 */
export function shouldHaveActivePortalLogin(options: {
  employmentType: EmploymentType;
  placement: Placement;
  portalAccessRequested: boolean;
  hasLinkedUser: boolean;
  status: string;
}): boolean {
  if (options.status !== "ACTIVE") {
    return false;
  }

  if (options.employmentType === "FULL_TIME") {
    // FT: login always on when they have (or requested) an account
    return options.portalAccessRequested || options.hasLinkedUser;
  }

  // PT: revoke when not ON_PROJECT; restore/create when ON_PROJECT
  return options.placement === "ON_PROJECT" && options.portalAccessRequested;
}

/**
 * Default portal Yes/No for create/import when not specified.
 * Site/ops crew → Yes; Corporate can still opt in via Excel/form.
 */
export function defaultPortalAccessRequested(options: {
  placement: Placement;
  categorySlug?: string | null;
}): boolean {
  if (options.placement === "HEAD_OFFICE") {
    return true;
  }
  const slug = (options.categorySlug ?? "").trim().toLowerCase();
  if (slug === "corporate") {
    return true;
  }
  // Site crew default need access
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
    await tx.employee.update({
      where: { id: options.employeeId },
      data: { loginRevokedReason: null },
    });
    return { active: true as const };
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
