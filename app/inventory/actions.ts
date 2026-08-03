"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import {
  INVENTORY_ISSUE_PROJECT_STATUSES,
  movementTotalCost,
  nextWeightedAvgUnitCost,
  toDecimal,
} from "@/lib/inventory";
import {
  canAssignInventoryToProject,
  lockInventoryItemRow,
} from "@/lib/inventory-access";
import { getNextInventorySku } from "@/lib/inventory-sku";
import {
  InsufficientEquipmentAssetsError,
  mintEquipmentAssets,
  retireEquipmentAssets,
} from "@/lib/equipment-asset";
import { parseFormDateInput } from "@/lib/bulk-import/parse-import-date";
import type { AppLocale } from "@/lib/i18n/locale";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { nextCompanyScopedSortOrder } from "@/lib/persist-reorder";
import { prisma } from "@/lib/prisma";
import { toActionError } from "@/lib/prisma-errors";
import { canManageInventory, canManageItemCatalog } from "@/lib/project-access";
import { decimalToNumber } from "@/lib/project-billing";
import { requireModule, toPermissionUser } from "@/lib/session";
import { capitalizeProper, titleCaseWords } from "@/lib/text-case";
import { saveUpload } from "@/lib/upload";

async function assertCanManageInventory(locale?: AppLocale) {
  const session = await requireModule("inventory");
  if (!canManageInventory(toPermissionUser(session))) {
    throw new Error(
      translate(
        locale ?? (await getServerLocale()),
        "pages.inventory.permissionDenied"
      )
    );
  }
  return session;
}

async function assertCanManageItemCatalog(locale?: AppLocale) {
  const session = await requireModule("itemCatalog");
  if (!canManageItemCatalog(toPermissionUser(session))) {
    throw new Error(
      translate(
        locale ?? (await getServerLocale()),
        "pages.itemCatalog.permissionDenied"
      )
    );
  }
  return session;
}

/** Issue / void project stock — OM+, Director, or HO admin. */
async function assertCanAssignInventory(locale: AppLocale) {
  const session = await assertCanManageInventory(locale);
  const user = toPermissionUser(session);
  const allowed = await canAssignInventoryToProject(session.user.id, {
    ...user,
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

function parsePositiveQty(raw: FormDataEntryValue | null, fieldLabel: string) {
  const value = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldLabel} must be greater than zero.`);
  }
  return value;
}

function parseNonNegNumber(raw: FormDataEntryValue | null, fieldLabel: string) {
  const value = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldLabel} must be zero or greater.`);
  }
  return value;
}

async function saveReceipt(
  formData: FormData,
  options?: { sku?: string | null }
): Promise<string | null | undefined> {
  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) {
    return undefined;
  }
  const code = options?.sku?.trim();
  const fileBaseName = code ? `INV_RECEIPT_${code}` : "INV_RECEIPT";
  return saveUpload(file, "uploads/inventory", { fileBaseName });
}

function revalidateInventory(projectId?: string | null) {
  revalidatePath("/inventory");
  revalidatePath("/item-catalog");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
}

/** Preview next auto SKU for an Item Type ({TYPE}-0001…). */
export async function previewInventorySku(itemType: string) {
  const locale = await getServerLocale();
  await assertCanManageItemCatalog(locale);
  const company = await requireCompany(locale);
  const trimmed = String(itemType ?? "").trim();
  if (!trimmed) return "";
  return getNextInventorySku(company.id, trimmed);
}

/**
 * Step 1 — catalog only.
 * Fields: item type, name, system SKU (from type), description.
 * No purchase/price/qty here.
 */
export async function createInventoryItem(formData: FormData) {
  const locale = await getServerLocale();
  try {
    await assertCanManageItemCatalog(locale);

    const name = titleCaseWords(String(formData.get("name") ?? "").trim());
    const itemType = titleCaseWords(
      String(formData.get("itemType") ?? "").trim()
    );
    const description = capitalizeProper(
      String(formData.get("description") ?? "").trim()
    );

    if (!name) {
      throw new Error(translate(locale, "pages.inventory.itemNameRequired"));
    }
    if (!itemType) {
      throw new Error(translate(locale, "pages.inventory.itemTypeRequired"));
    }

    const company = await requireCompany(locale);
    const sortOrder = await nextCompanyScopedSortOrder(
      "inventoryItem",
      company.id
    );

    await prisma.$transaction(async (tx) => {
      const sku = await getNextInventorySku(company.id, itemType, tx);
      await tx.inventoryItem.create({
        data: {
          companyId: company.id,
          sku,
          name,
          itemType,
          description: description || null,
          sortOrder,
          active: true,
        },
      });
    });

    revalidateInventory();
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.createItemFailed")
    );
  }
}

