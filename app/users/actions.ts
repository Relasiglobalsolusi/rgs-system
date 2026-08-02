"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  nextCompanyScopedSortOrder,
  persistCompanyScopedReorder,
} from "@/lib/persist-reorder";
import { requireModule } from "@/lib/session";
import { ADMIN_SCOPE_MODULES, MODULES } from "@/lib/permissions";
import { isValidUsername, normalizeUsername } from "@/lib/username";
import {
  assertRecoveryEmailAvailable,
  assertUsernameAvailable,
  resolveFirstLoginResetCredentials,
  resolveNewAccountPassword,
} from "@/lib/user-account";
import {
  createBulkActionResult,
  recordBulkFailure,
  recordBulkSuccess,
  type BulkActionResult,
} from "@/lib/bulk-action-result";
import { formatEmployeeName } from "@/lib/employee-user-link";
import { hardDeleteLinkedUserLogin } from "@/lib/hard-delete-linked-user";
import { capitalizeName } from "@/lib/text-case";
import { isRosterActiveEmployeeStatus } from "@/lib/user-directory-status";
import { assertClientCanBeSoftDeleted } from "@/lib/client-soft-delete";
import { assertVendorCanBeSoftDeleted } from "@/lib/vendor-soft-delete";
import { getServerLocale, type AppLocale } from "@/lib/i18n/locale";
import { translate, type TranslateParams } from "@/lib/i18n/translate";

async function usersLocaleError(
  key: string,
  params?: TranslateParams,
  locale?: AppLocale
) {
  const resolved = locale ?? (await getServerLocale());
  return new Error(translate(resolved, `pages.users.errors.${key}`, params));
}

export async function createUser(formData: FormData) {
  await requireModule("users");
  const locale = await getServerLocale();

  const name = capitalizeName(String(formData.get("name") ?? "").trim());
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) throw await usersLocaleError("displayNameRequired", undefined, locale);
  if (!username) throw await usersLocaleError("usernameRequired", undefined, locale);
  if (!isValidUsername(username)) {
    throw await usersLocaleError("usernameInvalid", undefined, locale);
  }
  if (!email) throw await usersLocaleError("recoveryEmailRequired", undefined, locale);

  await assertUsernameAvailable(username);
  await assertRecoveryEmailAvailable(email);

  const company = await prisma.company.findFirst();
  if (!company) throw await usersLocaleError("companyNotFound", undefined, locale);

  const { passwordHash, mustSetPassword, passwordDisplay } =
    await resolveNewAccountPassword(password);
  const sortOrder = await nextCompanyScopedSortOrder("user", company.id);

  await prisma.user.create({
    data: {
      name,
      username,
      email,
      passwordHash,
      mustSetPassword,
      ...(passwordDisplay ? { passwordDisplay } : {}),
      role: "ADMIN",
      companyId: company.id,
      active: true,
      sortOrder,
    },
  });

  revalidatePath("/users");
}

export async function reorderUsers(ids: string[]) {
  await requireModule("users");
  const locale = await getServerLocale();

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw await usersLocaleError("companyNotFound", undefined, locale);

  await persistCompanyScopedReorder("user", {
    companyId: company.id,
    ids,
    mismatchError: translate(locale, "pages.users.errors.reorderInvalid"),
  });

  revalidatePath("/users");
}

