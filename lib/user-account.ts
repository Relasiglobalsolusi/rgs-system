import { randomBytes } from "crypto";

import bcrypt from "bcryptjs";

import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
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
      passwordDisplay: password,
    };
  }

  return {
    passwordHash: await createUnusablePasswordHash(),
    mustSetPassword: true,
  };
}

const TEMP_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const TEMP_PASSWORD_LENGTH = 12;

/** System-generated login password for admin reset / recoverable display. */
export function generateTemporaryPassword(): string {
  const bytes = randomBytes(TEMP_PASSWORD_LENGTH);
  let out = "";
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i += 1) {
    out += TEMP_PASSWORD_ALPHABET[bytes[i]! % TEMP_PASSWORD_ALPHABET.length]!;
  }
  return out;
}

/**
 * Credentials used when an admin resets an account to first-login setup.
 * Issues a temporary password the admin can read in Current Password; the
 * user must replace it on first-login. Legacy rows without passwordDisplay
 * need this reset once — their old password cannot be recovered from bcrypt.
 */
export async function resolveFirstLoginResetCredentials(): Promise<{
  passwordHash: string;
  mustSetPassword: true;
  passwordDisplay: string;
  email: null;
  passwordSetupCompletedAt: null;
}> {
  const password = generateTemporaryPassword();
  return {
    passwordHash: await bcrypt.hash(password, 12),
    mustSetPassword: true,
    passwordDisplay: password,
    email: null,
    passwordSetupCompletedAt: null,
  };
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
  if (user.passwordDisplay?.trim()) {
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

export type AdminPasswordDisplayState = "recoverable" | "pending" | "hidden";

/**
 * Admin UI: how to label the Current Password field when passwordDisplay may be
 * missing for legacy accounts that completed setup before recoverable storage.
 */
export function getAdminPasswordDisplayState(user: {
  passwordDisplay?: string | null;
  mustSetPassword?: boolean;
  email?: string | null;
  passwordSetupCompletedAt?: Date | null;
  isLinkedPortalLogin?: boolean;
}): AdminPasswordDisplayState {
  if (user.passwordDisplay?.trim()) {
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
