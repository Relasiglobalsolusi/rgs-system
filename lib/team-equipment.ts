import type { Prisma, PrismaClient } from "@prisma/client";

import {
  nextOnHandAfterAvailableChange,
  shrinkOrVoidEquipmentIssueMovements,
} from "@/lib/equipment-asset";
import { lockInventoryItemRow } from "@/lib/inventory-access";
import { inventoryQtyFromDecimal, toDecimal } from "@/lib/inventory";

type Db = PrismaClient | Prisma.TransactionClient;

type TeamAssetRow = {
  id: string;
  itemId: string;
  status: string;
  projectId: string | null;
  movementId: string | null;
  issueMovementId: string | null;
};

async function applyOnHandAfterAvailableChange(
  db: Db,
  itemId: string,
  availableBefore: number
) {
  const locked = await lockInventoryItemRow(db, itemId);
  if (!locked) return;
  const availableAfter = await db.equipmentAsset.count({
    where: { itemId, status: "AVAILABLE" },
  });
  await db.inventoryItem.update({
    where: { id: itemId },
    data: {
      currentStock: toDecimal(
        nextOnHandAfterAvailableChange(
          inventoryQtyFromDecimal(locked.currentStock),
          availableBefore,
          availableAfter
        )
      ),
    },
  });
}

async function issueAssetsToProject(
  db: Db,
  options: {
    companyId: string;
    projectId: string;
    assets: Array<{ id: string; itemId: string }>;
  }
) {
  const byItem = new Map<string, string[]>();
  for (const asset of options.assets) {
    const list = byItem.get(asset.itemId) ?? [];
    list.push(asset.id);
    byItem.set(asset.itemId, list);
  }
  for (const [itemId, assetIds] of byItem) {
    const availableBefore = await db.equipmentAsset.count({
      where: { itemId, status: "AVAILABLE" },
    });
    const movement = await db.inventoryMovement.create({
      data: {
        companyId: options.companyId,
        itemId,
        projectId: options.projectId,
        type: "ISSUE_TO_PROJECT",
        quantity: toDecimal(-assetIds.length),
        unitCost: toDecimal(0),
        totalCost: toDecimal(0),
        movedAt: new Date(),
        notes: "Team equipment",
      },
    });
    await db.equipmentAsset.updateMany({
      where: { id: { in: assetIds } },
      data: {
        projectId: options.projectId,
        status: "ON_PROJECT",
        assignedAt: new Date(),
        issueMovementId: movement.id,
      },
    });
    await applyOnHandAfterAvailableChange(db, itemId, availableBefore);
  }
}