export async function updateUser(userId: string, formData: FormData) {
  // requireModule("users") = Users manage access (same gate as canManage on page).
  await requireModule("users");
  const locale = await getServerLocale();

  const name = capitalizeName(String(formData.get("name") ?? "").trim());
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  // Ignore form `active` — re-enable only via Restore Access; disable via Revoke Access.

  if (!name) throw await usersLocaleError("displayNameRequired", undefined, locale);
  if (!username) throw await usersLocaleError("usernameRequired", undefined, locale);
  if (!isValidUsername(username)) {
    throw await usersLocaleError("usernameInvalid", undefined, locale);
  }
  if (!email) throw await usersLocaleError("recoveryEmailRequired", undefined, locale);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true },
  });

  if (!user) {
    throw await usersLocaleError("userNotFound", undefined, locale);
  }

  if (username !== user.username) {
    await assertUsernameAvailable(username, user.id);
  }
  if (email !== user.email) {
    await assertRecoveryEmailAvailable(email, user.id);
  }

  const userData: {
    name: string;
    username: string;
    email: string | null;
    passwordHash?: string;
    passwordDisplay?: string | null;
    mustSetPassword?: boolean;
  } = {
    name,
    username,
    email,
  };

  if (password.trim()) {
    if (password.length < 6) {
      throw await usersLocaleError("passwordMinLength", undefined, locale);
    }
    userData.passwordHash = await bcrypt.hash(password, 12);
    userData.passwordDisplay = password;
    userData.mustSetPassword = false;
  }

  await prisma.user.update({
    where: { id: userId },
    data: userData,
  });

  revalidateUserDirectoryPaths();
}

export async function resetUserAccount(userId: string) {
  await requireModule("users");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw await usersLocaleError("userNotFound");
  }

  const credentials = await resolveFirstLoginResetCredentials();

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({
      where: { userId },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        email: credentials.email,
        passwordHash: credentials.passwordHash,
        passwordDisplay: credentials.passwordDisplay,
        mustSetPassword: credentials.mustSetPassword,
      },
    });
  });

  revalidatePath("/users");
  revalidatePath("/employees");
  revalidatePath("/clients");
  revalidatePath("/first-login");
  revalidatePath("/login");
}

/**
 * Disables a linked login only — does NOT soft-delete the employee/client.
 * Linked parent stays Active; user shows under Revoked Access only
 * (never under Deleted* or No Portal Login).
 * Credentials (username, password hash, employee/client numbers, User row)
 * stay linked — re-enable via Revoked Access → Restore Access.
 */
export async function revokeUserLoginAccess(userId: string) {
  const session = await requireModule("users");
  const locale = await getServerLocale();

  if (userId === session.user.id) {
    throw await usersLocaleError("cannotRevokeOwn", undefined, locale);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      active: true,
      clientId: true,
      vendorId: true,
      employee: { select: { id: true } },
    },
  });

  if (!user) {
    throw await usersLocaleError("userNotFound", undefined, locale);
  }

  if (!user.clientId && !user.vendorId && !user.employee) {
    throw await usersLocaleError("revokeLinkedOnly", undefined, locale);
  }

  if (user.active) {
    await prisma.user.update({
      where: { id: userId },
      data: { active: false },
    });
  }

  revalidatePath("/users");
  revalidatePath("/employees");
  revalidatePath("/clients");
  revalidatePath("/vendors");
  revalidatePath("/login");
  revalidatePath("/first-login");
}

export type BulkRevokeUserLoginAccessResult = BulkActionResult & {
  skippedCount: number;
};

/**
 * Bulk Revoke Access — same rules as revokeUserLoginAccess.
 * Revokes every eligible linked active login in the selection.
 * Skips own account, unlinked admins, already-inactive, and missing users
 * (counted in skippedCount, not failures).
 */
export async function bulkRevokeUserLoginAccess(
  ids: string[]
): Promise<BulkRevokeUserLoginAccessResult> {
  const session = await requireModule("users");
  const result = createBulkActionResult();
  let skippedCount = 0;
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      if (id === session.user.id) {
        skippedCount += 1;
        continue;
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          active: true,
          clientId: true,
          vendorId: true,
          employee: { select: { id: true } },
        },
      });

      if (!user) {
        skippedCount += 1;
        continue;
      }

      if (!user.clientId && !user.vendorId && !user.employee) {
        skippedCount += 1;
        continue;
      }

      if (!user.active) {
        skippedCount += 1;
        continue;
      }

      await prisma.user.update({
        where: { id },
        data: { active: false },
      });
      recordBulkSuccess(result);
    } catch (error) {
      const locale = await getServerLocale();
      recordBulkFailure(
        result,
        error instanceof Error
          ? error.message
          : translate(locale, "pages.users.errors.revokeAccessFailed")
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/users");
    revalidatePath("/employees");
    revalidatePath("/clients");
    revalidatePath("/vendors");
    revalidatePath("/login");
    revalidatePath("/first-login");
  }

  return { ...result, skippedCount };
}

