"use server";

import { revalidatePath } from "next/cache";

import {
  allocateAssetCodes,
  assertEquipmentInventoryInvariants,
} from "@/lib/equipment-asset";
import {
  inventoryQtyFromDecimal,
  movementTotalCost,
  normalizeInventoryQty,
  toDecimal,
} from "@/lib/inventory";
import {
  canAssignInventoryToProject,
  lockInventoryItemRow,
} from "@/lib/inventory-access";
import { prisma } from "@/lib/prisma";
import { toActionError } from "@/lib/prisma-errors";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { requireModule, toPermissionUser } from "@/lib/session";
import { canManageInventory } from "@/lib/project-access";
import { decimalToNumber } from "@/lib/project-billing";
import { capitalizeProper } from "@/lib/text-case";
import type { AppLocale } from "@/lib/i18n/locale";

const EQUIPMENT_ITEM_TYPE = "Equipment";

function isEquipmentItemType(itemType: string): boolean {
  return itemType.trim().toLowerCase() === EQUIPMENT_ITEM_TYPE.toLowerCase();
}

async function assertCanAssignEquipment(locale: AppLocale) {
  const session = await requireModule("inventory");
  if (!canManageInventory(toPermissionUser(session))) {
    throw new Error(translate(locale, "pages.inventory.permissionDenied"));
  }
  const allowed = await canAssignInventoryToProject(session.user.id, {
    ...toPermissionUser(session),
    username: session.user.username,
  });
  if (!allowed) {
    throw new Error(translate(locale, "pages.inventory.assignPermissionDenied"));
  }
  return session;
}

async function requireCompany(locale: AppLocale) {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    throw new Error(translate(locale, "pages.inventory.companyNotFound"));
  }
  return company;
}

function revalidateProjectEquipment(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/inventory");
}

/**
 * @deprecated Equipment is issued only from Inventory → Project Issues.
 * Kept so existing clients get a clear error instead of a silent dual path.
 */
export async function assignEquipmentAssetToProject(_formData: FormData) {
  const locale = await getServerLocale();
  throw new Error(
    translate(locale, "pages.projects.equipmentPicker.assignDisabledUseInventory")
  );
}

/**
 * Release an ON_PROJECT EquipmentAsset back to AVAILABLE.
 * - Picker assign (`movementId`): void the 1-unit ISSUE_TO_PROJECT and restore stock.
 * - Bulk inventory issue (`issueMovementId`): shrink that movement by 1 (void if zero)
 *   so project-page backfill cannot immediately re-assign the unit, then restore stock.
 * Asset location update always runs even if stock restore is skipped (no locked row).
 * Equipment movements carry zero project COGS (custody only).
 *
 * FormData fields: assetId, projectId
 */
