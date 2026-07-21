import { randomBytes } from "crypto";

import bcrypt from "bcryptjs";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz";
const CODE_LENGTH = 10;
const BCRYPT_ROUNDS = 12;

/** Fail attempts before lockout. */
export const SECURITY_CODE_MAX_ATTEMPTS = 4;
/** First lockout window (ms). */
export const SECURITY_CODE_LOCKOUT_MS_1 = 15 * 60 * 1000;
/** Second+ lockout window (ms). */
export const SECURITY_CODE_LOCKOUT_MS_2 = 30 * 60 * 1000;
/** Portal Multi-Project unlock idle timeout (ms). */
export const MULTI_PROJECT_UNLOCK_IDLE_MS = 30 * 60 * 1000;

/** System-generated letters + numbers Security Code (copy-once). */
export function generateSecurityCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length]!;
  }
  return out;
}

export function securityCodeHint(code: string): string {
  const trimmed = code.trim();
  if (trimmed.length < 2) return trimmed;
  return trimmed.slice(-2);
}

export async function hashSecurityCode(code: string): Promise<string> {
  return bcrypt.hash(code.trim(), BCRYPT_ROUNDS);
}

export async function verifySecurityCode(
  code: string,
  codeHash: string
): Promise<boolean> {
  return bcrypt.compare(code.trim(), codeHash);
}

export function isSecurityCodeLocked(
  lockedUntil: Date | null | undefined,
  now = new Date()
): boolean {
  return Boolean(lockedUntil && lockedUntil.getTime() > now.getTime());
}

/**
 * After a failed attempt: bump counter; lock at 4 fails (15 min), then 30 min.
 * When a prior lockout has expired, the attempt window resets to 0 so the user
 * gets a full 4 tries again (not an immediate re-lock). An expired lock marker
 * is kept until the next lockout so the second cycle can escalate to 30 min.
 */
export function nextFailedAttemptState(options: {
  failedAttempts: number;
  lockedUntil?: Date | null;
  now?: Date;
}): { failedAttempts: number; lockedUntil: Date | null } {
  const now = options.now ?? new Date();
  const lockExpired =
    options.lockedUntil != null &&
    options.lockedUntil.getTime() <= now.getTime();
  const baseAttempts = lockExpired ? 0 : options.failedAttempts;
  const nextAttempts = baseAttempts + 1;
  if (nextAttempts < SECURITY_CODE_MAX_ATTEMPTS) {
    return {
      failedAttempts: nextAttempts,
      // Keep expired marker for escalation; clear only when never locked.
      lockedUntil: lockExpired ? options.lockedUntil! : null,
    };
  }
  // 4th fail → 15 min; another full cycle after a prior lock → 30 min.
  const hadPriorLock = Boolean(options.lockedUntil);
  const duration = hadPriorLock
    ? SECURITY_CODE_LOCKOUT_MS_2
    : SECURITY_CODE_LOCKOUT_MS_1;
  return {
    failedAttempts: nextAttempts,
    lockedUntil: new Date(now.getTime() + duration),
  };
}

export type UnlockScope =
  | { kind: "MASTER" }
  | { kind: "GROUP"; groupId: string };

export function isValidUnlockScope(value: unknown): value is UnlockScope {
  if (!value || typeof value !== "object") return false;
  const v = value as { kind?: string; groupId?: string };
  if (v.kind === "MASTER") return true;
  return v.kind === "GROUP" && typeof v.groupId === "string" && v.groupId.length > 0;
}