/**
 * Hard-deletes a linked portal/ERP login User row (not revoke / soft-delete).
 * Username, password, recovery email, and the User row are gone forever.
 * Linked client/vendor/employee stays Active → Users → No Portal Login.
 * Later Generate Portal Login creates a brand-new User (first-name username rules,
 * mustSetPassword + email null → /first-login, same as fresh provision).
 * Distinct from Revoke Access (keeps credentials) and soft Delete (Deleted cards).
 */
export async function permanentlyRemovePortalLoginAccess(userId: string) {
  const session = await requireModule("users");
  const locale = await getServerLocale();

  if (userId === session.user.id) {
    throw await usersLocaleError("cannotRemovePortalOwn", undefined, locale);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      active: true,
      clientId: true,
      vendorId: true,
      employee: { select: { id: true } },
    },
  });

  if (!user) {
    throw await usersLocaleError("userNotFound", undefined, locale);
  }

  if (!user.clientId && !user.vendorId && !user.employee) {
    throw await usersLocaleError(
      "permanentlyRemoveLinkedOnly",
      undefined,
      locale
    );
  }

  if (!user.active) {
    throw await usersLocaleError(
      "permanentlyRemoveActiveOnly",
      undefined,
      locale
    );
  }

  await prisma.$transaction(async (tx) => {
    await hardDeleteLinkedUserLogin(tx, userId);
  });

  revalidatePath("/users");
  revalidatePath("/employees");
  revalidatePath("/clients");
  revalidatePath("/vendors");
  revalidatePath("/login");
  revalidatePath("/first-login");
}

export type BulkPermanentlyRemovePortalLoginAccessResult = BulkActionResult & {
  skippedCount: number;
};

/**
 * Bulk Permanently Remove Portal Login Access — same rules as
 * permanentlyRemovePortalLoginAccess (hard-delete User → No Portal Login).
 * Skips own account, unlinked admins, inactive, and missing users
 * (counted in skippedCount, not failures).
 */
export async function bulkPermanentlyRemovePortalLoginAccess(
  ids: string[]
): Promise<BulkPermanentlyRemovePortalLoginAccessResult> {
  const session = await requireModule("users");
  const result = createBulkActionResult();
  let skippedCount = 0;
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      if (id === session.user.id) {
        skippedCount += 1;
        continue;
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          active: true,
          clientId: true,
          vendorId: true,
          employee: { select: { id: true } },
        },
      });

      if (!user) {
        skippedCount += 1;
        continue;
      }

      if (!user.clientId && !user.vendorId && !user.employee) {
        skippedCount += 1;
        continue;
      }

      if (!user.active) {
        skippedCount += 1;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await hardDeleteLinkedUserLogin(tx, id);
      });
      recordBulkSuccess(result);
    } catch (error) {
      const locale = await getServerLocale();
      recordBulkFailure(
        result,
        error instanceof Error
          ? error.message
          : translate(locale, "pages.users.errors.permanentlyRemoveFailed")
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/users");
    revalidatePath("/employees");
    revalidatePath("/clients");
    revalidatePath("/vendors");
    revalidatePath("/login");
    revalidatePath("/first-login");
  }

  return { ...result, skippedCount };
}

function revalidateUserDirectoryPaths() {
  revalidatePath("/users");
  revalidatePath("/employees");
  revalidatePath("/clients");
  revalidatePath("/vendors");
  revalidatePath("/login");
  revalidatePath("/first-login");
}

