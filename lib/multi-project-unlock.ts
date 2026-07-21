import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

import {
  MULTI_PROJECT_UNLOCK_IDLE_MS,
  type UnlockScope,
  isValidUnlockScope,
} from "@/lib/client-security-code";

export const MULTI_PROJECT_UNLOCK_COOKIE = "rgs_mp_unlock";

export type MultiProjectUnlockPayload = {
  clientId: string;
  scope: UnlockScope;
  /** ISO timestamp of last activity (idle resets unlock). */
  lastActivityAt: string;
};

function signingSecret(): string {
  return (
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    "rgs-dev-multi-project-unlock"
  );
}

function sign(body: string): string {
  return createHmac("sha256", signingSecret()).update(body).digest("base64url");
}

export function encodeUnlockCookie(payload: MultiProjectUnlockPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  return `${body}.${sign(body)}`;
}

export function decodeUnlockCookie(
  raw: string | undefined | null
): MultiProjectUnlockPayload | null {
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as MultiProjectUnlockPayload;
    if (
      typeof parsed.clientId !== "string" ||
      !isValidUnlockScope(parsed.scope) ||
      typeof parsed.lastActivityAt !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isUnlockActive(
  payload: MultiProjectUnlockPayload,
  now = Date.now()
): boolean {
  const last = Date.parse(payload.lastActivityAt);
  if (Number.isNaN(last)) return false;
  return now - last <= MULTI_PROJECT_UNLOCK_IDLE_MS;
}

export async function readMultiProjectUnlock(
  clientId: string
): Promise<MultiProjectUnlockPayload | null> {
  const jar = await cookies();
  const payload = decodeUnlockCookie(jar.get(MULTI_PROJECT_UNLOCK_COOKIE)?.value);
  if (!payload || payload.clientId !== clientId) return null;
  if (!isUnlockActive(payload)) return null;
  return payload;
}

export async function writeMultiProjectUnlock(
  payload: MultiProjectUnlockPayload
): Promise<void> {
  const jar = await cookies();
  jar.set(MULTI_PROJECT_UNLOCK_COOKIE, encodeUnlockCookie(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Session cookie — browser close clears unlock (and portal session separately).
  });
}

export async function touchMultiProjectUnlock(
  clientId: string
): Promise<MultiProjectUnlockPayload | null> {
  const current = await readMultiProjectUnlock(clientId);
  if (!current) return null;
  const next: MultiProjectUnlockPayload = {
    ...current,
    lastActivityAt: new Date().toISOString(),
  };
  await writeMultiProjectUnlock(next);
  return next;
}

export async function clearMultiProjectUnlock(): Promise<void> {
  const jar = await cookies();
  jar.delete(MULTI_PROJECT_UNLOCK_COOKIE);
}
