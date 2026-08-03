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

/**
 * Credentials used when an admin resets an account to first-login setup.
 * Matches newly provisioned accounts: unusable password, must set password,
 * no recovery email, no password display.
 */
export async function resolveFirstLoginResetCredentials(): Promise<{
  passwordHash: string;
  mustSetPassword: true;
  passwordDisplay: null;
  email: null;
  passwordSetupCompletedAt: null;
}> {
  const { passwordHash } = await resolveNewAccountPassword("");
  return {
    passwordHash,
    mustSetPassword: true,
    passwordDisplay: null,
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