/**
 * Soft-delete a login account.
 * - Linked employee → soft-delete employee (Deleted Employees) + deactivate login
 * - Linked client → soft-delete client (Deleted Clients) + deactivate all portal logins
 * - Linked vendor → soft-delete vendor (Deleted Vendors) + deactivate all portal logins
 * - Unlinked admin → deactivate login only
 * Credentials stay until permanent delete; restore re-enables the same ones.
 */
async function deactivateUserRecord(id: string, currentUserId: string) {
  const locale = await getServerLocale();

  if (id === currentUserId) {
    throw await usersLocaleError("cannotDeleteOwn", undefined, locale);
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      active: true,
      clientId: true,
      vendorId: true,
      employee: {
        select: { id: true, status: true, userId: true },
      },
      client: { select: { id: true, active: true } },
      vendor: { select: { id: true, active: true } },
    },
  });

  if (!user) {
    throw await usersLocaleError("userNotFound", undefined, locale);
  }

  if (user.employee?.userId === currentUserId) {
    throw await usersLocaleError("cannotDeleteOwnEmployee", undefined, locale);
  }

  const employeeOnRoster =
    user.employee != null &&
    isRosterActiveEmployeeStatus(user.employee.status);
  const employeeAlreadySoftDeleted =
    user.employee != null && !employeeOnRoster;
  const clientAlreadySoftDeleted =
    user.client != null && user.client.active === false;
  const vendorAlreadySoftDeleted =
    user.vendor != null && user.vendor.active === false;

  if (
    !user.active &&
    (employeeAlreadySoftDeleted ||
      clientAlreadySoftDeleted ||
      vendorAlreadySoftDeleted ||
      (!user.employee && !user.client && !user.vendor))
  ) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (user.employee && employeeOnRoster) {
      await tx.employee.update({
        where: { id: user.employee.id },
        data: { status: "INACTIVE" },
      });
      await tx.user.update({
        where: { id },
        data: { active: false },
      });
      return;
    }

    if (user.client && user.client.active) {
      await assertClientCanBeSoftDeleted(user.client.id, tx, locale);
      await tx.client.update({
        where: { id: user.client.id },
        data: { active: false },
      });
      await tx.user.updateMany({
        where: { clientId: user.client.id },
        data: { active: false },
      });
      return;
    }

    if (user.vendor && user.vendor.active) {
      await assertVendorCanBeSoftDeleted(user.vendor.id, tx, locale);
      await tx.vendor.update({
        where: { id: user.vendor.id },
        data: { active: false },
      });
      await tx.user.updateMany({
        where: { vendorId: user.vendor.id },
        data: { active: false },
      });
      return;
    }

    // Admin / already-orphaned link: deactivate login only.
    if (user.active) {
      await tx.user.update({
        where: { id },
        data: { active: false },
      });
    }
  });
}

export type UserRestoreMode = "access" | "deleted";

/**
 * Users → Deleted → Restore:
 * - Soft-deleted employee/client/vendor link → restore parent only; User.active stays false
 *   (lands in Revoked Access). Portal login needs separate Restore Access.
 * - Unlinked admin → re-enable login (User.active = true).
 */