/** Update catalog fields only (not stock/cost — those come from purchases/issues). */
export async function updateInventoryItem(formData: FormData) {
  const locale = await getServerLocale();
  try {
    await assertCanManageItemCatalog(locale);

    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }

    const name = titleCaseWords(String(formData.get("name") ?? "").trim());
    const itemType = titleCaseWords(
      String(formData.get("itemType") ?? "").trim()
    );
    const description = capitalizeProper(
      String(formData.get("description") ?? "").trim()
    );
    const unitRaw = String(formData.get("unit") ?? "").trim();
    const unit = unitRaw ? unitRaw.toLowerCase() : "pcs";
    const minStock = parseNonNegNumber(
      formData.get("minStock"),
      translate(locale, "pages.inventory.form.minStock")
    );

    if (!name) {
      throw new Error(translate(locale, "pages.inventory.itemNameRequired"));
    }
    if (!itemType) {
      throw new Error(translate(locale, "pages.inventory.itemTypeRequired"));
    }

    const company = await requireCompany(locale);
    const existing = await prisma.inventoryItem.findFirst({
      where: { id, companyId: company.id },
    });
    if (!existing) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }

    // SKU stays system-assigned from create-time type; editing type does not rename SKU.
    await prisma.inventoryItem.update({
      where: { id },
      data: {
        name,
        itemType,
        description: description || null,
        unit,
        minStock: toDecimal(minStock),
      },
    });

    revalidateInventory();
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.updateItemFailed")
    );
  }
}

export async function deactivateInventoryItem(formData: FormData) {
  const locale = await getServerLocale();
  try {
    await assertCanManageItemCatalog(locale);
    const id = String(formData.get("id") ?? "").trim();
    const company = await requireCompany(locale);
    const item = await prisma.inventoryItem.findFirst({
      where: { id, companyId: company.id },
    });
    if (!item) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }
    await prisma.inventoryItem.update({
      where: { id },
      data: { active: false },
    });
    revalidateInventory();
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.deactivateItemFailed")
    );
  }
}

export async function reactivateInventoryItem(formData: FormData) {
  const locale = await getServerLocale();
  try {
    await assertCanManageItemCatalog(locale);
    const id = String(formData.get("id") ?? "").trim();
    const company = await requireCompany(locale);
    const item = await prisma.inventoryItem.findFirst({
      where: { id, companyId: company.id },
    });
    if (!item) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }
    await prisma.inventoryItem.update({
      where: { id },
      data: { active: true },
    });
    revalidateInventory();
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.reactivateItemFailed")
    );
  }
}

/**
 * Step 2 — record a purchase against an existing catalog item (dropdown).
 * Increases stock and updates last/avg unit cost.
 */
