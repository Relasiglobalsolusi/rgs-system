"use server";

import { revalidatePath } from "next/cache";
import type { MultiProjectSecurityMode } from "@prisma/client";

import {
  generateSecurityCode,
  hashSecurityCode,
  securityCodeHint,
} from "@/lib/client-security-code";
import {
  countCountableClientProjects,
  defaultSecurityMode,
} from "@/lib/multi-project-access";
import { prisma } from "@/lib/prisma";
import { toActionError } from "@/lib/prisma-errors";
import { canManageClients } from "@/lib/project-access";
import { requireModule, toPermissionUser } from "@/lib/session";
import { capitalizeProper } from "@/lib/text-case";

async function assertClientManage() {
  const session = await requireModule("clients");
  const user = toPermissionUser(session);
  if (!canManageClients(user)) {
    throw new Error("Not authorized to manage clients.");
  }
  return session;
}

async function loadClientOrThrow(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      companyId: true,
      multiProjectAccess: true,
      multiProjectSecurityMode: true,
      name: true,
    },
  });
  if (!client) throw new Error("Client not found.");
  return client;
}

export async function updateMultiProjectSettings(
  clientId: string,
  formData: FormData
): Promise<{ readyPrompt: boolean }> {
  try {
    await assertClientManage();
    const client = await loadClientOrThrow(clientId);

    const enabled =
      String(formData.get("multiProjectAccess") ?? "").toLowerCase() ===
        "yes" ||
      String(formData.get("multiProjectAccess") ?? "") === "true";
    const modeRaw = String(formData.get("multiProjectSecurityMode") ?? "")
      .trim()
      .toUpperCase();
    let mode: MultiProjectSecurityMode | null = defaultSecurityMode(enabled);
    if (enabled) {
      if (modeRaw === "GROUP_ONLY") mode = "GROUP_ONLY";
      else mode = "MASTER_AND_GROUP";
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        multiProjectAccess: enabled,
        multiProjectSecurityMode: mode,
      },
    });

    const count = await countCountableClientProjects(clientId);
    const readyPrompt = enabled && count >= 2;

    revalidatePath("/clients");
    revalidatePath(`/billing/${clientId}`);
    return { readyPrompt };
  } catch (error) {
    throw toActionError(error, "Failed to update Multi-Project Access.");
  }
}

