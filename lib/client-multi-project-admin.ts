import type { MultiProjectSecurityMode } from "@prisma/client";

import {
  generateSecurityCode,
  hashSecurityCode,
} from "@/lib/client-security-code";
import { getCurrentSession } from "@/lib/auth";
import {
  countCountableClientProjects,
  defaultSecurityMode,
} from "@/lib/multi-project-access";
import type {
  MultiProjectAdminState,
  MultiProjectCodeDTO,
} from "@/lib/client-multi-project-types";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import { canManageClients } from "@/lib/project-access";
import { toPermissionUser } from "@/lib/session";
import { capitalizeProper } from "@/lib/text-case";

export type {
  MultiProjectAdminState,
  MultiProjectCodeDTO,
  MultiProjectGroupDTO,
  MultiProjectProjectDTO,
} from "@/lib/client-multi-project-types";

async function requireClientManager() {
  const session = await getCurrentSession();
  const locale = await getServerLocale();
  if (!session?.user) {
    throw new Error(
      translate(locale, "pages.clients.multiProject.notAuthorized")
    );
  }
  const user = toPermissionUser(session);
  if (!canManageClients(user)) {
    throw new Error(
      translate(locale, "pages.clients.multiProject.notAuthorized")
    );
  }
  return { session, locale };
}

async function loadClientOrThrow(clientId: string, locale: Awaited<ReturnType<typeof getServerLocale>>) {
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
  if (!client) {
    throw new Error(translate(locale, "pages.clients.notFound"));
  }
  return client;
}

function serializeCode(row: {
  id: string;
  kind: "MASTER" | "GROUP";
  codeHint: string | null;
  failedAttempts: number;
  lockedUntil: Date | null;
  updatedAt: Date;
}): MultiProjectCodeDTO {
  return {
    id: row.id,
    kind: row.kind,
    codeHint: row.codeHint,
    failedAttempts: row.failedAttempts,
    lockedUntil: row.lockedUntil?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function loadClientMultiProjectAdminState(
  clientId: string
): Promise<MultiProjectAdminState> {
  const { locale } = await requireClientManager();
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      multiProjectAccess: true,
      multiProjectSecurityMode: true,
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
  if (!client) {
    throw new Error(translate(locale, "pages.clients.notFound"));
  }

  const countableProjects = await countCountableClientProjects(clientId);
  const active = client.multiProjectAccess && countableProjects >= 2;

  return {
    id: client.id,
    name: client.name,
    multiProjectAccess: client.multiProjectAccess,
    multiProjectSecurityMode: client.multiProjectSecurityMode,
    countableProjects,
    active,
    readyPrompt: active,
    projects: client.projects,
    ungrouped: client.projects.filter((project) => !project.groupId),
    projectGroups: client.projectGroups.map((group) => ({
      id: group.id,
      name: group.name,
      sortOrder: group.sortOrder,
      projects: group.projects,
      securityCodes: group.securityCodes.map(serializeCode),
    })),
    masterCode: client.securityCodes[0]
      ? serializeCode(client.securityCodes[0])
      : null,
  };
}

export async function saveMultiProjectSettings(
  clientId: string,
  options: { enabled: boolean; mode: MultiProjectSecurityMode | null }
): Promise<{ readyPrompt: boolean }> {
  const { locale } = await requireClientManager();
  await loadClientOrThrow(clientId, locale);

  const mode: MultiProjectSecurityMode | null = options.enabled
    ? options.mode === "GROUP_ONLY"
      ? "GROUP_ONLY"
      : "MASTER_AND_GROUP"
    : defaultSecurityMode(false);

  await prisma.client.update({
    where: { id: clientId },
    data: {
      multiProjectAccess: options.enabled,
      multiProjectSecurityMode: mode,
    },
  });

  const count = await countCountableClientProjects(clientId);
  return { readyPrompt: options.enabled && count >= 2 };
}

async function issueSecurityCode(options: {
  clientId: string;
  kind: "MASTER" | "GROUP";
  groupId?: string | null;
}): Promise<{ code: string; codeId: string }> {
  const code = generateSecurityCode();
  const codeHash = await hashSecurityCode(code);

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
        codeHint: code,
        failedAttempts: 0,
        lockedUntil: null,
        active: true,
      },
      select: { id: true },
    });
  });

  return { code, codeId: created.id };
}

