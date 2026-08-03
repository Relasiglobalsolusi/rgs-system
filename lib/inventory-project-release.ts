import type { Prisma } from "@prisma/client";

import { lockInventoryItemRow } from "@/lib/inventory-access";
import { toDecimal } from "@/lib/inventory";
import { decimalToNumber } from "@/lib/project-billing";

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
  if (equipmentIssues.length === 0) {
    // Still reset any asset records that might exist (e.g. if movements were manually voided)
    await db.equipmentAsset.updateMany({
      where: { projectId, companyId: project.companyId, status: "ON_PROJECT" },
      data: { status: "AVAILABLE", projectId: null, movementId: null, assignedAt: null },
    });
    return 0;
  }

  const voidReason =
    options?.voidReason?.trim() || "Released With Project Crew";
  const voidedAt = new Date();
  let restored = 0;

  for (const movement of equipmentIssues) {
    const restoreQty = Math.abs(
      decimalToNumber(movement.quantity) ?? 0
    );
    if (restoreQty <= 0) continue;

    const locked = await lockInventoryItemRow(db, movement.itemId);
    if (!locked) continue;

    const currentStock = decimalToNumber(locked.currentStock) ?? 0;
    const newStock = currentStock + restoreQty;

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
  // This covers both assets whose movements were just voided above,
  // and any that lost their movement link for other reasons.
  await db.equipmentAsset.updateMany({
    where: { projectId, companyId: project.companyId, status: "ON_PROJECT" },
    data: { status: "AVAILABLE", projectId: null, movementId: null, assignedAt: null },
  });

  return restored;
}