export async function createClientProjectGroup(
  clientId: string,
  formData: FormData
) {
  try {
    await assertClientManage();
    await loadClientOrThrow(clientId);

    const name = capitalizeProper(String(formData.get("name") ?? "").trim());
    if (!name) throw new Error("Group name is required.");

    const top = await prisma.clientProjectGroup.findFirst({
      where: { clientId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    await prisma.clientProjectGroup.create({
      data: {
        clientId,
        name,
        sortOrder: (top?.sortOrder ?? 0) + 10,
      },
    });

    revalidatePath("/clients");
  } catch (error) {
    throw toActionError(error, "Failed to create project group.");
  }
}

export async function deleteClientProjectGroup(groupId: string) {
  try {
    await assertClientManage();
    const group = await prisma.clientProjectGroup.findUnique({
      where: { id: groupId },
      select: { id: true, clientId: true },
    });
    if (!group) throw new Error("Group not found.");

    await prisma.$transaction(async (tx) => {
      await tx.project.updateMany({
        where: { groupId },
        data: { groupId: null },
      });
      await tx.clientProjectGroup.delete({ where: { id: groupId } });
    });

    revalidatePath("/clients");
  } catch (error) {
    throw toActionError(error, "Failed to delete project group.");
  }
}

export async function assignProjectsToGroup(
  clientId: string,
  groupId: string | null,
  projectIds: string[]
) {
  try {
    await assertClientManage();
    await loadClientOrThrow(clientId);

    if (groupId) {
      const group = await prisma.clientProjectGroup.findFirst({
        where: { id: groupId, clientId },
        select: { id: true },
      });
      if (!group) throw new Error("Group not found.");
    }

    const ids = projectIds.map(String).filter(Boolean);
    if (ids.length === 0) return;

    await prisma.project.updateMany({
      where: { id: { in: ids }, clientId },
      data: { groupId },
    });

    revalidatePath("/clients");
    revalidatePath("/projects");
  } catch (error) {
    throw toActionError(error, "Failed to assign projects to group.");
  }
}

/**
 * Generates a new Security Code (Master or Group). Returns plaintext once.
 */
export async function generateClientSecurityCode(options: {
  clientId: string;
  kind: "MASTER" | "GROUP";
  groupId?: string | null;
}): Promise<{ code: string; codeId: string }> {
  try {
    await assertClientManage();
    const client = await loadClientOrThrow(options.clientId);

    if (options.kind === "GROUP") {
      if (!options.groupId) throw new Error("Group is required for a Group code.");
      const group = await prisma.clientProjectGroup.findFirst({
        where: { id: options.groupId, clientId: options.clientId },
        select: { id: true },
      });
      if (!group) throw new Error("Group not found.");
    } else if (options.groupId) {
      throw new Error("Master Security Code cannot be tied to a group.");
    }

    if (
      options.kind === "MASTER" &&
      client.multiProjectSecurityMode === "GROUP_ONLY"
    ) {
      throw new Error(
        "Master Security Code is not used in Group Only mode. Switch to Master And Group first."
      );
    }

    const code = generateSecurityCode();
    const codeHash = await hashSecurityCode(code);
    const codeHint = securityCodeHint(code);

    const created = await prisma.$transaction(async (tx) => {
      await tx.clientSecurityCode.updateMany({
        where: {
          clientId: options.clientId,
          kind: options.kind,
          groupId: options.kind === "GROUP" ? options.groupId! : null,
          active: true,
        },
        data: { active: false },
      });

      return tx.clientSecurityCode.create({
        data: {
          clientId: options.clientId,
          kind: options.kind,
          groupId: options.kind === "GROUP" ? options.groupId! : null,
          codeHash,
          codeHint,
          failedAttempts: 0,
          lockedUntil: null,
          active: true,
        },
        select: { id: true },
      });
    });

    revalidatePath("/clients");
    return { code, codeId: created.id };
  } catch (error) {
    throw toActionError(error, "Failed to generate Security Code.");
  }
}

function isNextRedirectError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "digest" in error &&
    String((error as { digest?: string }).digest ?? "").startsWith(
      "NEXT_REDIRECT"
    )
  );
}

export async function getClientMultiProjectAdminState(clientId: string) {
  try {
    await assertClientManage();
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        multiProjectAccess: true,
        multiProjectSecurityMode: true,
        contactPersonFirstName: true,
        contactPersonLastName: true,
        projectGroups: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            sortOrder: true,
            projects: {
              select: { id: true, name: true, status: true },
              orderBy: { name: "asc" },
            },
            securityCodes: {
              where: { active: true },
              select: {
                id: true,
                kind: true,
                codeHint: true,
                failedAttempts: true,
                lockedUntil: true,
                updatedAt: true,
              },
              take: 1,
            },
          },
        },
        securityCodes: {
          where: { kind: "MASTER", active: true },
          select: {
            id: true,
            kind: true,
            codeHint: true,
            failedAttempts: true,
            lockedUntil: true,
            updatedAt: true,
          },
          take: 1,
        },
        projects: {
          select: {
            id: true,
            name: true,
            status: true,
            groupId: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });
    if (!client) throw new Error("Client not found.");

    const countableProjects = await countCountableClientProjects(clientId);
    const active = client.multiProjectAccess && countableProjects >= 2;
    const ungrouped = client.projects.filter((p) => !p.groupId);

    return {
      ...client,
      countableProjects,
      active,
      ungrouped,
      readyPrompt: active,
      masterCode: client.securityCodes[0] ?? null,
    };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    throw toActionError(error, "Failed to load Multi-Project Access.");
  }
}
