"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import {
  INVENTORY_ISSUE_PROJECT_STATUSES,
  movementTotalCost,
  nextWeightedAvgUnitCost,
  toDecimal,
} from "@/lib/inventory";
import { getNextInventorySku } from "@/lib/inventory-sku";
import { parseFormDateInput } from "@/lib/bulk-import/parse-import-date";
import type { AppLocale } from "@/lib/i18n/locale";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { nextCompanyScopedSortOrder } from "@/lib/persist-reorder";
import { prisma } from "@/lib/prisma";
import { toActionError } from "@/lib/prisma-errors";
import { canManageInventory } from "@/lib/project-access";
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
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
}

/** Preview next auto SKU for an Item Type ({TYPE}-0001…). */
export async function previewInventorySku(itemType: string) {
  const locale = await getServerLocale();
  await assertCanManageInventory(locale);
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
    await assertCanManageInventory(locale);

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
    await assertCanManageInventory(locale);

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
    await assertCanManageInventory(locale);
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
    await assertCanManageInventory(locale);
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
    const currentStock = decimalToNumber(item.currentStock) ?? 0;
    const avgUnitCost = decimalToNumber(item.avgUnitCost);
    const newAvg = nextWeightedAvgUnitCost({
      currentStock,
      avgUnitCost,
      purchaseQty: quantity,
      purchaseUnitPrice: unitPrice,
    });
    const newStock = currentStock + quantity;
    const movedAt = purchasedAt;

    await prisma.$transaction(async (tx) => {
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
    const session = await assertCanManageInventory(locale);
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
    });
    if (!item) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }

    const currentStock = decimalToNumber(item.currentStock) ?? 0;
    if (quantity > currentStock + 1e-9) {
      throw new Error(
        translate(locale, "pages.inventory.insufficientStock", {
          available: String(currentStock),
          unit: item.unit,
        })
      );
    }

    const unitCost =
      decimalToNumber(item.avgUnitCost) ??
      decimalToNumber(item.lastUnitCost) ??
      0;
    if (unitCost < 0) {
      throw new Error(translate(locale, "pages.inventory.unitCostMissing"));
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

    const signedQty = -quantity;
    const totalCost = movementTotalCost(quantity, unitCost);

    await prisma.$transaction(async (tx) => {
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

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          currentStock: toDecimal(currentStock - quantity),
        },
      });
    });

    revalidateInventory(project.id);
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.createIssueFailed")
    );
  }
}

/** Stock adjustment with required audit note. */
export async function createInventoryAdjustment(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanManageInventory(locale);
    const company = await requireCompany(locale);

    const itemId = String(formData.get("itemId") ?? "").trim();
    const notes = capitalizeProper(
      String(formData.get("notes") ?? "").trim()
    );
    if (!itemId) {
      throw new Error(translate(locale, "pages.inventory.itemRequired"));
    }
    if (!notes) {
      throw new Error(translate(locale, "pages.inventory.adjustmentNoteRequired"));
    }

    const delta = Number(
      String(formData.get("quantityDelta") ?? "").replace(/,/g, "").trim()
    );
    if (!Number.isFinite(delta) || delta === 0) {
      throw new Error(translate(locale, "pages.inventory.adjustmentQtyRequired"));
    }

    const item = await prisma.inventoryItem.findFirst({
      where: { id: itemId, companyId: company.id },
    });
    if (!item) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }

    const currentStock = decimalToNumber(item.currentStock) ?? 0;
    const newStock = currentStock + delta;
    if (newStock < -1e-9) {
      throw new Error(
        translate(locale, "pages.inventory.insufficientStock", {
          available: String(currentStock),
          unit: item.unit,
        })
      );
    }

    const unitCost =
      decimalToNumber(item.avgUnitCost) ??
      decimalToNumber(item.lastUnitCost) ??
      0;
    const totalCost = movementTotalCost(delta, unitCost);
    const movedAt =
      parseFormDateInput(formData.get("movedAt"), {
        fieldLabel: translate(locale, "pages.inventory.form.adjustmentDate"),
      }) ?? new Date();

    await prisma.$transaction(async (tx) => {
      await tx.inventoryMovement.create({
        data: {
          companyId: company.id,
          itemId: item.id,
          type: "ADJUSTMENT",
          quantity: toDecimal(delta),
          unitCost: toDecimal(unitCost),
          totalCost: toDecimal(totalCost),
          movedAt,
          notes,
          createdById: session.user.id,
        },
      });

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentStock: toDecimal(Math.max(0, newStock)) },
      });
    });

    revalidateInventory();
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.adjustFailed")
    );
  }
}

/**
 * Soft-void a non-voided movement and reverse its stock/cost impact.
 * For ISSUE_TO_PROJECT, project inventory cost is reduced.
 */
export async function voidInventoryMovement(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanManageInventory(locale);
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
      include: { item: true },
    });
    if (!movement) {
      throw new Error(translate(locale, "pages.inventory.movementNotFound"));
    }

    const qty = new Prisma.Decimal(movement.quantity).toNumber();
    const reverseQty = -qty;
    const currentStock = decimalToNumber(movement.item.currentStock) ?? 0;
    const newStock = currentStock + reverseQty;
    if (newStock < -1e-9) {
      throw new Error(
        translate(locale, "pages.inventory.voidWouldGoNegative")
      );
    }

    const unitCost = decimalToNumber(movement.unitCost) ?? 0;
    const totalCost = movementTotalCost(reverseQty, unitCost);

    await prisma.$transaction(async (tx) => {
      await tx.inventoryMovement.update({
        where: { id: movement.id },
        data: {
          voidedAt: new Date(),
          voidReason,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          companyId: company.id,
          itemId: movement.itemId,
          projectId: movement.projectId,
          type: "ADJUSTMENT",
          quantity: toDecimal(reverseQty),
          unitCost: toDecimal(unitCost),
          totalCost: toDecimal(totalCost),
          movedAt: new Date(),
          notes: `Void of ${movement.type}: ${voidReason}`,
          createdById: session.user.id,
        },
      });

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
