"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import {
  formatInventoryQty,
  inventoryQtyFromDecimal,
  isWholeInventoryQty,
  movementTotalCost,
  nextWeightedAvgUnitCost,
  normalizeInventoryQty,
  toDecimal,
} from "@/lib/inventory";
import {
  canAssignInventoryToProject,
  lockInventoryItemRow,
} from "@/lib/inventory-access";
import { getNextInventorySku } from "@/lib/inventory-sku";
import {
  InsufficientEquipmentAssetsError,
  assertEquipmentInventoryInvariants,
  isEquipmentItemType,
  mintEquipmentAssets,
  releaseEquipmentAssetsForBulkIssue,
  restoreEquipmentAssetsForWriteOff,
  retireEquipmentAssets,
} from "@/lib/equipment-asset";
import { parseFormDateInput } from "@/lib/bulk-import/parse-import-date";
import type { AppLocale } from "@/lib/i18n/locale";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import {
  isValidNpwp,
  normalizeNpwp,
  npwpDigitCount,
  npwpInvalidMessage,
} from "@/lib/npwp";
import { nextCompanyScopedSortOrder } from "@/lib/persist-reorder";
import { prisma } from "@/lib/prisma";
import { toActionError } from "@/lib/prisma-errors";
import { canManageInventory, canManageItemCatalog } from "@/lib/project-access";
import { decimalToNumber } from "@/lib/project-billing";
import { requireModule, toPermissionUser } from "@/lib/session";
import { capitalizeProper, titleCaseWords } from "@/lib/text-case";
import { formatUserDisplayLabel } from "@/lib/user-display";
import { saveUpload } from "@/lib/upload";
import {
  applyExclusiveVat,
  parsePpnRatePercent,
  ppnRateFromPercent,
} from "@/lib/vat";

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

