import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { notifyLoginSessionClaimed } from "@/lib/session-watch";

/** Thrown from authorize when another device already holds a live session. */
export const AUTH_ACTIVE_SESSION_CODE = "ACTIVE_SESSION";

/** JWT / session error when this device lost the login to another device. */
export const AUTH_SESSION_REPLACED_ERROR = "SessionReplaced";

/** Login `?reason=` when the user was kicked by a sign-in elsewhere. */
export const AUTH_SESSION_REPLACED_REASON = "session_replaced";

/** Matches NextAuth JWT maxAge (8 hours). */
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export function isLiveLoginSession(
  sessionToken: string | null | undefined,
  sessionIssuedAt: Date | null | undefined,
  now = Date.now()
): boolean {
  if (!sessionToken || !sessionIssuedAt) return false;
  return now - sessionIssuedAt.getTime() < SESSION_MAX_AGE_MS;
}

export function newLoginSessionToken() {
  return randomUUID();
}

export async function claimLoginSession(userId: string) {
  const sessionToken = newLoginSessionToken();
  const sessionIssuedAt = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: { sessionToken, sessionIssuedAt },
  });
  notifyLoginSessionClaimed(userId, sessionToken);
  return { sessionToken, sessionIssuedAt };
}

export async function clearLoginSession(
  userId: string,
  sessionToken?: string | null
) {
  if (!userId) return;
  if (sessionToken) {
    await prisma.user.updateMany({
      where: { id: userId, sessionToken },
      data: { sessionToken: null, sessionIssuedAt: null },
    });
    return;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { sessionToken: null, sessionIssuedAt: null },
  });
}