export async function createMultiProjectGroup(
  clientId: string,
  options: { name: string }
): Promise<{ id: string; code: string }> {
  const { locale } = await requireClientManager();
  const client = await loadClientOrThrow(clientId, locale);
  if (!client.multiProjectAccess) {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        multiProjectAccess: true,
        multiProjectSecurityMode:
          client.multiProjectSecurityMode ?? "MASTER_AND_GROUP",
      },
    });
  }

  const name = capitalizeProper(options.name.trim());
  if (!name) {
    throw new Error(
      translate(locale, "pages.clients.multiProject.groupNameRequired")
    );
  }

  const top = await prisma.clientProjectGroup.findFirst({
    where: { clientId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const group = await prisma.clientProjectGroup.create({
    data: {
      clientId,
      name,
      sortOrder: (top?.sortOrder ?? 0) + 10,
    },
    select: { id: true },
  });

  const issued = await issueSecurityCode({
    clientId,
    kind: "GROUP",
    groupId: group.id,
  });

  return { id: group.id, code: issued.code };
}

export async function deleteMultiProjectGroup(groupId: string) {
  const { locale } = await requireClientManager();
  const group = await prisma.clientProjectGroup.findUnique({
    where: { id: groupId },
    select: { id: true, clientId: true },
  });
  if (!group) {
    throw new Error(
      translate(locale, "pages.clients.multiProject.groupNotFound")
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.updateMany({
      where: { groupId },
      data: { groupId: null },
    });
    await tx.clientProjectGroup.delete({ where: { id: groupId } });
  });
}

export async function assignProjectsToMultiProjectGroup(
  clientId: string,
  groupId: string,
  projectIds: string[]
) {
  const { locale } = await requireClientManager();
  await loadClientOrThrow(clientId, locale);

  if (!groupId) {
    throw new Error(
      translate(locale, "pages.clients.multiProject.groupRequiredToAssign")
    );
  }

  const group = await prisma.clientProjectGroup.findFirst({
    where: { id: groupId, clientId },
    select: { id: true },
  });
  if (!group) {
    throw new Error(
      translate(locale, "pages.clients.multiProject.groupNotFound")
    );
  }

  const ids = projectIds.map(String).filter(Boolean);
  if (ids.length === 0) {
    throw new Error(
      translate(locale, "pages.clients.multiProject.projectsRequiredToAssign")
    );
  }

  await prisma.project.updateMany({
    where: { id: { in: ids }, clientId },
    data: { groupId },
  });
}

export async function generateMultiProjectSecurityCode(options: {
  clientId: string;
  kind: "MASTER" | "GROUP";
  groupId?: string | null;
}): Promise<{ code: string; codeId: string }> {
  const { locale } = await requireClientManager();
  const client = await loadClientOrThrow(options.clientId, locale);

  if (!client.multiProjectAccess) {
    await prisma.client.update({
      where: { id: options.clientId },
      data: {
        multiProjectAccess: true,
        multiProjectSecurityMode:
          client.multiProjectSecurityMode ?? "MASTER_AND_GROUP",
      },
    });
  }

  if (options.kind === "GROUP") {
    if (!options.groupId) {
      throw new Error(
        translate(locale, "pages.clients.multiProject.groupRequiredForCode")
      );
    }
    const group = await prisma.clientProjectGroup.findFirst({
      where: { id: options.groupId, clientId: options.clientId },
      select: { id: true },
    });
    if (!group) {
      throw new Error(
        translate(locale, "pages.clients.multiProject.groupNotFound")
      );
    }
  } else if (options.groupId) {
    throw new Error(
      translate(locale, "pages.clients.multiProject.masterCodeNoGroup")
    );
  }

  if (
    options.kind === "MASTER" &&
    client.multiProjectSecurityMode === "GROUP_ONLY"
  ) {
    throw new Error(
      translate(locale, "pages.clients.multiProject.masterCodeGroupOnlyMode")
    );
  }

  return issueSecurityCode(options);
}
