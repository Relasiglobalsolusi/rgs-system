"use server";

import { revalidatePath } from "next/cache";

import { allocateAssetCodes } from "@/lib/equipment-asset";
import {
  inventoryQtyFromDecimal,
  movementTotalCost,
  normalizeInventoryQty,
  toDecimal,
  INVENTORY_ISSUE_PROJECT_STATUSES,
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
 * Assign one AVAILABLE EquipmentAsset to a project.
 * Also creates an ISSUE_TO_PROJECT movement for financial cost tracking.
 * Gate: project must be IN_PROGRESS; same permission as inventory stock assign.
 *
 * FormData fields: assetId, projectId
 */
export async function assignEquipmentAssetToProject(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanAssignEquipment(locale);
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
      // Verify asset is AVAILABLE and belongs to company Equipment item
      const asset = await tx.equipmentAsset.findFirst({
        where: { id: assetId, companyId: company.id, status: "AVAILABLE" },
        select: {
          id: true,
          itemId: true,
          assetCode: true,
          item: { select: { itemType: true, active: true } },
        },
      });
      if (!asset) {
        throw new Error(translate(locale, "pages.projects.equipmentPicker.assetNotAvailable"));
      }
      if (!isEquipmentItemType(asset.item.itemType)) {
        throw new Error(translate(locale, "pages.projects.equipmentPicker.assetNotEquipment"));
      }
      if (!asset.item.active) {
        throw new Error(translate(locale, "pages.inventory.itemNotFound"));
      }

      // Verify project is issuable
      const project = await tx.project.findFirst({
        where: {
          id: projectId,
          companyId: company.id,
          status: { in: [...INVENTORY_ISSUE_PROJECT_STATUSES] },
        },
        select: { id: true },
      });
      if (!project) {
        throw new Error(translate(locale, "pages.inventory.projectNotIssuable"));
      }

      // Lock item row and create cost movement (1 unit at avg cost)
      const locked = await lockInventoryItemRow(tx, asset.itemId);
      if (!locked || !locked.active) {
        throw new Error(translate(locale, "pages.inventory.itemNotFound"));
      }

      const currentStock = inventoryQtyFromDecimal(locked.currentStock);
      if (currentStock < 1) {
        throw new Error(translate(locale, "pages.projects.equipmentPicker.noStockRemaining"));
      }

      const unitCost =
        decimalToNumber(locked.avgUnitCost) ??
        decimalToNumber(locked.lastUnitCost) ??
        0;
      const totalCost = movementTotalCost(1, unitCost);

      const movement = await tx.inventoryMovement.create({
        data: {
          companyId: company.id,
          itemId: asset.itemId,
          projectId: project.id,
          type: "ISSUE_TO_PROJECT",
          quantity: toDecimal(-1),
          unitCost: toDecimal(unitCost),
          totalCost: toDecimal(totalCost),
          movedAt: new Date(),
          notes: `Asset ${asset.assetCode} assigned to project`,
          createdById: session.user.id,
        },
      });

      // Decrement stock cache
      const stockUpdate = await tx.inventoryItem.updateMany({
        where: { id: asset.itemId, currentStock: { gte: toDecimal(1) } },
        data: { currentStock: toDecimal(normalizeInventoryQty(currentStock - 1)) },
      });
      if (stockUpdate.count !== 1) {
        throw new Error(translate(locale, "pages.projects.equipmentPicker.noStockRemaining"));
      }

      // Mark asset ON_PROJECT and link movement
      await tx.equipmentAsset.update({
        where: { id: asset.id },
        data: {
          status: "ON_PROJECT",
          projectId: project.id,
          movementId: movement.id,
          assignedAt: new Date(),
        },
      });
    });

    revalidateProjectEquipment(projectId);
  } catch (error) {
    throw toActionError(error, translate(locale, "pages.projects.equipmentPicker.assignFailed"));
  }
}

/**
 * Release an ON_PROJECT EquipmentAsset back to AVAILABLE.
 * Voids the linked ISSUE_TO_PROJECT movement and restores stock cache.
 * Gate: same permission as inventory assign.
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
        select: { id: true, itemId: true, movementId: true, assetCode: true },
      });
      if (!asset) {
        throw new Error(translate(locale, "pages.projects.equipmentPicker.assetNotOnProject"));
      }

      // Void the cost movement and restore stock
      if (asset.movementId) {
        const locked = await lockInventoryItemRow(tx, asset.itemId);
        if (locked) {
          const currentStock = inventoryQtyFromDecimal(locked.currentStock);
          await tx.inventoryMovement.updateMany({
            where: { id: asset.movementId, voidedAt: null },
            data: {
              voidedAt: new Date(),
              voidReason: `Asset ${asset.assetCode} released from project`,
            },
          });
          await tx.inventoryItem.update({
            where: { id: asset.itemId },
            data: { currentStock: toDecimal(normalizeInventoryQty(currentStock + 1)) },
          });
        }
      }

      // Return asset to available pool
      await tx.equipmentAsset.update({
        where: { id: asset.id },
        data: {
          status: "AVAILABLE",
          projectId: null,
          movementId: null,
          assignedAt: null,
        },
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
      where: { id: itemId, companyId: company.id, active: true },
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
    });

    revalidatePath("/inventory");
  } catch (error) {
    throw toActionError(error, translate(locale, "pages.projects.equipmentPicker.registerFailed"));
  }
}