async function returnAssetsToWarehouse(
  db: Db,
  options: {
    companyId: string;
    assets: TeamAssetRow[];
    clearTeam: boolean;
  }
) {
  if (options.assets.length === 0) return;
  const issueIds = [
    ...new Set(
      options.assets
        .flatMap((asset) => [asset.issueMovementId, asset.movementId])
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const itemIds = [...new Set(options.assets.map((asset) => asset.itemId))];
  const availableBeforeByItem = new Map<string, number>();
  for (const itemId of itemIds) {
    availableBeforeByItem.set(
      itemId,
      await db.equipmentAsset.count({
        where: { itemId, status: "AVAILABLE" },
      })
    );
  }
  await db.equipmentAsset.updateMany({
    where: { id: { in: options.assets.map((asset) => asset.id) } },
    data: {
      projectId: null,
      status: "AVAILABLE",
      assignedAt: null,
      issueMovementId: null,
      movementId: null,
      ...(options.clearTeam ? { teamId: null } : {}),
    },
  });
  if (issueIds.length > 0) {
    await shrinkOrVoidEquipmentIssueMovements(
      db,
      options.companyId,
      issueIds,
      "Team equipment returned"
    );
  }
  for (const [itemId, availableBefore] of availableBeforeByItem) {
    await applyOnHandAfterAvailableChange(db, itemId, availableBefore);
  }
}

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
    select: {
      id: true,
      itemId: true,
      status: true,
      projectId: true,
      companyId: true,
      movementId: true,
      issueMovementId: true,
    },
  });
  if (assets.length === 0) return;
  const companyId = assets[0]?.companyId;
  if (!companyId) return;

  if (options.projectId) {
    const leaving = assets.filter(
      (asset) =>
        asset.status === "ON_PROJECT" && asset.projectId !== options.projectId
    );
    await returnAssetsToWarehouse(db, {
      companyId,
      assets: leaving,
      clearTeam: false,
    });
    const toIssue = assets.filter(
      (asset) =>
        asset.status === "AVAILABLE" ||
        (asset.status === "ON_PROJECT" && asset.projectId !== options.projectId)
    );
    if (toIssue.length > 0) {
      await issueAssetsToProject(db, {
        companyId,
        projectId: options.projectId,
        assets: toIssue.map((asset) => ({ id: asset.id, itemId: asset.itemId })),
      });
    }
    return;
  }

  await returnAssetsToWarehouse(db, {
    companyId,
    assets: assets.filter((asset) => asset.status === "ON_PROJECT"),
    clearTeam: false,
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
    select: {
      id: true,
      itemId: true,
      status: true,
      projectId: true,
      movementId: true,
      issueMovementId: true,
    },
  });
  const nextIds = new Set(uniqueIds);
  const removed = current.filter((row) => !nextIds.has(row.id));

  if (uniqueIds.length > 0) {
    const assets = await db.equipmentAsset.findMany({
      where: {
        id: { in: uniqueIds },
        companyId: options.companyId,
        soldOffMovementId: null,
        writeOffMovementId: null,
      },
      select: { id: true, status: true, teamId: true, itemId: true },
    });
    if (assets.length !== uniqueIds.length) {
      throw new Error("One or more equipment units were not found.");
    }
    const notAssignable = assets.filter(
      (asset) =>
        asset.teamId !== options.teamId && asset.status !== "AVAILABLE"
    );
    if (notAssignable.length > 0) {
      throw new Error("Only Available equipment can be assigned.");
    }
  }

  const teamJob = await db.operationsTeamProject.findFirst({
    where: { teamId: options.teamId },
    orderBy: { assignedAt: "desc" },
    select: { projectId: true },
  });

  if (removed.length > 0) {
    const onProject = removed.filter((row) => row.status === "ON_PROJECT");
    await returnAssetsToWarehouse(db, {
      companyId: options.companyId,
      assets: onProject,
      clearTeam: true,
    });
    const warehouseOnly = removed.filter((row) => row.status !== "ON_PROJECT");
    if (warehouseOnly.length > 0) {
      await db.equipmentAsset.updateMany({
        where: { id: { in: warehouseOnly.map((row) => row.id) } },
        data: {
          teamId: null,
          projectId: null,
          status: "AVAILABLE",
          assignedAt: null,
        },
      });
    }
  }

  if (uniqueIds.length === 0) return;

  const incoming = await db.equipmentAsset.findMany({
    where: {
      id: { in: uniqueIds },
      companyId: options.companyId,
    },
    select: {
      id: true,
      itemId: true,
      status: true,
      teamId: true,
    },
  });
  const newlyAssigned = incoming.filter(
    (asset) => asset.teamId !== options.teamId
  );

  await db.equipmentAsset.updateMany({
    where: { id: { in: uniqueIds } },
    data: { teamId: options.teamId },
  });

  if (teamJob && newlyAssigned.length > 0) {
    await issueAssetsToProject(db, {
      companyId: options.companyId,
      projectId: teamJob.projectId,
      assets: newlyAssigned
        .filter((asset) => asset.status === "AVAILABLE")
        .map((asset) => ({ id: asset.id, itemId: asset.itemId })),
    });
    return;
  }

  await db.equipmentAsset.updateMany({
    where: {
      id: { in: newlyAssigned.map((asset) => asset.id) },
      status: "AVAILABLE",
    },
    data: {
      projectId: null,
      assignedAt: null,
    },
  });
}