export async function createInventoryPurchase(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanManageInventory(locale);
    const company = await requireCompany(locale);

    const itemId = String(formData.get("itemId") ?? "").trim();
    const vendorId = String(formData.get("vendorId") ?? "").trim();
    const invoiceNo = String(formData.get("invoiceNo") ?? "").trim() || null;
    const notes = capitalizeProper(
      String(formData.get("notes") ?? "").trim()
    );

    if (!itemId) {
      throw new Error(translate(locale, "pages.inventory.itemRequired"));
    }
    if (!vendorId) {
      throw new Error(translate(locale, "pages.inventory.vendorRequired"));
    }

    const quantity = parsePositiveQty(
      formData.get("quantity"),
      translate(locale, "pages.inventory.form.quantity")
    );
    const unitPrice = parseNonNegNumber(
      formData.get("unitPrice"),
      translate(locale, "pages.inventory.form.unitPrice")
    );
    const purchasedAt =
      parseFormDateInput(formData.get("purchasedAt"), {
        fieldLabel: translate(locale, "pages.inventory.form.purchasedAt"),
      }) ?? new Date();

    const item = await prisma.inventoryItem.findFirst({
      where: { id: itemId, companyId: company.id, active: true },
    });
    if (!item) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }

    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, companyId: company.id, active: true },
    });
    if (!vendor) {
      throw new Error(translate(locale, "pages.inventory.vendorNotFound"));
    }

    const receiptUrl = await saveReceipt(formData, { sku: item.sku });
    const totalPrice = quantity * unitPrice;
    const movedAt = purchasedAt;

    await prisma.$transaction(async (tx) => {
      const locked = await lockInventoryItemRow(tx, item.id);
      if (!locked || !locked.active) {
        throw new Error(translate(locale, "pages.inventory.itemNotFound"));
      }
      const currentStock = decimalToNumber(locked.currentStock) ?? 0;
      const avgUnitCost = decimalToNumber(locked.avgUnitCost);
      const newAvg = nextWeightedAvgUnitCost({
        currentStock,
        avgUnitCost,
        purchaseQty: quantity,
        purchaseUnitPrice: unitPrice,
      });
      const newStock = currentStock + quantity;

      const movement = await tx.inventoryMovement.create({
        data: {
          companyId: company.id,
          itemId: item.id,
          type: "PURCHASE",
          quantity: toDecimal(quantity),
          unitCost: toDecimal(unitPrice),
          totalCost: toDecimal(totalPrice),
          movedAt,
          notes: notes || null,
          createdById: session.user.id,
        },
      });

      await tx.inventoryPurchase.create({
        data: {
          companyId: company.id,
          itemId: item.id,
          vendorId: vendor.id,
          purchasedAt,
          quantity: toDecimal(quantity),
          unitPrice: toDecimal(unitPrice),
          totalPrice: toDecimal(totalPrice),
          invoiceNo,
          receiptUrl: receiptUrl ?? null,
          notes: notes || null,
          movementId: movement.id,
          createdById: session.user.id,
        },
      });

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          currentStock: toDecimal(newStock),
          lastUnitCost: toDecimal(unitPrice),
          avgUnitCost: toDecimal(newAvg),
        },
      });

      await mintEquipmentAssets(tx, company.id, item.id, quantity);
    });

    revalidateInventory();
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.createPurchaseFailed")
    );
  }
}

/**
 * Issue stock to a project — locks unit cost from current weighted average.
 * Reduces stock; totalCost attributed to the project for financial reporting.
 */
export async function createInventoryProjectIssue(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanAssignInventory(locale);
    const company = await requireCompany(locale);

    const itemId = String(formData.get("itemId") ?? "").trim();
    const projectId = String(formData.get("projectId") ?? "").trim();
    const notes = capitalizeProper(
      String(formData.get("notes") ?? "").trim()
    );

    if (!itemId) {
      throw new Error(translate(locale, "pages.inventory.itemRequired"));
    }
    if (!projectId) {
      throw new Error(translate(locale, "pages.inventory.projectRequired"));
    }

    const quantity = parsePositiveQty(
      formData.get("quantity"),
      translate(locale, "pages.inventory.form.quantity")
    );
    const movedAt =
      parseFormDateInput(formData.get("movedAt"), {
        fieldLabel: translate(locale, "pages.inventory.form.issueDate"),
      }) ?? new Date();

    const item = await prisma.inventoryItem.findFirst({
      where: { id: itemId, companyId: company.id, active: true },
      select: { id: true, unit: true },
    });
    if (!item) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }

    const project = await prisma.project.findFirst({
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

    await prisma.$transaction(async (tx) => {
      const locked = await lockInventoryItemRow(tx, item.id);
      if (!locked || !locked.active) {
        throw new Error(translate(locale, "pages.inventory.itemNotFound"));
      }

      const currentStock = decimalToNumber(locked.currentStock) ?? 0;
      if (currentStock <= 0 || quantity > currentStock + 1e-9) {
        throw new Error(
          translate(locale, "pages.inventory.insufficientStock", {
            available: String(currentStock),
            unit: locked.unit,
          })
        );
      }

      const unitCost =
        decimalToNumber(locked.avgUnitCost) ??
        decimalToNumber(locked.lastUnitCost) ??
        0;
      if (unitCost < 0) {
        throw new Error(translate(locale, "pages.inventory.unitCostMissing"));
      }

      const signedQty = -quantity;
      const totalCost = movementTotalCost(quantity, unitCost);

      await tx.inventoryMovement.create({
        data: {
          companyId: company.id,
          itemId: item.id,
          projectId: project.id,
          type: "ISSUE_TO_PROJECT",
          quantity: toDecimal(signedQty),
          unitCost: toDecimal(unitCost),
          totalCost: toDecimal(totalCost),
          movedAt,
          notes: notes || null,
          createdById: session.user.id,
        },
      });

      const stockUpdate = await tx.inventoryItem.updateMany({
        where: {
          id: item.id,
          currentStock: { gte: toDecimal(quantity) },
        },
        data: {
          currentStock: toDecimal(currentStock - quantity),
        },
      });
      if (stockUpdate.count !== 1) {
        throw new Error(
          translate(locale, "pages.inventory.insufficientStock", {
            available: String(currentStock),
            unit: locked.unit,
          })
        );
      }
    });

    revalidateInventory(project.id);
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.createIssueFailed")
    );
  }
}

