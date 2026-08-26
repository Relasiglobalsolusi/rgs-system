import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/** Move a team's equipment onto the team's current job, or back to available. */
export async function syncTeamEquipmentToProject(
  db: Db,
  options: {
    teamId: string;
    projectId: string | null;
  }
) {
  const assets = await db.equipmentAsset.findMany({
    where: {
      teamId: options.teamId,
      status: { in: ["AVAILABLE", "ON_PROJECT"] },
      soldOffMovementId: null,
      writeOffMovementId: null,
    },
    select: { id: true },
  });
  if (assets.length === 0) return;

  const ids = assets.map((row) => row.id);
  if (options.projectId) {
    await db.equipmentAsset.updateMany({
      where: { id: { in: ids } },
      data: {
        projectId: options.projectId,
        status: "ON_PROJECT",
        assignedAt: new Date(),
      },
    });
    return;
  }

  await db.equipmentAsset.updateMany({
    where: { id: { in: ids } },
    data: {
      projectId: null,
      status: "AVAILABLE",
      assignedAt: null,
    },
  });
}

export async function assignEquipmentAssetsToTeam(
  db: Db,
  options: {
    teamId: string;
    assetIds: string[];
    companyId: string;
  }
) {
  const uniqueIds = [...new Set(options.assetIds.filter(Boolean))];

  const current = await db.equipmentAsset.findMany({
    where: {
      teamId: options.teamId,
      companyId: options.companyId,
      soldOffMovementId: null,
      writeOffMovementId: null,
    },
    select: { id: true },
  });
  const nextIds = new Set(uniqueIds);
  const removedIds = current
    .map((row) => row.id)
    .filter((id) => !nextIds.has(id));

  if (uniqueIds.length > 0) {
    const assets = await db.equipmentAsset.findMany({
      where: {
        id: { in: uniqueIds },
        companyId: options.companyId,
        soldOffMovementId: null,
        writeOffMovementId: null,
      },
      select: { id: true },
    });
    if (assets.length !== uniqueIds.length) {
      throw new Error("One or more equipment units were not found.");
    }
  }

  const teamJob = await db.operationsTeamProject.findFirst({
    where: { teamId: options.teamId },
    orderBy: { assignedAt: "desc" },
    select: { projectId: true },
  });

  if (removedIds.length > 0) {
    await db.equipmentAsset.updateMany({
      where: { id: { in: removedIds } },
      data: {
        teamId: null,
        projectId: null,
        status: "AVAILABLE",
        assignedAt: null,
      },
    });
  }

  if (uniqueIds.length === 0) return;

  await db.equipmentAsset.updateMany({
    where: { id: { in: uniqueIds } },
    data: {
      teamId: options.teamId,
      ...(teamJob
        ? {
            projectId: teamJob.projectId,
            status: "ON_PROJECT" as const,
            assignedAt: new Date(),
          }
        : {}),
    },
  });
}
