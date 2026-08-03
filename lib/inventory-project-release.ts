import type { Prisma } from "@prisma/client";

import { assertEquipmentInventoryInvariants } from "@/lib/equipment-asset";
import { lockInventoryItemRow } from "@/lib/inventory-access";
import {
  inventoryQtyFromDecimal,
  normalizeInventoryQty,
  toDecimal,
} from "@/lib/inventory";

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
 * Mirrors employee release → AVAILABLE pool: machines leave the site when crew does.
 * Consumables / Chemicals stay issued (consumed cost).
 *
 * After assets return, warehouse `currentStock` is synced to count(AVAILABLE)
 * so orphan ON_PROJECT rows (issue already voided) cannot leave stock drift
 * that page-load backfill historically "fixed" by minting ghosts.
 *
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

  if (equipmentIssues.length === 0) {
    // Still reset any asset records that might exist (e.g. if movements were manually voided)
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
    await syncEquipmentWarehouseStockForItems(db, [...affectedItemIds]);
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
    // ISSUE_TO_PROJECT quantities are stored negative — restore with abs.
    const restoreQty = Math.abs(inventoryQtyFromDecimal(movement.quantity));
    if (restoreQty <= 0) continue;

    const locked = await lockInventoryItemRow(db, movement.itemId);
    if (!locked) continue;

    const currentStock = inventoryQtyFromDecimal(locked.currentStock);
    const newStock = normalizeInventoryQty(currentStock + restoreQty);

    const updated = await db.inventoryMovement.updateMany({
      where: { id: movement.id, voidedAt: null },
      data: { voidedAt, voidReason },
    });
    if (updated.count !== 1) continue;

    await db.inventoryItem.update({
      where: { id: movement.itemId },
      data: { currentStock: toDecimal(newStock) },
    });
    restored += 1;
  }

  // Reset all ON_PROJECT assets for this project back to the available pool.
  // Clears both picker (`movementId`) and bulk (`issueMovementId`) links.
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

  // Source of truth after demob: AVAILABLE ledger (covers orphan assets and
  // issue-qty vs asset-count drift without minting new units).
  await syncEquipmentWarehouseStockForItems(db, [...affectedItemIds]);

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
  itemIds: string[]
): Promise<void> {
  for (const itemId of itemIds) {
    const locked = await lockInventoryItemRow(db, itemId);
    if (!locked) continue;
    const available = await db.equipmentAsset.count({
      where: { itemId, status: "AVAILABLE" },
    });
    const stockOnHand = inventoryQtyFromDecimal(locked.currentStock);
    if (stockOnHand === available) continue;
    await db.inventoryItem.update({
      where: { id: itemId },
      data: { currentStock: toDecimal(available) },
    });
  }
}
