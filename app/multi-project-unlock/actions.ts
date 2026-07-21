"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isSecurityCodeLocked,
  nextFailedAttemptState,
  verifySecurityCode,
} from "@/lib/client-security-code";
import { isMultiProjectAccessActive } from "@/lib/multi-project-access";
import {
  clearMultiProjectUnlock,
  writeMultiProjectUnlock,
} from "@/lib/multi-project-unlock";
import { prisma } from "@/lib/prisma";
import { toActionError } from "@/lib/prisma-errors";
import { getCurrentSession } from "@/lib/auth";
import { formatContactPersonName } from "@/lib/contact-person";

export type UnlockFormState = {
  error?: string;
  lockedUntil?: string | null;
};

export async function unlockMultiProjectAccess(
  _prev: UnlockFormState,
  formData: FormData
): Promise<UnlockFormState> {
  try {
    const session = await getCurrentSession();
    if (!session?.user?.clientId) {
      return { error: "Only client portal users can enter a Security Code." };
    }

    const clientId = session.user.clientId;
    const code = String(formData.get("securityCode") ?? "").trim();
    const picName = String(formData.get("picName") ?? "").trim();

    if (!code) return { error: "Enter Security Code." };
    if (!picName) return { error: "Enter the PIC name." };

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        multiProjectAccess: true,
        multiProjectSecurityMode: true,
        contactPersonFirstName: true,
        contactPersonLastName: true,
      },
    });
    if (!client) return { error: "Client not found." };

    const active = await isMultiProjectAccessActive({
      multiProjectAccess: client.multiProjectAccess,
      clientId,
    });
    if (!active) {
      await clearMultiProjectUnlock();
      redirect("/dashboard");
    }

    const expectedPic = (
      formatContactPersonName(
        client.contactPersonFirstName,
        client.contactPersonLastName
      ) ?? ""
    )
      .trim()
      .toLowerCase();
    if (!expectedPic || picName.trim().toLowerCase() !== expectedPic) {
      return { error: "PIC name does not match the contact person on file." };
    }

    const mode = client.multiProjectSecurityMode ?? "MASTER_AND_GROUP";
    const codes = await prisma.clientSecurityCode.findMany({
      where: {
        clientId,
        active: true,
        ...(mode === "GROUP_ONLY" ? { kind: "GROUP" as const } : {}),
      },
      select: {
        id: true,
        kind: true,
        groupId: true,
        codeHash: true,
        failedAttempts: true,
        lockedUntil: true,
      },
    });

    if (codes.length === 0) {
      return {
        error:
          "No Security Code is set yet. Ask your RGS Admin to generate one.",
      };
    }

    const anyLocked = codes.find((c) => isSecurityCodeLocked(c.lockedUntil));
    if (anyLocked?.lockedUntil) {
      return {
        error: "Too many failed attempts. Try again after the lockout ends.",
        lockedUntil: anyLocked.lockedUntil.toISOString(),
      };
    }

    let matched: (typeof codes)[number] | null = null;
    for (const row of codes) {
      if (await verifySecurityCode(code, row.codeHash)) {
        matched = row;
        break;
      }
    }

    if (!matched) {
      // Increment all active codes' fail counters (shared lockout feel).
      const nextStates = codes.map((row) => ({
        id: row.id,
        ...nextFailedAttemptState({
          failedAttempts: row.failedAttempts,
          lockedUntil: row.lockedUntil,
        }),
      }));
      await prisma.$transaction(
        nextStates.map((next) =>
          prisma.clientSecurityCode.update({
            where: { id: next.id },
            data: {
              failedAttempts: next.failedAttempts,
              lockedUntil: next.lockedUntil,
            },
          })
        )
      );
      const lockedUntil = nextStates
        .map((s) => s.lockedUntil)
        .filter((d): d is Date => d != null && d.getTime() > Date.now())
        .sort((a, b) => b.getTime() - a.getTime())[0];
      return {
        error: "Incorrect Security Code.",
        lockedUntil: lockedUntil?.toISOString() ?? null,
      };
    }

    // Reset attempts on success for this code.
    await prisma.clientSecurityCode.update({
      where: { id: matched.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    if (matched.kind === "MASTER") {
      await writeMultiProjectUnlock({
        clientId,
        scope: { kind: "MASTER" },
        lastActivityAt: new Date().toISOString(),
      });
    } else {
      if (!matched.groupId) {
        return { error: "This Group Security Code is misconfigured." };
      }
      await writeMultiProjectUnlock({
        clientId,
        scope: { kind: "GROUP", groupId: matched.groupId },
        lastActivityAt: new Date().toISOString(),
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath("/billing");
    redirect("/dashboard");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest ?? "").startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return {
      error: toActionError(error, "Failed to unlock Multi-Project Access.")
        .message,
    };
  }
}

/** Clear unlock only — portal session stays. Used for Change Security Code. */
export async function changeMultiProjectSecurityCode() {
  const session = await getCurrentSession();
  if (!session?.user?.clientId) {
    throw new Error("Not a client portal session.");
  }
  const clientId = session.user.clientId;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { multiProjectAccess: true },
  });
  const active = client
    ? await isMultiProjectAccessActive({
        multiProjectAccess: client.multiProjectAccess,
        clientId,
      })
    : false;
  await clearMultiProjectUnlock();
  revalidatePath("/dashboard");
  // Inactive Multi-Project: no unlock screen — stay on dashboard.
  redirect(active ? "/multi-project-unlock" : "/dashboard");
}

/** Refresh unlock idle timer (Server Action — cookie writes are allowed here). */
export async function touchMultiProjectUnlockActivity() {
  const session = await getCurrentSession();
  if (!session?.user?.clientId) return { ok: false as const };
  const { touchMultiProjectUnlock } = await import(
    "@/lib/multi-project-unlock"
  );
  const next = await touchMultiProjectUnlock(session.user.clientId);
  return { ok: Boolean(next) };
}
