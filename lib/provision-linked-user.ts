import type { EmployeeType, Placement, Prisma } from "@prisma/client";

import { formatContactPersonName } from "@/lib/contact-person";
import {
  getClientModuleOverrides,
  getEmployeeModuleOverrides,
} from "@/lib/permissions";
import { nextSortOrderFromMax } from "@/lib/reorder";
import { resolveNewAccountPassword } from "@/lib/user-account";
import { allocateClientLoginId } from "@/lib/client-login-id";
import { isRosterActiveEmployeeStatus } from "@/lib/user-directory-status";
import { allocateUniqueUsername, normalizeUsername } from "@/lib/username";

type Tx = Prisma.TransactionClient;

async function nextUserSortOrder(tx: Tx, companyId: string) {
  const top = await tx.user.findFirst({
    where: { companyId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return nextSortOrderFromMax(top?.sortOrder);
}

async function usernameIsTaken(tx: Tx, username: string) {
  const normalized = normalizeUsername(username);
  const existing = await tx.user.findUnique({
    where: { username: normalized },
    select: { id: true },
  });
  return Boolean(existing);
}

/**
 * Creates or restores a login for an employee.
 * Username is derived from the employee's first name (not full name / company).
 * Password is unusable until first-login setup; recovery email is left unset.
 * - Soft-deleted / terminated / inactive employee → throws (restore first).
 * - Roster-active (ACTIVE or ON_LEAVE) only — same rules as login/session.
 * - Any linked user (active or revoked) → no-op (returns null).
 *   Use Users → Revoked Access → Restore Access to re-enable revoked logins.
 * - No linked user → allocates a new username and creates a User.
 * Callers should only invoke this after the employee is assigned to a department.
 */
export async function provisionEmployeeUser(
  tx: Tx,
  options: {
    companyId: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    employeeNo: string;
    placement: Placement;
    employeeType: EmployeeType;
  }
) {
  const existing = await tx.employee.findUnique({
    where: { id: options.employeeId },
    select: {
      status: true,
      userId: true,
      user: { select: { id: true, active: true } },
    },
  });

  if (!existing) {
    throw new Error("Employee not found.");
  }

  if (!isRosterActiveEmployeeStatus(existing.status)) {
    throw new Error(
      "Portal login cannot be generated for deleted or inactive employees. Restore the employee first."
    );
  }

  // Do not reactivate revoked/soft-deactivated logins here — Restore Access owns that.
  if (existing.userId && existing.user) {
    return null;
  }

  const displayName = `${options.firstName} ${options.lastName}`.trim();
  // Username source: employee.firstName (+ lastName initial on collision).
  const username = await allocateUniqueUsername({
    firstName: options.firstName,
    lastName: options.lastName,
    fallbackCode: options.employeeNo,
    isTaken: (candidate) => usernameIsTaken(tx, candidate),
  });

  const { passwordHash } = await resolveNewAccountPassword("");
  const moduleOverrides = getEmployeeModuleOverrides({
    placement: options.placement,
    employeeType: options.employeeType,
  });

  const sortOrder = await nextUserSortOrder(tx, options.companyId);

  const user = await tx.user.create({
    data: {
      name: displayName,
      username,
      email: null,
      passwordHash,
      mustSetPassword: true,
      role: "ADMIN",
      moduleOverrides,
      companyId: options.companyId,
      active: true,
      sortOrder,
    },
  });

  await tx.employee.update({
    where: { id: options.employeeId },
    data: { userId: user.id },
  });

  return user;
}

/**
 * Creates a portal login for a client (never reactivates revoked logins).
 * Login ID is an 8-letter company-based id (not contact person name).
 * Password is unusable until first-login setup; recovery email is left unset.
 * - Any linked user (active or revoked) → no-op (returns null).
 *   Use Users → Revoked Access → Restore Access to re-enable revoked logins.
 * - No linked user → allocates a new Login ID and creates a User.
 */
export async function provisionClientUser(
  tx: Tx,
  options: {
    companyId: string;
    clientId: string;
    /** Client organization name — source for Login ID suggestions. */
    clientName: string;
    contactPersonFirstName: string;
    contactPersonLastName?: string | null;
    /** Optional Admin-chosen Login ID (must be free 8× a–z). */
    preferredLoginId?: string | null;
  }
) {
  const client = await tx.client.findUnique({
    where: { id: options.clientId },
    select: { active: true },
  });

  if (!client) {
    throw new Error("Client not found.");
  }

  if (!client.active) {
    throw new Error(
      "Portal login cannot be generated for deleted clients. Restore the client first."
    );
  }

  const existingLogin = await tx.user.findFirst({
    where: { clientId: options.clientId },
    select: { id: true },
  });

  // Do not reactivate revoked/soft-deactivated logins here — Restore Access owns that.
  if (existingLogin) {
    return null;
  }

  const contactDisplay =
    formatContactPersonName(
      options.contactPersonFirstName,
      options.contactPersonLastName
    ) ?? options.clientName.trim();

  const username = await allocateClientLoginId({
    companyName: options.clientName,
    preferred: options.preferredLoginId,
    isTaken: (candidate) => usernameIsTaken(tx, candidate),
  });

  const { passwordHash } = await resolveNewAccountPassword("");
  const moduleOverrides = getClientModuleOverrides();
  const sortOrder = await nextUserSortOrder(tx, options.companyId);

  return tx.user.create({
    data: {
      name: contactDisplay || options.clientName.trim(),
      username,
      email: null,
      passwordHash,
      mustSetPassword: true,
      role: "ADMIN",
      moduleOverrides,
      companyId: options.companyId,
      clientId: options.clientId,
      active: true,
      sortOrder,
    },
  });
}

