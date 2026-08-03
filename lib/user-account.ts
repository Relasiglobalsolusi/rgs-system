import bcrypt from "bcryptjs";

import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import {
  encryptRecoverablePassword,
  hasRecoverablePasswordStored,
} from "@/lib/recoverable-password";
import { createUnusablePasswordHash } from "@/lib/unusable-password";

export async function resolveNewAccountPassword(rawPassword: string): Promise<{
  passwordHash: string;
  mustSetPassword: boolean;
  passwordDisplay?: string;
}> {
  const password = rawPassword.trim();

  if (password) {
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    return {
      passwordHash: await bcrypt.hash(password, 12),
      mustSetPassword: true,
      passwordDisplay: encryptRecoverablePassword(password),
    };
  }

  return {
    passwordHash: await createUnusablePasswordHash(),
    mustSetPassword: true,
  };
}

/**
 * Credentials used when an admin resets an account to first-login setup.
 * Matches fresh portal provision: unusable placeholder hash, no recoverable
 * copy, recovery email cleared — user completes /first-login to choose password.
 */
export async function resolveFirstLoginResetCredentials(): Promise<{
  passwordHash: string;
  mustSetPassword: true;
  passwordDisplay: null;
  email: null;
  passwordSetupCompletedAt: null;
}> {
  return {
    passwordHash: await createUnusablePasswordHash(),
    mustSetPassword: true,
    passwordDisplay: null,
    email: null,
    passwordSetupCompletedAt: null,
  };
}

/** Hash + admin recoverable copy for any user-chosen or admin-set login password. */
export async function resolvePasswordChange(plaintext: string): Promise<{
  passwordHash: string;
  passwordDisplay: string;
  mustSetPassword: false;
  passwordSetupCompletedAt: Date;
}> {
  const password = plaintext;
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  return {
    passwordHash: await bcrypt.hash(password, 12),
    passwordDisplay: encryptRecoverablePassword(password),
    mustSetPassword: false,
    passwordSetupCompletedAt: new Date(),
  };
}

/**
 * After a successful login, backfill missing recoverable copy or setup timestamp
 * for legacy rows that completed first-login before recoverable storage existed.
 */
export async function syncRecoverablePasswordOnLogin(
  userId: string,
  user: {
    mustSetPassword: boolean;
    passwordDisplay?: string | null;
    passwordSetupCompletedAt?: Date | null;
    email?: string | null;
  },
  loginPassword: string
): Promise<void> {
  const data: {
    passwordDisplay?: string;
    passwordSetupCompletedAt?: Date;
  } = {};

  if (
    !user.passwordSetupCompletedAt &&
    !user.mustSetPassword &&
    user.email &&
    !hasRecoverablePasswordStored(user.passwordDisplay)
  ) {
    data.passwordSetupCompletedAt = new Date();
  }

  if (!hasRecoverablePasswordStored(user.passwordDisplay)) {
    data.passwordDisplay = encryptRecoverablePassword(loginPassword);
  }

  if (Object.keys(data).length === 0) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data,
  });
}

export async function assertUsernameAvailable(
  username: string,
  excludeUserId?: string
) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing && existing.id !== excludeUserId) {
    const locale = await getServerLocale();
    throw new Error(translate(locale, "pages.users.errors.usernameTaken"));
  }
}

export function normalizeRecoveryEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export function isValidRecoveryEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function assertRecoveryEmailAvailable(
  email: string,
  excludeUserId?: string
) {
  const normalized = normalizeRecoveryEmail(email);
  if (!normalized) {
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing && existing.id !== excludeUserId) {
    const locale = await getServerLocale();
    throw new Error(translate(locale, "pages.users.errors.recoveryEmailTaken"));
  }
}

export function needsRecoveryEmail(email: string | null | undefined) {
  return !email?.trim();
}

export function isLinkedPortalLogin(user: {
  clientId?: string | null;
  vendorId?: string | null;
  employee?: { id: string } | null;
}): boolean {
  return Boolean(user.clientId || user.vendorId || user.employee);
}

/**
 * Whether the account still needs the public /first-login setup flow
 * (choose password + recovery email), as opposed to a normal /login sign-in.
 *
 * Uses DB state only — never form-submitted recovery email.
 * Do not rely on mustSetPassword alone: provisioned portal logins always get a
 * placeholder password hash, and legacy rows may have mustSetPassword @default(false)
 * even before the user completes setup.
 */
export function needsInitialPasswordSetup(
  user: {
    mustSetPassword: boolean;
    email?: string | null;
    passwordDisplay?: string | null;
    passwordSetupCompletedAt?: Date | null;
    isLinkedPortalLogin?: boolean;
  },
  options?: { includeLinkedLegacy?: boolean }
): boolean {
  if (user.passwordSetupCompletedAt) {
    return false;
  }

  if (user.mustSetPassword) {
    return true;
  }

  // Admin-issued temporary password the user has not replaced yet.
  if (hasRecoverablePasswordStored(user.passwordDisplay)) {
    return true;
  }

  // Portal / reset accounts: no recovery email means first-login never finished.
  if (needsRecoveryEmail(user.email)) {
    return true;
  }

  // Linked portal logins without a recorded setup completion — covers legacy rows
  // where mustSetPassword stayed false and an admin saved a recovery email early.
  if (options?.includeLinkedLegacy !== false && user.isLinkedPortalLogin) {
    return true;
  }

  return false;
}

export type AdminPasswordDisplayState =
  | "recoverable"
  | "pending"
  | "hidden"
  | "decrypt_failed";

/**
 * Admin UI: how to label the Current Password field when passwordDisplay may be
 * missing for legacy accounts that completed setup before recoverable storage.
 */
export function getAdminPasswordDisplayState(user: {
  passwordDisplay?: string | null;
  recoverableStoredAtRest?: boolean;
  decryptFailed?: boolean;
  mustSetPassword?: boolean;
  email?: string | null;
  passwordSetupCompletedAt?: Date | null;
  isLinkedPortalLogin?: boolean;
}): AdminPasswordDisplayState {
  if (user.decryptFailed) {
    return "decrypt_failed";
  }

  if (
    hasRecoverablePasswordStored(user.passwordDisplay) ||
    user.recoverableStoredAtRest
  ) {
    return "recoverable";
  }

  if (
    needsInitialPasswordSetup({
      mustSetPassword: user.mustSetPassword ?? false,
      email: user.email,
      passwordDisplay: user.passwordDisplay,
      passwordSetupCompletedAt: user.passwordSetupCompletedAt,
      isLinkedPortalLogin: user.isLinkedPortalLogin,
    })
  ) {
    return "pending";
  }

  return "hidden";
}
