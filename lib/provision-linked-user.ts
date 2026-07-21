import type { EmployeeType, Placement, Prisma } from "@prisma/client";

import {
  formatContactPersonName,
  resolveContactPersonNameParts,
} from "@/lib/contact-person";
import { hardDeleteLinkedUserLogins } from "@/lib/hard-delete-linked-user";
import {
  getClientModuleOverrides,
  getEmployeeModuleOverrides,
  getVendorModuleOverrides,
} from "@/lib/permissions";
import { nextSortOrderFromMax } from "@/lib/reorder";
import { resolveNewAccountPassword } from "@/lib/user-account";
import { allocateClientLoginId } from "@/lib/client-login-id";
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
 * - Soft-deleted / non-ACTIVE employee → throws (restore first).
 * - Active linked user → no-op (returns null).
 * - Inactive linked user (revoked / soft-deactivated) → reactivates same credentials.
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

  if (existing.status !== "ACTIVE") {
    throw new Error(
      "Portal login cannot be generated for deleted or inactive employees. Restore the employee first."
    );
  }

  if (existing.userId && existing.user) {
    if (existing.user.active) {
      return null;
    }

    return tx.user.update({
      where: { id: existing.user.id },
      data: { active: true },
    });
  }

  const displayName = `${options.firstName} ${options.lastName}`.trim();
  // Username source: employee.firstName (+ lastName initial on collision).
  const username = await allocateUniqueUsername({
    firstName: options.firstName,
    lastName: options.lastName,
    fallbackCode: options.employeeNo,
    isTaken: (candidate) => usernameIsTaken(tx, candidate),
  });

  const { passwordHash, mustSetPassword } = await resolveNewAccountPassword("");
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
      mustSetPassword,
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
 * Creates or restores a portal login for a client.
 * Login ID is an 8-letter company-based id (not contact person name).
 * Password is unusable until first-login setup; recovery email is left unset.
 * - Active linked user → no-op (returns null).
 * - Inactive linked user (revoked / soft-deactivated) → reactivates same credentials.
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

  const activeLogin = await tx.user.findFirst({
    where: { clientId: options.clientId, active: true },
    select: { id: true },
  });

  if (activeLogin) {
    return null;
  }

  const inactiveLogin = await tx.user.findFirst({
    where: { clientId: options.clientId, active: false },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (inactiveLogin) {
    return tx.user.update({
      where: { id: inactiveLogin.id },
      data: { active: true },
    });
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

  const { passwordHash, mustSetPassword } = await resolveNewAccountPassword("");
  const moduleOverrides = getClientModuleOverrides();
  const sortOrder = await nextUserSortOrder(tx, options.companyId);

  return tx.user.create({
    data: {
      name: contactDisplay || options.clientName.trim(),
      username,
      email: null,
      passwordHash,
      mustSetPassword,
      role: "ADMIN",
      moduleOverrides,
      companyId: options.companyId,
      clientId: options.clientId,
      active: true,
      sortOrder,
    },
  });
}

/**
 * Creates or restores a portal login for a vendor.
 * Username is derived from the contact person's first name (never company/vendor name).
 * Password is unusable until first-login setup; recovery email is left unset.
 * - Active linked user → no-op (returns null).
 * - Inactive linked user (revoked / soft-deactivated) → reactivates same credentials.
 * - No linked user → allocates a new username and creates a User.
 */
export async function provisionVendorUser(
  tx: Tx,
  options: {
    companyId: string;
    vendorId: string;
    /** Vendor organization name — used only for display fallback, never for username. */
    vendorName: string;
    contactPersonFirstName: string;
    contactPersonLastName?: string | null;
  }
) {
  const vendor = await tx.vendor.findUnique({
    where: { id: options.vendorId },
    select: { active: true },
  });

  if (!vendor) {
    throw new Error("Vendor not found.");
  }

  if (!vendor.active) {
    throw new Error(
      "Portal login cannot be generated for deleted vendors. Restore the vendor first."
    );
  }

  const activeLogin = await tx.user.findFirst({
    where: { vendorId: options.vendorId, active: true },
    select: { id: true },
  });

  if (activeLogin) {
    return null;
  }

  const inactiveLogin = await tx.user.findFirst({
    where: { vendorId: options.vendorId, active: false },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (inactiveLogin) {
    return tx.user.update({
      where: { id: inactiveLogin.id },
      data: { active: true },
    });
  }

  const contactParts = resolveContactPersonNameParts(
    options.contactPersonFirstName,
    options.contactPersonLastName
  );

  const contactDisplay =
    formatContactPersonName(
      options.contactPersonFirstName,
      options.contactPersonLastName
    ) ?? options.vendorName.trim();

  // Username source: contact person first name (+ last initial on collision).
  // Do not use options.vendorName for username allocation.
  const username = await allocateUniqueUsername({
    firstName: contactParts.firstName,
    lastName: contactParts.lastName,
    fallbackCode: options.vendorId.slice(-6),
    isTaken: (candidate) => usernameIsTaken(tx, candidate),
  });

  const { passwordHash, mustSetPassword } = await resolveNewAccountPassword("");
  const moduleOverrides = getVendorModuleOverrides();
  const sortOrder = await nextUserSortOrder(tx, options.companyId);

  return tx.user.create({
    data: {
      name: contactDisplay,
      username,
      email: null,
      passwordHash,
      mustSetPassword,
      role: "ADMIN",
      moduleOverrides,
      companyId: options.companyId,
      vendorId: options.vendorId,
      active: true,
      sortOrder,
    },
  });
}

/**
 * Hard-delete existing portal User(s) for a vendor and create a replacement
 * login from the new contact person name (mustSetPassword + no recovery email
 * → first-login setup). Username uses contact first name (+ last initial on
 * collision). Call after the Vendor row has the updated contact fields.
 *
 * Callers must only invoke this when linked portal users already exist and the
 * vendor will remain active — never to invent a login that did not exist, and
 * never to hard-delete without provisioning a replacement.
 */
export async function resetVendorPortalLoginForContactNameChange(
  tx: Tx,
  options: {
    companyId: string;
    vendorId: string;
    vendorName: string;
    contactPersonFirstName: string;
    contactPersonLastName?: string | null;
    linkedUserIds: string[];
    /** Must be true for contact-name reset; kept for call-site clarity. */
    provisionReplacement: boolean;
  }
) {
  if (options.linkedUserIds.length === 0) {
    return null;
  }

  await hardDeleteLinkedUserLogins(tx, options.linkedUserIds);

  if (!options.provisionReplacement) {
    throw new Error(
      "Contact-person portal reset requires provisioning a replacement login."
    );
  }

  return provisionVendorUser(tx, {
    companyId: options.companyId,
    vendorId: options.vendorId,
    vendorName: options.vendorName,
    contactPersonFirstName: options.contactPersonFirstName,
    contactPersonLastName: options.contactPersonLastName,
  });
}