async function restoreSoftDeletedUserRecord(id: string) {
  const locale = await getServerLocale();
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      active: true,
      employee: {
        select: {
          id: true,
          status: true,
          archivedFromDirectory: true,
        },
      },
      client: { select: { id: true, active: true } },
      vendor: { select: { id: true, active: true } },
    },
  });

  if (!user) {
    throw await usersLocaleError("userNotFound", undefined, locale);
  }

  if (user.active) {
    return;
  }

  if (user.employee?.archivedFromDirectory) {
    throw await usersLocaleError(
      "employeeArchivedCannotRestore",
      undefined,
      locale
    );
  }

  const employeeSoftDeleted =
    user.employee != null &&
    !isRosterActiveEmployeeStatus(user.employee.status);
  const clientSoftDeleted = user.client != null && user.client.active === false;
  const vendorSoftDeleted = user.vendor != null && user.vendor.active === false;

  await prisma.$transaction(async (tx) => {
    if (employeeSoftDeleted && user.employee) {
      await tx.employee.update({
        where: { id: user.employee.id },
        data: { status: "ACTIVE" },
      });
      // Keep login inactive → Revoked Access until Restore Access.
      return;
    }

    if (clientSoftDeleted && user.client) {
      await tx.client.update({
        where: { id: user.client.id },
        data: { active: true },
      });
      // Keep all portal logins inactive → Revoked Access.
      return;
    }

    if (vendorSoftDeleted && user.vendor) {
      await tx.vendor.update({
        where: { id: user.vendor.id },
        data: { active: true },
      });
      // Keep all portal logins inactive → Revoked Access.
      return;
    }

    // Unlinked admin / orphan deactivated login.
    await tx.user.update({
      where: { id },
      data: { active: true },
    });
  });
}

/**
 * Users → Revoked Access → Restore Access:
 * Re-enables login only. Parent must already be on the active roster.
 */
async function restoreUserLoginAccessRecord(id: string) {
  const locale = await getServerLocale();
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      active: true,
      employee: {
        select: {
          id: true,
          status: true,
          archivedFromDirectory: true,
        },
      },
      client: { select: { id: true, active: true } },
      vendor: { select: { id: true, active: true } },
    },
  });

  if (!user) {
    throw await usersLocaleError("userNotFound", undefined, locale);
  }

  if (user.active) {
    return;
  }

  if (user.employee?.archivedFromDirectory) {
    throw await usersLocaleError(
      "employeeArchivedCannotRestore",
      undefined,
      locale
    );
  }

  if (
    user.employee != null &&
    !isRosterActiveEmployeeStatus(user.employee.status)
  ) {
    throw await usersLocaleError("restoreEmployeeFirst", undefined, locale);
  }

  if (user.client != null && user.client.active === false) {
    throw await usersLocaleError("restoreClientFirst", undefined, locale);
  }

  if (user.vendor != null && user.vendor.active === false) {
    throw await usersLocaleError("restoreVendorFirst", undefined, locale);
  }

  await prisma.user.update({
    where: { id },
    data: { active: true },
  });
}

async function reactivateUserRecord(id: string, mode: UserRestoreMode) {
  if (mode === "access") {
    await restoreUserLoginAccessRecord(id);
    return;
  }
  await restoreSoftDeletedUserRecord(id);
}

export async function deactivateUser(id: string) {
  const session = await requireModule("users");
  await deactivateUserRecord(id, session.user.id);
  revalidateUserDirectoryPaths();
}

export async function reactivateUser(
  id: string,
  mode: UserRestoreMode = "deleted"
) {
  await requireModule("users");
  await reactivateUserRecord(id, mode);
  revalidateUserDirectoryPaths();
}

export async function bulkDeactivateUsers(
  ids: string[]
): Promise<BulkActionResult> {
  const session = await requireModule("users");
  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      await deactivateUserRecord(id, session.user.id);
      recordBulkSuccess(result);
    } catch (error) {
      const locale = await getServerLocale();
      recordBulkFailure(
        result,
        error instanceof Error
          ? error.message
          : translate(locale, "pages.users.errors.deleteUserFailed")
      );
    }
  }

  if (result.successCount > 0) {
    revalidateUserDirectoryPaths();
  }

  return result;
}

export async function bulkReactivateUsers(
  ids: string[],
  mode: UserRestoreMode = "deleted"
): Promise<BulkActionResult> {
  await requireModule("users");
  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      await reactivateUserRecord(id, mode);
      recordBulkSuccess(result);
    } catch (error) {
      const locale = await getServerLocale();
      recordBulkFailure(
        result,
        error instanceof Error
          ? error.message
          : translate(locale, "pages.users.errors.restoreUserFailed")
      );
    }
  }

  if (result.successCount > 0) {
    revalidateUserDirectoryPaths();
  }

  return result;
}