/** Manual stock adjustments are disabled; stock changes via purchases, issues, write-offs, etc. */
export async function createInventoryAdjustment(_formData: FormData) {
  const locale = await getServerLocale();
  throw new Error(translate(locale, "pages.inventory.manualAdjustDisabled"));
}

/**
 * Stock write-off — OM+, Director, or HO admin only.
 * Permanently reduces on-hand stock with a mandatory reason.
 * Cannot write off more than on-hand; uses row-lock for safety.
 * Records: actor (createdById), timestamp (movedAt), item, qty, reason (notes).
 */
export async function writeOffInventoryStock(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanAssignInventory(locale);
    const company = await requireCompany(locale);

    const itemId = String(formData.get("itemId") ?? "").trim();
    const reason = capitalizeProper(
      String(formData.get("reason") ?? "").trim()
    );

    if (!itemId) {
      throw new Error(translate(locale, "pages.inventory.itemRequired"));
    }
    if (!reason) {
      throw new Error(translate(locale, "pages.inventory.writeOffReasonRequired"));
    }

    const quantity = parsePositiveQty(
      formData.get("quantity"),
      translate(locale, "pages.inventory.form.quantity")
    );
    const movedAt =
      parseFormDateInput(formData.get("movedAt"), {
        fieldLabel: translate(locale, "pages.inventory.form.writeOffDate"),
      }) ?? new Date();

    const item = await prisma.inventoryItem.findFirst({
      where: { id: itemId, companyId: company.id, active: true },
      select: { id: true, unit: true },
    });
    if (!item) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }

    await prisma.$transaction(async (tx) => {
      const locked = await lockInventoryItemRow(tx, item.id);
      if (!locked || !locked.active) {
        throw new Error(translate(locale, "pages.inventory.itemNotFound"));
      }

      const currentStock = decimalToNumber(locked.currentStock) ?? 0;
      if (currentStock <= 0 || quantity > currentStock + 1e-9) {
        throw new Error(
          translate(locale, "pages.inventory.insufficientStock", {
            available: String(currentStock),
            unit: locked.unit,
          })
        );
      }

      try {
        await retireEquipmentAssets(tx, company.id, item.id, quantity, reason);
      } catch (error) {
        if (error instanceof InsufficientEquipmentAssetsError) {
          throw new Error(
            translate(locale, "pages.inventory.insufficientEquipmentAssets", {
              available: String(error.available),
              requested: String(error.requested),
            })
          );
        }
        throw error;
      }

      const unitCost =
        decimalToNumber(locked.avgUnitCost) ??
        decimalToNumber(locked.lastUnitCost) ??
        0;
      const totalCost = movementTotalCost(quantity, Math.max(0, unitCost));

      await tx.inventoryMovement.create({
        data: {
          companyId: company.id,
          itemId: item.id,
          type: "WRITE_OFF",
          quantity: toDecimal(-quantity),
          unitCost: toDecimal(Math.max(0, unitCost)),
          totalCost: toDecimal(totalCost),
          movedAt,
          notes: reason,
          createdById: session.user.id,
        },
      });

      const stockUpdate = await tx.inventoryItem.updateMany({
        where: {
          id: item.id,
          currentStock: { gte: toDecimal(quantity) },
        },
        data: {
          currentStock: toDecimal(currentStock - quantity),
        },
      });
      if (stockUpdate.count !== 1) {
        throw new Error(
          translate(locale, "pages.inventory.insufficientStock", {
            available: String(currentStock),
            unit: locked.unit,
          })
        );
      }
    });

    revalidateInventory();
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.createWriteOffFailed")
    );
  }
}

/**
 * Void a project inventory issue from the project detail page only.
 * Soft-voids the ISSUE_TO_PROJECT row and restores on-hand stock (no reverse ADJUSTMENT).
 * OM+ / Director / HO admin.
 */
