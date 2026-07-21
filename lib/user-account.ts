import bcrypt from "bcryptjs";

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
}> {
  const { passwordHash } = await resolveNewAccountPassword("");
  return {
    passwordHash,
    mustSetPassword: true,
    passwordDisplay: null,
    email: null,
  };
}

export async function assertUsernameAvailable(
  username: string,
  excludeUserId?: string
) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing && existing.id !== excludeUserId) {
    throw new Error("Username already in use.");
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
    throw new Error("Recovery email already in use.");
  }
}

export function needsRecoveryEmail(email: string | null | undefined) {
  return !email?.trim();
}