function parseNonNegNumber(raw: FormDataEntryValue | null, fieldLabel: string) {
  const value = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldLabel} must be zero or greater.`);
  }
  return value;
}

function parsePositiveWholeQty(
  raw: FormDataEntryValue | null,
  locale: AppLocale,
  fieldKey: "pages.inventory.form.quantity" = "pages.inventory.form.quantity"
) {
  const value = Number(String(raw ?? "").replace(/,/g, "").trim());
  const fieldLabel = translate(locale, fieldKey);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      translate(locale, "pages.inventory.quantityMustBePositive", {
        field: fieldLabel,
      })
    );
  }
  if (!isWholeInventoryQty(value)) {
    throw new Error(
      translate(locale, "pages.inventory.quantityMustBeWhole", {
        field: fieldLabel,
      })
    );
  }
  return value;
}

function parseNonNegWholeQty(
  raw: FormDataEntryValue | null,
  locale: AppLocale,
  fieldKey: "pages.inventory.form.minStock" = "pages.inventory.form.minStock"
) {
  const value = Number(String(raw ?? "").replace(/,/g, "").trim());
  const fieldLabel = translate(locale, fieldKey);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      translate(locale, "pages.inventory.quantityMustBeNonNegative", {
        field: fieldLabel,
      })
    );
  }
  if (!isWholeInventoryQty(value)) {
    throw new Error(
      translate(locale, "pages.inventory.quantityMustBeWhole", {
        field: fieldLabel,
      })
    );
  }
  return value;
}

async function saveReceipt(
  formData: FormData,
  options?: { sku?: string | null; fieldName?: string; filePrefix?: string }
): Promise<string | null | undefined> {
  const fieldName = options?.fieldName ?? "receipt";
  const file = formData.get(fieldName);
  if (!(file instanceof File) || file.size === 0) {
    return undefined;
  }
  const code = options?.sku?.trim();
  const prefix = options?.filePrefix ?? "INV_RECEIPT";
  const fileBaseName = code ? `${prefix}_${code}` : prefix;
  return saveUpload(file, "uploads/inventory", { fileBaseName });
}

function revalidateInventory(projectId?: string | null) {
  revalidatePath("/inventory");
  revalidatePath("/item-catalog");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
}

/** Preview next auto SKU for an Item Type ({TYPE}-001…). */
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

    const name = String(formData.get("name") ?? "").trim();
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

    const name = String(formData.get("name") ?? "").trim();
    const submittedType = titleCaseWords(
      String(formData.get("itemType") ?? "").trim()
    );
    const description = capitalizeProper(
      String(formData.get("description") ?? "").trim()
    );
    const unitRaw = String(formData.get("unit") ?? "").trim();
    const unit = unitRaw ? unitRaw.toLowerCase() : "pcs";
    const minStock = parseNonNegWholeQty(
      formData.get("minStock"),
      locale
    );

    if (!name) {
      throw new Error(translate(locale, "pages.inventory.itemNameRequired"));
    }

    const company = await requireCompany(locale);
    const existing = await prisma.inventoryItem.findFirst({
      where: { id, companyId: company.id, deletedAt: null },
    });
    if (!existing) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }

    // Item type is locked after create (SKU prefix / equipment rules depend on it).
    if (
      submittedType &&
      submittedType.toLowerCase() !== existing.itemType.trim().toLowerCase()
    ) {
      throw new Error(translate(locale, "pages.inventory.itemTypeLocked"));
    }

    // SKU and itemType stay system-assigned from create time.
    await prisma.inventoryItem.update({
      where: { id },
      data: {
        name,
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
      where: { id, companyId: company.id, deletedAt: null },
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

/**
 * Delete catalog item: hard-delete only when unused (no purchases, movements, assets).
 * If history exists, soft-delete (`deletedAt` + inactive) so purchase/issue history remains.
 */
export async function deleteInventoryItem(formData: FormData) {
  const locale = await getServerLocale();
  try {
    await assertCanManageItemCatalog(locale);
    const id = String(formData.get("id") ?? "").trim();
    const company = await requireCompany(locale);
    const item = await prisma.inventoryItem.findFirst({
      where: { id, companyId: company.id, deletedAt: null },
      select: { id: true },
    });
    if (!item) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }

    const [purchaseCount, movementCount, assetCount, invoiceLineCount] =
      await Promise.all([
        prisma.inventoryPurchase.count({ where: { itemId: id } }),
        prisma.inventoryMovement.count({ where: { itemId: id } }),
        prisma.equipmentAsset.count({ where: { itemId: id } }),
        prisma.purchaseInvoiceLine.count({ where: { itemId: id } }),
      ]);

    const hasHistory =
      purchaseCount + movementCount + assetCount + invoiceLineCount > 0;

    if (hasHistory) {
      await prisma.inventoryItem.update({
        where: { id },
        data: { active: false, deletedAt: new Date() },
      });
    } else {
      await prisma.inventoryItem.delete({ where: { id } });
    }

    revalidateInventory();
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.deleteItemFailed")
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
      where: { id, companyId: company.id, deletedAt: null },
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

const PURCHASE_SEARCH_LIMIT = 200;

function mapPurchaseRow(row: {
  id: string;
  purchasedAt: Date;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
  invoiceNo: string | null;
  receiptUrl: string | null;
  notes: string | null;
  item: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    itemType: string;
  };
  vendor: { id: string; name: string; shortCode: string };
}) {
  return {
    id: row.id,
    purchasedAt: row.purchasedAt.toISOString(),
    quantity: Math.abs(inventoryQtyFromDecimal(row.quantity)),
    unitPrice: decimalToNumber(row.unitPrice) ?? 0,
    totalPrice: decimalToNumber(row.totalPrice) ?? 0,
    invoiceNo: row.invoiceNo,
    receiptUrl: row.receiptUrl,
    notes: row.notes,
    item: row.item,
    vendor: row.vendor,
  };
}

/**
 * Server-side purchase search beyond the recent page window.
 * Matches item name/SKU, vendor, invoice, and notes.
 */
export async function searchInventoryPurchases(query: string) {
  const locale = await getServerLocale();
  try {
    await requireModule("inventory");
    const company = await requireCompany(locale);
    const q = String(query ?? "").trim();
    if (!q) return [];

    const rows = await prisma.inventoryPurchase.findMany({
      where: {
        companyId: company.id,
        OR: [
          { invoiceNo: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
          { item: { name: { contains: q, mode: "insensitive" } } },
          { item: { sku: { contains: q, mode: "insensitive" } } },
          { vendor: { name: { contains: q, mode: "insensitive" } } },
          { vendor: { shortCode: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: {
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            itemType: true,
          },
        },
        vendor: { select: { id: true, name: true, shortCode: true } },
      },
      orderBy: { purchasedAt: "desc" },
      take: PURCHASE_SEARCH_LIMIT,
    });

    return rows
      .filter((row) => row.item?.id != null && row.vendor?.id != null)
      .map(mapPurchaseRow);
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.searchPurchasesFailed")
    );
  }
}

export type InventoryStockItemDetail = {
  item: {
    id: string;
    sku: string;
    name: string;
    itemType: string;
    unit: string;
    minStock: number;
    currentStock: number;
    avgUnitCost: number | null;
    lastUnitCost: number | null;
    active: boolean;
  };
  /** Lifetime non-voided PURCHASE quantity. */
  totalBought: number;
  /** Lifetime non-voided ISSUE_TO_PROJECT quantity (absolute). */
  totalAssigned: number;
  /** Lifetime non-voided WRITE_OFF quantity (absolute). */
  totalWrittenOff: number;
  /** Lifetime non-voided SOLD_OFF quantity (absolute). */
  totalSold: number;
  /** Per-project lifetime assigned qty (bulk, not individual movements). */
  projectAssignments: Array<{
    projectId: string;
    projectName: string;
    clientName: string | null;
    quantity: number;
  }>;
};

/** Stock item detail: lifetime bought / assigned / on-hand + project bulk totals. */
export async function getInventoryStockItemDetail(itemId: string) {
  const locale = await getServerLocale();
  try {
    await requireModule("inventory");
    const company = await requireCompany(locale);
    const id = String(itemId ?? "").trim();
    if (!id) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }

    const item = await prisma.inventoryItem.findFirst({
      where: { id, companyId: company.id, deletedAt: null },
      select: {
        id: true,
        sku: true,
        name: true,
        itemType: true,
        unit: true,
        minStock: true,
        currentStock: true,
        avgUnitCost: true,
        lastUnitCost: true,
        active: true,
      },
    });
    if (!item) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }

    const movementBase = {
      companyId: company.id,
      itemId: id,
      voidedAt: null as null,
    };

    const [purchaseAgg, issueAgg, writeOffAgg, soldAgg, issueGroups] =
      await Promise.all([
        prisma.inventoryMovement.aggregate({
          where: { ...movementBase, type: "PURCHASE" },
          _sum: { quantity: true },
        }),
        prisma.inventoryMovement.aggregate({
          where: { ...movementBase, type: "ISSUE_TO_PROJECT" },
          _sum: { quantity: true },
        }),
        prisma.inventoryMovement.aggregate({
          where: { ...movementBase, type: "WRITE_OFF" },
          _sum: { quantity: true },
        }),
        prisma.inventoryMovement.aggregate({
          where: { ...movementBase, type: "SOLD_OFF" },
          _sum: { quantity: true },
        }),
        prisma.inventoryMovement.groupBy({
          by: ["projectId"],
          where: {
            ...movementBase,
            type: "ISSUE_TO_PROJECT",
            projectId: { not: null },
          },
          _sum: { quantity: true },
        }),
      ]);

    const projectIds = issueGroups
      .map((group) => group.projectId)
      .filter((projectId): projectId is string => Boolean(projectId));

    const projects =
      projectIds.length > 0
        ? await prisma.project.findMany({
            where: { id: { in: projectIds }, companyId: company.id },
            select: {
              id: true,
              name: true,
              client: { select: { name: true } },
            },
          })
        : [];
    const projectById = new Map(projects.map((project) => [project.id, project]));

    const projectAssignments = issueGroups
      .map((group) => {
        if (!group.projectId) return null;
        const quantity = Math.abs(
          inventoryQtyFromDecimal(group._sum.quantity)
        );
        if (quantity <= 0) return null;
        const project = projectById.get(group.projectId);
        return {
          projectId: group.projectId,
          projectName: project?.name?.trim() || "—",
          clientName: project?.client?.name?.trim() || null,
          quantity,
        };
      })
      .filter(
        (
          row
        ): row is {
          projectId: string;
          projectName: string;
          clientName: string | null;
          quantity: number;
        } => row != null
      )
      .sort(
        (a, b) =>
          b.quantity - a.quantity ||
          a.projectName.localeCompare(b.projectName, undefined, {
            sensitivity: "base",
          })
      );

    const detail: InventoryStockItemDetail = {
      item: {
        id: item.id,
        sku: item.sku,
        name: item.name,
        itemType: item.itemType,
        unit: item.unit,
        minStock: inventoryQtyFromDecimal(item.minStock),
        currentStock: inventoryQtyFromDecimal(item.currentStock),
        avgUnitCost: decimalToNumber(item.avgUnitCost),
        lastUnitCost: decimalToNumber(item.lastUnitCost),
        active: item.active,
      },
      totalBought: Math.abs(
        inventoryQtyFromDecimal(purchaseAgg._sum.quantity)
      ),
      totalAssigned: Math.abs(inventoryQtyFromDecimal(issueAgg._sum.quantity)),
      totalWrittenOff: Math.abs(
        inventoryQtyFromDecimal(writeOffAgg._sum.quantity)
      ),
      totalSold: Math.abs(inventoryQtyFromDecimal(soldAgg._sum.quantity)),
      projectAssignments,
    };

    return detail;
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.stockDetailLoadFailed")
    );
  }
}

/** Update serial/notes on an equipment asset from the Asset List panel. */
export async function updateEquipmentAssetDetails(formData: FormData) {
  const locale = await getServerLocale();
  try {
    await assertCanManageInventory(locale);
    const company = await requireCompany(locale);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      throw new Error(translate(locale, "pages.inventory.assetNotFound"));
    }

    const serialNo = String(formData.get("serialNo") ?? "").trim() || null;
    const notes =
      capitalizeProper(String(formData.get("notes") ?? "").trim()) || null;

    const asset = await prisma.equipmentAsset.findFirst({
      where: { id, companyId: company.id },
      select: { id: true },
    });
    if (!asset) {
      throw new Error(translate(locale, "pages.inventory.assetNotFound"));
    }

    await prisma.equipmentAsset.update({
      where: { id },
      data: { serialNo, notes },
    });

    revalidateInventory();
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.updateAssetFailed")
    );
  }
}

/**
 * Step 2 — record a purchase against an existing catalog item (dropdown).
 * Increases stock and updates last/avg unit cost.
 */
/**
 * Record a direct inventory purchase (ex-tax unit price).
 * Unit price updates avg/last cost and EquipmentAsset.unitCost as entered —
 * enter ex-tax amounts (no PPN). Tax-inclusive bills should use Finance →
 * Purchase Invoices, which strip PPN before stocking.
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

    const quantity = parsePositiveWholeQty(
      formData.get("quantity"),
      locale
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
      where: {
        id: itemId,
        companyId: company.id,
        active: true,
        deletedAt: null,
      },
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
      const currentStock = inventoryQtyFromDecimal(locked.currentStock);
      const avgUnitCost = decimalToNumber(locked.avgUnitCost);
      const newAvg = nextWeightedAvgUnitCost({
        currentStock,
        avgUnitCost,
        purchaseQty: quantity,
        purchaseUnitPrice: unitPrice,
      });
      const newStock = normalizeInventoryQty(currentStock + quantity);

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

      await mintEquipmentAssets(tx, company.id, item.id, quantity, {
        unitCost: unitPrice,
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
 * Reduces warehouse on-hand. Consumables/chemicals book totalCost to the project;
 * Equipment is custody/location only (zero unit/total cost, no project COGS).
 */
/**
 * Direct inventory → project issue is disabled.
 * Stock leaves the warehouse only via Material Request → Approvals → Transfer Order → receive.
 */
export async function createInventoryProjectIssue(_formData: FormData) {
  const locale = await getServerLocale();
  throw new Error(translate(locale, "pages.inventory.issueViaTransferOrderOnly"));
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

    const quantity = parsePositiveWholeQty(
      formData.get("quantity"),
      locale
    );
    const movedAt =
      parseFormDateInput(formData.get("movedAt"), {
        fieldLabel: translate(locale, "pages.inventory.form.writeOffDate"),
      }) ?? new Date();

    const item = await prisma.inventoryItem.findFirst({
      where: {
        id: itemId,
        companyId: company.id,
        active: true,
        deletedAt: null,
      },
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

      const currentStock = inventoryQtyFromDecimal(locked.currentStock);
      if (currentStock <= 0 || quantity > currentStock) {
        throw new Error(
          translate(locale, "pages.inventory.insufficientStock", {
            available: formatInventoryQty(currentStock),
            unit: locked.unit,
          })
        );
      }

      try {
        const unitCost =
          decimalToNumber(locked.avgUnitCost) ??
          decimalToNumber(locked.lastUnitCost) ??
          0;
        const totalCost = movementTotalCost(quantity, Math.max(0, unitCost));

        const movement = await tx.inventoryMovement.create({
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

        await retireEquipmentAssets(
          tx,
          company.id,
          item.id,
          quantity,
          reason,
          { writeOffMovementId: movement.id }
        );

        const stockUpdate = await tx.inventoryItem.updateMany({
          where: {
            id: item.id,
            currentStock: { gte: toDecimal(quantity) },
          },
          data: {
            currentStock: toDecimal(normalizeInventoryQty(currentStock - quantity)),
          },
        });
        if (stockUpdate.count !== 1) {
          throw new Error(
            translate(locale, "pages.inventory.insufficientStock", {
              available: formatInventoryQty(currentStock),
              unit: locked.unit,
            })
          );
        }
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
 * Reverse a stock write-off — OM+, Director, or HO admin only.
 * Soft-voids the WRITE_OFF row, restores on-hand stock, and reactivates linked equipment assets.
 */
export async function reverseInventoryWriteOff(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanAssignInventory(locale);
    const company = await requireCompany(locale);

    const id = String(formData.get("id") ?? "").trim();
    const reverseReasonRaw = String(formData.get("reverseReason") ?? "").trim();
    const reverseReason = reverseReasonRaw
      ? capitalizeProper(reverseReasonRaw)
      : "";

    if (!id) {
      throw new Error(translate(locale, "pages.inventory.movementNotFound"));
    }

    const movement = await prisma.inventoryMovement.findFirst({
      where: {
        id,
        companyId: company.id,
        type: "WRITE_OFF",
        voidedAt: null,
      },
      select: {
        id: true,
        itemId: true,
        quantity: true,
        notes: true,
        item: { select: { itemType: true, unit: true } },
      },
    });
    if (!movement) {
      throw new Error(translate(locale, "pages.inventory.writeOffAlreadyReversed"));
    }

    const restoreQty = Math.abs(inventoryQtyFromDecimal(movement.quantity));
    if (restoreQty <= 0) {
      throw new Error(translate(locale, "pages.inventory.movementNotFound"));
    }

    const actorLabel =
      formatUserDisplayLabel({
        name: session.user.name,
        username: session.user.username,
      }) ?? session.user.id;
    const voidReason = reverseReason
      ? `${reverseReason} (Reversed by ${actorLabel})`
      : `Reversed by ${actorLabel}`;

    await prisma.$transaction(async (tx) => {
      const locked = await lockInventoryItemRow(tx, movement.itemId);
      if (!locked) {
        throw new Error(translate(locale, "pages.inventory.itemNotFound"));
      }

      const currentStock = inventoryQtyFromDecimal(locked.currentStock);
      const newStock = normalizeInventoryQty(currentStock + restoreQty);

      const voided = await tx.inventoryMovement.updateMany({
        where: { id: movement.id, voidedAt: null, type: "WRITE_OFF" },
        data: {
          voidedAt: new Date(),
          voidReason,
        },
      });
      if (voided.count !== 1) {
        throw new Error(translate(locale, "pages.inventory.writeOffAlreadyReversed"));
      }

      await tx.inventoryItem.update({
        where: { id: movement.itemId },
        data: { currentStock: toDecimal(newStock) },
      });

      if (isEquipmentItemType(movement.item.itemType)) {
        await restoreEquipmentAssetsForWriteOff(
          tx,
          company.id,
          movement.id,
          movement.itemId,
          restoreQty,
          movement.notes
        );
      }
    });

    revalidateInventory();
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.reverseWriteOffFailed")
    );
  }
}

/**
 * Record a stock sold-off — OM+, Director, or HO admin (same gate as write-offs).
 * Requires buyer type, buyer name, tax document issued to the buyer (both types),
 * company NPWP when buyer is a company, exclusive PPN (ex-PPN unit price × rate),
 * and a sale invoice file.
 * Decrements on-hand stock, retires Equipment assets, and stores sale proceeds on InventorySale.
 * Movement unitCost/totalCost = inventory cost basis leaving stock (not sale price).
 * TODO(FR): aggregate InventorySale.totalPrice into financial-report money-in / income.
 */
export async function createInventorySoldOff(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanAssignInventory(locale);
    const company = await requireCompany(locale);

    const itemId = String(formData.get("itemId") ?? "").trim();
    const buyerTypeRaw = String(formData.get("buyerType") ?? "")
      .trim()
      .toUpperCase();
    const buyerType =
      buyerTypeRaw === "INDIVIDUAL" || buyerTypeRaw === "COMPANY"
        ? buyerTypeRaw
        : null;
    const buyer = capitalizeProper(String(formData.get("buyer") ?? "").trim());
    const buyerPicNameRaw = String(formData.get("buyerPicName") ?? "").trim();
    const buyerPhone = String(formData.get("buyerPhone") ?? "").trim();
    const buyerTaxIdRaw = String(formData.get("buyerTaxId") ?? "").trim();
    const buyerIdNumberRaw = String(formData.get("buyerIdNumber") ?? "").trim();
    const clientId = String(formData.get("clientId") ?? "").trim() || null;
    const notes =
      capitalizeProper(String(formData.get("notes") ?? "").trim()) || null;

    if (!itemId) {
      throw new Error(translate(locale, "pages.inventory.itemRequired"));
    }
    if (!buyerType) {
      throw new Error(translate(locale, "pages.inventory.buyerTypeRequired"));
    }
    if (!buyer) {
      throw new Error(
        translate(
          locale,
          buyerType === "COMPANY"
            ? "pages.inventory.companyNameRequired"
            : "pages.inventory.buyerNameRequired"
        )
      );
    }
    const buyerPicName =
      buyerType === "COMPANY"
        ? capitalizeProper(buyerPicNameRaw) || null
        : null;
    if (buyerType === "COMPANY" && !buyerPicName) {
      throw new Error(translate(locale, "pages.inventory.buyerPicNameRequired"));
    }
    if (!buyerPhone) {
      throw new Error(translate(locale, "pages.inventory.buyerPhoneRequired"));
    }

    let buyerTaxId: string | null = null;
    let buyerIdNumber: string | null = null;
    if (buyerType === "COMPANY") {
      if (!buyerTaxIdRaw) {
        throw new Error(translate(locale, "pages.inventory.buyerTaxIdRequired"));
      }
      if (!isValidNpwp(buyerTaxIdRaw)) {
        throw new Error(
          npwpInvalidMessage(locale, npwpDigitCount(buyerTaxIdRaw), "company")
        );
      }
      buyerTaxId = normalizeNpwp(buyerTaxIdRaw);
    } else {
      // INDIVIDUAL — at least one of Tax ID (NPWP) or National ID (KTP) is required.
      if (!buyerTaxIdRaw && !buyerIdNumberRaw) {
        throw new Error(translate(locale, "validation.npwpOrNikRequired"));
      }
      if (buyerTaxIdRaw) {
        if (!isValidNpwp(buyerTaxIdRaw)) {
          throw new Error(
            npwpInvalidMessage(locale, npwpDigitCount(buyerTaxIdRaw), "client")
          );
        }
        buyerTaxId = normalizeNpwp(buyerTaxIdRaw);
      }
      if (buyerIdNumberRaw) {
        if (!isValidNpwp(buyerIdNumberRaw)) {
          throw new Error(
            npwpInvalidMessage(locale, npwpDigitCount(buyerIdNumberRaw), "client")
          );
        }
        buyerIdNumber = normalizeNpwp(buyerIdNumberRaw);
      }
    }

    const taxRatePercent =
      parsePpnRatePercent(String(formData.get("taxRatePercent") ?? "")) ??
      null;
    if (taxRatePercent == null || taxRatePercent <= 0) {
      throw new Error(translate(locale, "pages.inventory.taxRateRequired"));
    }

    const quantity = parsePositiveWholeQty(
      formData.get("quantity"),
      locale
    );
    const unitPrice = parseNonNegNumber(
      formData.get("unitPrice"),
      translate(locale, "pages.inventory.form.saleUnitPrice")
    );
    const soldAt =
      parseFormDateInput(formData.get("soldAt"), {
        fieldLabel: translate(locale, "pages.inventory.form.saleDate"),
      }) ?? new Date();

    const assetIds = formData
      .getAll("assetIds")
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);

    const item = await prisma.inventoryItem.findFirst({
      where: {
        id: itemId,
        companyId: company.id,
        active: true,
        deletedAt: null,
      },
      select: { id: true, sku: true, unit: true, itemType: true },
    });
    if (!item) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }

    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, companyId: company.id, active: true },
        select: { id: true, clientType: true },
      });
      if (!client) {
        throw new Error(translate(locale, "pages.inventory.clientNotFound"));
      }
      if (client.clientType !== buyerType) {
        throw new Error(
          translate(locale, "pages.inventory.clientTypeMismatch")
        );
      }
    }

    if (assetIds.length > 0) {
      if (!isEquipmentItemType(item.itemType)) {
        throw new Error(translate(locale, "pages.inventory.itemNotFound"));
      }
      if (assetIds.length !== quantity) {
        throw new Error(
          translate(locale, "pages.inventory.soldOffAssetQtyMismatch")
        );
      }
    }

    // Tax invoice (Faktur Pajak) is only required — and only collected — for COMPANY buyers.
    // Individuals cannot legally be issued a company tax invoice.
    let buyerIdentityDocUrl: string | null = null;
    if (buyerType === "COMPANY") {
      buyerIdentityDocUrl =
        (await saveReceipt(formData, {
          sku: item.sku,
          fieldName: "buyerIdentityDoc",
          filePrefix: "SALE_TAX_INVOICE",
        })) ?? null;
      if (!buyerIdentityDocUrl) {
        throw new Error(
          translate(locale, "pages.inventory.buyerIdentityDocRequired")
        );
      }
    }

    const invoiceUrl = await saveReceipt(formData, {
      sku: item.sku,
      fieldName: "invoice",
      filePrefix: "SALE_INVOICE",
    });
    if (!invoiceUrl) {
      throw new Error(translate(locale, "pages.inventory.saleInvoiceRequired"));
    }

    const subtotal = quantity * unitPrice;
    const vat = applyExclusiveVat(
      subtotal,
      ppnRateFromPercent(taxRatePercent)
    );
    const taxAmount = vat.ppn;
    const totalSalePrice = vat.gross;
    if (taxAmount <= 0) {
      throw new Error(translate(locale, "pages.inventory.taxAmountRequired"));
    }

    const saleNoteParts = [`Buyer: ${buyer}`, notes].filter(Boolean);
    const movementNotes = saleNoteParts.join(" — ") || null;

    await prisma.$transaction(async (tx) => {
      const locked = await lockInventoryItemRow(tx, item.id);
      if (!locked || !locked.active) {
        throw new Error(translate(locale, "pages.inventory.itemNotFound"));
      }

      const currentStock = inventoryQtyFromDecimal(locked.currentStock);
      if (currentStock <= 0 || quantity > currentStock) {
        throw new Error(
          translate(locale, "pages.inventory.insufficientStock", {
            available: formatInventoryQty(currentStock),
            unit: locked.unit,
          })
        );
      }

      try {
        const catalogUnitCost =
          decimalToNumber(locked.avgUnitCost) ??
          decimalToNumber(locked.lastUnitCost) ??
          0;

        let unitCost = Math.max(0, catalogUnitCost);
        let totalCost = movementTotalCost(quantity, unitCost);

        if (isEquipmentItemType(item.itemType)) {
          const assetWhere =
            assetIds.length > 0
              ? {
                  id: { in: assetIds },
                  companyId: company.id,
                  itemId: item.id,
                  status: "AVAILABLE" as const,
                }
              : {
                  companyId: company.id,
                  itemId: item.id,
                  status: "AVAILABLE" as const,
                };
          const assets = await tx.equipmentAsset.findMany({
            where: assetWhere,
            select: { id: true, unitCost: true },
            orderBy: [{ createdAt: "asc" }, { assetCode: "asc" }],
            take: quantity,
          });
          if (assets.length === quantity) {
            totalCost = assets.reduce((sum, asset) => {
              const cost =
                decimalToNumber(asset.unitCost) ?? Math.max(0, catalogUnitCost);
              return sum + Math.max(0, cost);
            }, 0);
            unitCost = quantity > 0 ? totalCost / quantity : 0;
          }
        }

        const movement = await tx.inventoryMovement.create({
          data: {
            companyId: company.id,
            itemId: item.id,
            type: "SOLD_OFF",
            quantity: toDecimal(-quantity),
            unitCost: toDecimal(Math.max(0, unitCost)),
            totalCost: toDecimal(totalCost),
            movedAt: soldAt,
            notes: movementNotes,
            createdById: session.user.id,
          },
        });

        await tx.inventorySale.create({
          data: {
            companyId: company.id,
            itemId: item.id,
            soldAt,
            quantity: toDecimal(quantity),
            unitPrice: toDecimal(unitPrice),
            totalPrice: toDecimal(totalSalePrice),
            subtotal: toDecimal(vat.dpp),
            taxAmount: toDecimal(taxAmount),
            taxRatePercent: toDecimal(taxRatePercent),
            buyer,
            buyerType,
            buyerPicName,
            buyerPhone,
            buyerIdNumber,
            buyerTaxId,
            buyerRegistration: null,
            buyerIdentityDocUrl,
            invoiceUrl,
            clientId,
            notes,
            movementId: movement.id,
            createdById: session.user.id,
          },
        });

        await retireEquipmentAssets(
          tx,
          company.id,
          item.id,
          quantity,
          notes ?? buyer,
          {
            soldOffMovementId: movement.id,
            assetIds: assetIds.length > 0 ? assetIds : undefined,
            notePrefix: "Sold off",
          }
        );

        const stockUpdate = await tx.inventoryItem.updateMany({
          where: {
            id: item.id,
            currentStock: { gte: toDecimal(quantity) },
          },
          data: {
            currentStock: toDecimal(
              normalizeInventoryQty(currentStock - quantity)
            ),
          },
        });
        if (stockUpdate.count !== 1) {
          throw new Error(
            translate(locale, "pages.inventory.insufficientStock", {
              available: formatInventoryQty(currentStock),
              unit: locked.unit,
            })
          );
        }
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
    });

    revalidateInventory();
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.createSoldOffFailed")
    );
  }
}

const SOLD_OFF_SEARCH_LIMIT = 200;

const soldOffInclude = {
  item: {
    select: {
      id: true,
      sku: true,
      name: true,
      unit: true,
      itemType: true,
    },
  },
  client: {
    select: { id: true, name: true },
  },
  movement: {
    select: {
      totalCost: true,
      equipmentAssetsFromSoldOff: {
        select: { id: true, assetCode: true, serialNo: true },
        orderBy: { assetCode: "asc" as const },
      },
    },
  },
  createdBy: {
    select: { id: true, name: true, username: true },
  },
} as const;

function mapSoldOffRow(row: {
  id: string;
  soldAt: Date;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  taxRatePercent: Prisma.Decimal | null;
  buyer: string | null;
  buyerType: "INDIVIDUAL" | "COMPANY" | null;
  buyerPicName: string | null;
  buyerPhone: string | null;
  buyerIdNumber: string | null;
  buyerTaxId: string | null;
  buyerRegistration: string | null;
  buyerIdentityDocUrl: string | null;
  invoiceUrl: string | null;
  clientId: string | null;
  notes: string | null;
  item: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    itemType: string;
  } | null;
  client: { id: string; name: string } | null;
  movement: {
    totalCost: Prisma.Decimal;
    equipmentAssetsFromSoldOff: {
      id: string;
      assetCode: string;
      serialNo: string | null;
    }[];
  } | null;
  createdBy: {
    id: string;
    name: string | null;
    username: string | null;
  } | null;
}) {
  if (!row.item) return null;
  const subtotal = decimalToNumber(row.subtotal) ?? 0;
  const totalPrice = decimalToNumber(row.totalPrice) ?? 0;
  const taxAmount = decimalToNumber(row.taxAmount) ?? 0;
  const effectiveSubtotal =
    subtotal > 0 || taxAmount > 0 ? subtotal : totalPrice;
  const costBasis = decimalToNumber(row.movement?.totalCost) ?? 0;
  return {
    id: row.id,
    soldAt: row.soldAt.toISOString(),
    quantity: Math.abs(inventoryQtyFromDecimal(row.quantity)),
    unitPrice: decimalToNumber(row.unitPrice) ?? 0,
    totalPrice,
    subtotal: effectiveSubtotal,
    taxAmount,
    taxRatePercent: decimalToNumber(row.taxRatePercent),
    costBasis,
    gainLoss: effectiveSubtotal - costBasis,
    buyer: row.buyer,
    buyerType: row.buyerType,
    buyerPicName: row.buyerPicName,
    buyerPhone: row.buyerPhone,
    buyerIdNumber: row.buyerIdNumber,
    buyerTaxId: row.buyerTaxId,
    buyerRegistration: row.buyerRegistration,
    buyerIdentityDocUrl: row.buyerIdentityDocUrl,
    invoiceUrl: row.invoiceUrl,
    clientId: row.clientId,
    clientName: row.client?.name ?? null,
    notes: row.notes,
    createdBy: row.createdBy,
    assets: row.movement?.equipmentAssetsFromSoldOff ?? [],
    item: row.item,
  };
}

/** Search active clients for Sold Off buyer linking, filtered by buyer/client type. */
export async function searchInventorySaleClients(
  query: string,
  clientType?: "INDIVIDUAL" | "COMPANY" | null
) {
  const locale = await getServerLocale();
  try {
    await requireModule("inventory");
    const company = await requireCompany(locale);
    const q = String(query ?? "").trim();
    const typeFilter =
      clientType === "INDIVIDUAL" || clientType === "COMPANY"
        ? clientType
        : null;

    const rows = await prisma.client.findMany({
      where: {
        companyId: company.id,
        active: true,
        ...(typeFilter ? { clientType: typeFilter } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { shortCode: { contains: q, mode: "insensitive" } },
                { npwp: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        shortCode: true,
        clientType: true,
        npwp: true,
        phone: true,
        contactPersonFirstName: true,
        contactPersonLastName: true,
        contactPersonPhone: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 40,
    });

    return rows.map((row) => {
      const pic = [row.contactPersonFirstName, row.contactPersonLastName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(" ");
      return {
        id: row.id,
        name: row.name,
        shortCode: row.shortCode,
        clientType: row.clientType as "INDIVIDUAL" | "COMPANY",
        npwp: row.npwp,
        phone: row.phone,
        contactPersonName: pic || null,
        contactPersonPhone: row.contactPersonPhone,
      };
    });
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.searchClientsFailed")
    );
  }
}

/**
 * Server-side sold-off search beyond the recent page window.
 * Matches item name/SKU, buyer, tax ID, and notes.
 */
export async function searchInventorySoldOffs(query: string) {
  const locale = await getServerLocale();
  try {
    await requireModule("inventory");
    const company = await requireCompany(locale);
    const q = String(query ?? "").trim();
    if (!q) return [];

    const rows = await prisma.inventorySale.findMany({
      where: {
        companyId: company.id,
        movement: { voidedAt: null },
        OR: [
          { buyer: { contains: q, mode: "insensitive" } },
          { buyerPicName: { contains: q, mode: "insensitive" } },
          { buyerPhone: { contains: q, mode: "insensitive" } },
          { buyerIdNumber: { contains: q, mode: "insensitive" } },
          { buyerTaxId: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
          { item: { name: { contains: q, mode: "insensitive" } } },
          { item: { sku: { contains: q, mode: "insensitive" } } },
          { client: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: soldOffInclude,
      orderBy: { soldAt: "desc" },
      take: SOLD_OFF_SEARCH_LIMIT,
    });

    return rows
      .map(mapSoldOffRow)
      .filter((row): row is NonNullable<typeof row> => row != null);
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.searchSoldOffsFailed")
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
        item: { select: { itemType: true } },
      },
    });
    if (!movement || !movement.projectId) {
      throw new Error(translate(locale, "pages.inventory.movementNotFound"));
    }

    // ISSUE_TO_PROJECT quantities are stored negative — restore with abs
    // (same pattern as write-off reverse).
    const restoreQty = Math.abs(inventoryQtyFromDecimal(movement.quantity));
    if (restoreQty <= 0) {
      throw new Error(translate(locale, "pages.inventory.movementNotFound"));
    }

    await prisma.$transaction(async (tx) => {
      const locked = await lockInventoryItemRow(tx, movement.itemId);
      if (!locked) {
        throw new Error(translate(locale, "pages.inventory.itemNotFound"));
      }

      const currentStock = inventoryQtyFromDecimal(locked.currentStock);
      const newStock = normalizeInventoryQty(currentStock + restoreQty);

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

      if (isEquipmentItemType(movement.item.itemType)) {
        // Clears both picker (`movementId`) and bulk (`issueMovementId`) links.
        await releaseEquipmentAssetsForBulkIssue(
          tx,
          company.id,
          movement.id
        );
        // Align On Hand to AVAILABLE (handles issue-qty vs linked-asset drift).
        const available = await tx.equipmentAsset.count({
          where: { itemId: movement.itemId, status: "AVAILABLE" },
        });
        await tx.inventoryItem.update({
          where: { id: movement.itemId },
          data: { currentStock: toDecimal(available) },
        });
        await assertEquipmentInventoryInvariants(tx, company.id, {
          itemIds: [movement.itemId],
          projectId,
          movementIds: [movement.id],
        });
      }
    });

    revalidateInventory(projectId);
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
    if (movement.type === "WRITE_OFF") {
      throw new Error(
        translate(locale, "pages.inventory.voidWriteOffUseReverse")
      );
    }
    if (movement.type === "SOLD_OFF") {
      throw new Error(
        translate(locale, "pages.inventory.voidSoldOffNotSupported")
      );
    }

    const qty = new Prisma.Decimal(movement.quantity).toNumber();
    const reverseQty = -qty;

    await prisma.$transaction(async (tx) => {
      const locked = await lockInventoryItemRow(tx, movement.itemId);
      if (!locked) {
        throw new Error(translate(locale, "pages.inventory.itemNotFound"));
      }

      const currentStock = inventoryQtyFromDecimal(locked.currentStock);
      const newStock = normalizeInventoryQty(currentStock + reverseQty);
      if (newStock < 0) {
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