export async function releaseEquipmentAssetFromProject(formData: FormData) {
  const locale = await getServerLocale();
  try {
    await assertCanAssignEquipment(locale);
    const company = await requireCompany(locale);

    const assetId = String(formData.get("assetId") ?? "").trim();
    const projectId = String(formData.get("projectId") ?? "").trim();

    if (!assetId) {
      throw new Error(translate(locale, "pages.projects.equipmentPicker.assetRequired"));
    }
    if (!projectId) {
      throw new Error(translate(locale, "pages.inventory.projectRequired"));
    }

    await prisma.$transaction(async (tx) => {
      const asset = await tx.equipmentAsset.findFirst({
        where: {
          id: assetId,
          companyId: company.id,
          projectId,
          status: "ON_PROJECT",
        },
        select: {
          id: true,
          itemId: true,
          movementId: true,
          issueMovementId: true,
          assetCode: true,
        },
      });
      if (!asset) {
        throw new Error(translate(locale, "pages.projects.equipmentPicker.assetNotOnProject"));
      }

      const voidReason = `Asset ${asset.assetCode} released from project`;

      // Picker assign: void the per-asset movement.
      if (asset.movementId) {
        await tx.inventoryMovement.updateMany({
          where: { id: asset.movementId, voidedAt: null },
          data: {
            voidedAt: new Date(),
            voidReason,
          },
        });
      } else if (asset.issueMovementId) {
        // Bulk inventory issue: shrink (or void) the shared movement so
        // open-issue qty cannot pull a replacement unit on repair scripts.
        const movement = await tx.inventoryMovement.findFirst({
          where: {
            id: asset.issueMovementId,
            companyId: company.id,
            type: "ISSUE_TO_PROJECT",
            voidedAt: null,
          },
          select: { id: true, quantity: true, unitCost: true },
        });

        if (movement) {
          const issuedQty = Math.abs(inventoryQtyFromDecimal(movement.quantity));
          const remainingQty = normalizeInventoryQty(issuedQty - 1);
          const unitCost = decimalToNumber(movement.unitCost) ?? 0;

          if (remainingQty <= 0) {
            await tx.inventoryMovement.updateMany({
              where: { id: movement.id, voidedAt: null },
              data: {
                voidedAt: new Date(),
                voidReason,
              },
            });
          } else {
            await tx.inventoryMovement.update({
              where: { id: movement.id },
              data: {
                quantity: toDecimal(-remainingQty),
                totalCost: toDecimal(movementTotalCost(remainingQty, unitCost)),
              },
            });
          }
        }
      }

      // Return asset to available pool (location change — always succeed).
      await tx.equipmentAsset.update({
        where: { id: asset.id },
        data: {
          status: "AVAILABLE",
          projectId: null,
          movementId: null,
          issueMovementId: null,
          assignedAt: null,
        },
      });

      // Warehouse On Hand = AVAILABLE count (avoids double-restore on stale links).
      const locked = await lockInventoryItemRow(tx, asset.itemId);
      if (locked) {
        const available = await tx.equipmentAsset.count({
          where: { itemId: asset.itemId, status: "AVAILABLE" },
        });
        await tx.inventoryItem.update({
          where: { id: asset.itemId },
          data: { currentStock: toDecimal(available) },
        });
      }

      await assertEquipmentInventoryInvariants(tx, company.id, {
        itemIds: [asset.itemId],
        projectId,
        // Empty skips unrelated open-issue drift; only touched movements checked.
        movementIds: [asset.movementId, asset.issueMovementId].filter(
          (id): id is string => !!id
        ),
      });
    });

    revalidateProjectEquipment(projectId);
  } catch (error) {
    throw toActionError(error, translate(locale, "pages.projects.equipmentPicker.releaseFailed"));
  }
}

/**
 * Manually register a new EquipmentAsset unit for a catalog item.
 * Used by admins for existing physical units not yet in the system.
 * Does NOT create a purchase movement — stock count is not changed
 * (the item was presumably already purchased / stocked separately).
 *
 * FormData fields: itemId, serialNo (optional), notes (optional)
 */
export async function registerEquipmentAsset(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanAssignEquipment(locale);
    const company = await requireCompany(locale);

    const itemId = String(formData.get("itemId") ?? "").trim();
    const serialNo = String(formData.get("serialNo") ?? "").trim() || null;
    const notes = capitalizeProper(String(formData.get("notes") ?? "").trim()) || null;

    if (!itemId) {
      throw new Error(translate(locale, "pages.inventory.itemRequired"));
    }

    const item = await prisma.inventoryItem.findFirst({
      where: {
        id: itemId,
        companyId: company.id,
        active: true,
        deletedAt: null,
      },
      select: { id: true, sku: true, itemType: true },
    });
    if (!item) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }
    if (!isEquipmentItemType(item.itemType)) {
      throw new Error(translate(locale, "pages.projects.equipmentPicker.assetNotEquipment"));
    }

    await prisma.$transaction(async (tx) => {
      const [assetCode] = await allocateAssetCodes(company.id, item.sku, 1, tx);
      await tx.equipmentAsset.create({
        data: {
          companyId: company.id,
          itemId: item.id,
          assetCode,
          status: "AVAILABLE",
          serialNo,
          notes,
        },
      });

      // On Hand for Equipment = AVAILABLE warehouse count. If this unit was not
      // already covered by stock (e.g. physical unit newly registered), raise stock.
      const locked = await lockInventoryItemRow(tx, item.id);
      if (locked) {
        const currentStock = inventoryQtyFromDecimal(locked.currentStock);
        const available = await tx.equipmentAsset.count({
          where: { itemId: item.id, status: "AVAILABLE" },
        });
        if (available > currentStock) {
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { currentStock: toDecimal(available) },
          });
        }
      }
    });

    revalidatePath("/inventory");
  } catch (error) {
    throw toActionError(error, translate(locale, "pages.projects.equipmentPicker.registerFailed"));
  }
}