const ACTIVE_EMPLOYEE_STATUSES = new Set(["ACTIVE", "ON_LEAVE"]);

async function deleteUserPermanentlyRecord(id: string, currentUserId: string) {
  const locale = await getServerLocale();

  if (id === currentUserId) {
    throw await usersLocaleError("cannotDeleteOwn", undefined, locale);
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          status: true,
          employeeNo: true,
          firstName: true,
          lastName: true,
        },
      },
      client: {
        select: {
          id: true,
          name: true,
          active: true,
        },
      },
    },
  });

  if (!user) {
    throw await usersLocaleError("userNotFound", undefined, locale);
  }

  if (user.active) {
    throw await usersLocaleError(
      "onlyDeactivatedPermanentDelete",
      undefined,
      locale
    );
  }

  // Revoked Access (parent still Active) must not be forever-deleted —
  // restore access or soft-delete the parent first.
  if (
    user.employee &&
    ACTIVE_EMPLOYEE_STATUSES.has(user.employee.status)
  ) {
    const employeeLabel = formatEmployeeName(user.employee);
    throw await usersLocaleError(
      "cannotDeleteActiveEmployee",
      {
        employeeNo: user.employee.employeeNo,
        name: employeeLabel,
      },
      locale
    );
  }

  if (user.client && user.client.active !== false) {
    throw await usersLocaleError(
      "cannotDeleteActiveClient",
      { name: user.client.name },
      locale
    );
  }

  await prisma.$transaction(async (tx) => {
    if (user.employee) {
      await tx.employee.update({
        where: { id: user.employee.id },
        data: { userId: null },
      });
    }

    await tx.auditLog.updateMany({
      where: { userId: id },
      data: { userId: null },
    });

    await tx.leaveRequest.updateMany({
      where: { reviewedById: id },
      data: { reviewedById: null },
    });

    await tx.invoiceCompilation.updateMany({
      where: { createdById: id },
      data: { createdById: null },
    });

    await tx.user.delete({ where: { id } });
  });
}

export async function deleteUserPermanently(id: string) {
  const session = await requireModule("users");
  await deleteUserPermanentlyRecord(id, session.user.id);
  revalidatePath("/users");
  revalidatePath("/employees");
}

export async function bulkDeleteUsers(
  ids: string[]
): Promise<BulkActionResult> {
  const session = await requireModule("users");
  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      await deleteUserPermanentlyRecord(id, session.user.id);
      recordBulkSuccess(result);
    } catch (error) {
      const locale = await getServerLocale();
      recordBulkFailure(
        result,
        error instanceof Error
          ? error.message
          : translate(locale, "pages.users.errors.deleteUserFailed")
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/users");
    revalidatePath("/employees");
  }

  return result;
}

export async function updateUserModuleOverrides(
  userId: string,
  overrides: Record<string, boolean>
) {
  await requireModule("users");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw await usersLocaleError("userNotFound");

  const isPortalUser = Boolean(user.clientId || user.vendorId);
  const isVendorPortal = Boolean(user.vendorId);
  const sanitized: Record<string, boolean> = {};
  for (const moduleKey of MODULES) {
    if (!(moduleKey in overrides)) continue;
    // Portal accounts never receive HO directory / CMS modules via overrides.
    if (isPortalUser && ADMIN_SCOPE_MODULES.includes(moduleKey)) {
      continue;
    }
    // Vendors cannot unlock Progress Reports via overrides.
    if (isVendorPortal && moduleKey === "progress") {
      continue;
    }
    sanitized[moduleKey] = Boolean(overrides[moduleKey]);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      moduleOverrides:
        Object.keys(sanitized).length > 0 ? sanitized : Prisma.DbNull,
    },
  });

  revalidateUserDirectoryPaths();
}
