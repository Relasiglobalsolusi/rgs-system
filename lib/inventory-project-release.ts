import type { Prisma } from "@prisma/client";

import {
  assertEquipmentInventoryInvariants,
  nextOnHandAfterAvailableChange,
} from "@/lib/equipment-asset";
import { lockInventoryItemRow } from "@/lib/inventory-access";
import { inventoryQtyFromDecimal, toDecimal } from "@/lib/inventory";

/** Catalog item types that return to warehouse when project crew is released. */
export const RETURNABLE_EQUIPMENT_ITEM_TYPES = ["Equipment"] as const;

export function isReturnableEquipmentItemType(itemType: string): boolean {
  const normalized = itemType.trim().toLowerCase();
  return RETURNABLE_EQUIPMENT_ITEM_TYPES.some(
    (type) => type.toLowerCase() === normalized
  );
}

/**
 * Soft-void open Equipment issues on a project, restore on-hand stock,
 * and reset all ON_PROJECT EquipmentAsset records back to AVAILABLE.
 * Call inside the same transaction as {@link releaseAllProjectCrew}.
 */
export async function releaseProjectEquipmentToInventory(
  db: Prisma.TransactionClient,
  projectId: string,
  options?: { voidReason?: string }
): Promise<number> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, companyId: true },
  });
  if (!project) return 0;

  const onProjectAssets = await db.equipmentAsset.findMany({
    where: {
      projectId,
      companyId: project.companyId,
      status: "ON_PROJECT",
    },
    select: { itemId: true },
  });

  const issues = await db.inventoryMovement.findMany({
    where: {
      projectId,
      companyId: project.companyId,
      type: "ISSUE_TO_PROJECT",
      voidedAt: null,
    },
    select: {
      id: true,
      itemId: true,
      quantity: true,
      item: { select: { itemType: true } },
    },
  });

  const equipmentIssues = issues.filter((row) =>
    isReturnableEquipmentItemType(row.item.itemType)
  );

  const affectedItemIds = new Set<string>();
  for (const row of onProjectAssets) affectedItemIds.add(row.itemId);
  for (const row of equipmentIssues) affectedItemIds.add(row.itemId);

  const beforeByItem = new Map<string, { stock: number; available: number }>();
  for (const itemId of affectedItemIds) {
    const locked = await lockInventoryItemRow(db, itemId);
    if (!locked) continue;
    beforeByItem.set(itemId, {
      stock: inventoryQtyFromDecimal(locked.currentStock),
      available: await db.equipmentAsset.count({
        where: { itemId, status: "AVAILABLE" },
      }),
    });
  }

  if (equipmentIssues.length === 0) {
    await db.equipmentAsset.updateMany({
      where: { projectId, companyId: project.companyId, status: "ON_PROJECT" },
      data: {
        status: "AVAILABLE",
        projectId: null,
        movementId: null,
        issueMovementId: null,
        assignedAt: null,
      },
    });
    await db.equipmentAsset.updateMany({
      where: { projectId, companyId: project.companyId, status: "IN_TRANSIT" },
      data: { projectId: null },
    });
    await syncEquipmentWarehouseStockForItems(
      db,
      [...affectedItemIds],
      beforeByItem
    );
    if (affectedItemIds.size > 0) {
      await assertEquipmentInventoryInvariants(db, project.companyId, {
        itemIds: [...affectedItemIds],
        projectId,
      });
    }
    return 0;
  }

  const voidReason =
    options?.voidReason?.trim() || "Released With Project Crew";
  const voidedAt = new Date();
  let restored = 0;

  for (const movement of equipmentIssues) {
    const restoreQty = Math.abs(inventoryQtyFromDecimal(movement.quantity));
    if (restoreQty <= 0) continue;
    const updated = await db.inventoryMovement.updateMany({
      where: { id: movement.id, voidedAt: null },
      data: { voidedAt, voidReason },
    });
    if (updated.count !== 1) continue;
    restored += 1;
  }

  await db.equipmentAsset.updateMany({
    where: { projectId, companyId: project.companyId, status: "ON_PROJECT" },
    data: {
      status: "AVAILABLE",
      projectId: null,
      movementId: null,
      issueMovementId: null,
      assignedAt: null,
    },
  });

  await db.equipmentAsset.updateMany({
    where: { projectId, companyId: project.companyId, status: "IN_TRANSIT" },
    data: { projectId: null },
  });

  await syncEquipmentWarehouseStockForItems(
    db,
    [...affectedItemIds],
    beforeByItem
  );

  if (affectedItemIds.size > 0) {
    await assertEquipmentInventoryInvariants(db, project.companyId, {
      itemIds: [...affectedItemIds],
      projectId,
    });
  }

  return restored;
}

async function syncEquipmentWarehouseStockForItems(
  db: Prisma.TransactionClient,
  itemIds: string[],
  beforeByItem: Map<string, { stock: number; available: number }>
): Promise<void> {
  for (const itemId of itemIds) {
    const locked = await lockInventoryItemRow(db, itemId);
    if (!locked) continue;
    const availableAfter = await db.equipmentAsset.count({
      where: { itemId, status: "AVAILABLE" },
    });
    const before = beforeByItem.get(itemId);
    const next = nextOnHandAfterAvailableChange(
      before?.stock ?? inventoryQtyFromDecimal(locked.currentStock),
      before?.available ?? availableAfter,
      availableAfter
    );
    if (inventoryQtyFromDecimal(locked.currentStock) === next) continue;
    await db.inventoryItem.update({
      where: { id: itemId },
      data: { currentStock: toDecimal(next) },
    });
  }
}