export async function voidProjectInventoryIssue(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanAssignInventory(locale);
    const company = await requireCompany(locale);

    const id = String(formData.get("id") ?? "").trim();
    const projectId = String(formData.get("projectId") ?? "").trim();
    const voidReason = capitalizeProper(
      String(formData.get("voidReason") ?? "").trim()
    );
    if (!id) {
      throw new Error(translate(locale, "pages.inventory.movementNotFound"));
    }
    if (!projectId) {
      throw new Error(translate(locale, "pages.inventory.projectRequired"));
    }
    if (!voidReason) {
      throw new Error(translate(locale, "pages.inventory.voidReasonRequired"));
    }

    const movement = await prisma.inventoryMovement.findFirst({
      where: {
        id,
        companyId: company.id,
        projectId,
        type: "ISSUE_TO_PROJECT",
        voidedAt: null,
      },
      select: {
        id: true,
        itemId: true,
        projectId: true,
        quantity: true,
      },
    });
    if (!movement || !movement.projectId) {
      throw new Error(translate(locale, "pages.inventory.movementNotFound"));
    }

    const restoreQty = Math.abs(new Prisma.Decimal(movement.quantity).toNumber());

    await prisma.$transaction(async (tx) => {
      const locked = await lockInventoryItemRow(tx, movement.itemId);
      if (!locked) {
        throw new Error(translate(locale, "pages.inventory.itemNotFound"));
      }

      const currentStock = decimalToNumber(locked.currentStock) ?? 0;
      const newStock = currentStock + restoreQty;

      const voided = await tx.inventoryMovement.updateMany({
        where: { id: movement.id, voidedAt: null },
        data: {
          voidedAt: new Date(),
          voidReason,
        },
      });
      if (voided.count !== 1) {
        throw new Error(translate(locale, "pages.inventory.movementNotFound"));
      }

      await tx.inventoryItem.update({
        where: { id: movement.itemId },
        data: { currentStock: toDecimal(newStock) },
      });
    });

    revalidateInventory(movement.projectId);
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.voidFailed")
    );
  }
}

/**
 * Soft-void a non-issue movement (purchase / adjustment) and reverse stock.
 * Project issues must use {@link voidProjectInventoryIssue} from the project page.
 */
export async function voidInventoryMovement(formData: FormData) {
  const locale = await getServerLocale();
  try {
    await assertCanManageInventory(locale);
    const company = await requireCompany(locale);

    const id = String(formData.get("id") ?? "").trim();
    const voidReason = capitalizeProper(
      String(formData.get("voidReason") ?? "").trim()
    );
    if (!id) {
      throw new Error(translate(locale, "pages.inventory.movementNotFound"));
    }
    if (!voidReason) {
      throw new Error(translate(locale, "pages.inventory.voidReasonRequired"));
    }

    const movement = await prisma.inventoryMovement.findFirst({
      where: { id, companyId: company.id, voidedAt: null },
      select: {
        id: true,
        type: true,
        itemId: true,
        projectId: true,
        quantity: true,
        unitCost: true,
      },
    });
    if (!movement) {
      throw new Error(translate(locale, "pages.inventory.movementNotFound"));
    }
    if (movement.type === "ISSUE_TO_PROJECT") {
      throw new Error(
        translate(locale, "pages.inventory.voidIssueFromProjectOnly")
      );
    }

    const qty = new Prisma.Decimal(movement.quantity).toNumber();
    const reverseQty = -qty;

    await prisma.$transaction(async (tx) => {
      const locked = await lockInventoryItemRow(tx, movement.itemId);
      if (!locked) {
        throw new Error(translate(locale, "pages.inventory.itemNotFound"));
      }

      const currentStock = decimalToNumber(locked.currentStock) ?? 0;
      const newStock = currentStock + reverseQty;
      if (newStock < -1e-9) {
        throw new Error(
          translate(locale, "pages.inventory.voidWouldGoNegative")
        );
      }

      const voided = await tx.inventoryMovement.updateMany({
        where: { id: movement.id, voidedAt: null },
        data: {
          voidedAt: new Date(),
          voidReason,
        },
      });
      if (voided.count !== 1) {
        throw new Error(translate(locale, "pages.inventory.movementNotFound"));
      }

      // Soft-void only — restore/reduce cached stock without a reverse ADJUSTMENT row.
      await tx.inventoryItem.update({
        where: { id: movement.itemId },
        data: { currentStock: toDecimal(Math.max(0, newStock)) },
      });
    });

    revalidateInventory(movement.projectId);
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.voidFailed")
    );
  }
}
