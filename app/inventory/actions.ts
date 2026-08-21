"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import {
  formatInventoryQty,
  inventoryQtyFromDecimal,
  isWholeInventoryQty,
  movementTotalCost,
  normalizeInventoryQty,
  toDecimal,
} from "@/lib/inventory";
import {
  canAssignInventoryToProject,
  lockInventoryItemRow,
} from "@/lib/inventory-access";
import {
  allocateInventorySkus,
  getNextInventorySku,
  isVehicleItemType,
} from "@/lib/inventory-sku";
import { normalizeVehiclePlate } from "@/lib/vehicle-plate";
import {
  defaultUnitForItemType,
  normalizeInventoryUnit,
} from "@/lib/inventory-units";
import {
  InsufficientEquipmentAssetsError,
  assertEquipmentInventoryInvariants,
  countEquipmentAssetsByStatus,
  isEquipmentItemType,
  mintVehicleAssetByPlate,
  releaseEquipmentAssetsForBulkIssue,
  restoreEquipmentAssetsForSoldOff,
  restoreEquipmentAssetsForWriteOff,
  retireEquipmentAssets,
  retireEquipmentAssetsForSale,
  uncodedWarehouseQty,
} from "@/lib/equipment-asset";
import { parseFormDateInput } from "@/lib/bulk-import/parse-import-date";
import {
  getCompanyBankAccount,
  overlayCompanyBankForPdf,
  type CompanyBankAccountRow,
} from "@/lib/company-bank-accounts";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import {
  generateInventorySaleInvoicePdf,
  saleInvoiceNumber,
} from "@/lib/sale-invoice-pdf";
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
import {
  bulkLineValue,
  MAX_BULK_CREATE_LINES,
  parseBulkLineCount,
} from "@/lib/bulk-create";
import { SORT_ORDER_STEP } from "@/lib/reorder";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toActionError } from "@/lib/prisma-errors";
import { canManageInventory, canManageItemCatalog } from "@/lib/project-access";
import { writeRecordChange } from "@/lib/record-change";
import { decimalToNumber } from "@/lib/project-billing";
import { requireModule, requireSession, toPermissionUser } from "@/lib/session";
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

/** View or search stock sales — Finance → Sales, or inventory (legacy reads). */
async function assertCanAccessSales(locale: AppLocale) {
  const session = await requireSession();
  const user = toPermissionUser(session);
  if (canAccess(user, "sales") || canAccess(user, "inventory")) {
    return session;
  }
  throw new Error(translate(locale, "pages.sales.permissionDenied"));
}

/** Record or reverse a stock sale — Finance → Sales only. */
async function assertCanRecordSale(locale: AppLocale) {
  const session = await requireSession();
  if (!canAccess(toPermissionUser(session), "sales")) {
    throw new Error(translate(locale, "pages.sales.permissionDenied"));
  }
  return session;
}

/** Reverse a stock sale — Finance → Sales. */
async function assertCanReverseSale(locale: AppLocale) {
  return assertCanRecordSale(locale);
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

function revalidateInventory(projectId?: string | null, itemId?: string | null) {
  revalidatePath("/inventory");
  revalidatePath("/item-catalog");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
  if (itemId) {
    revalidatePath(`/inventory/equipment/${itemId}`);
  }
}

function revalidateSales() {
  revalidateInventory();
  revalidatePath("/billing/sales");
  revalidatePath("/billing/financial-report");
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

/** Preview the next N auto SKUs for an Item Type (one per bulk line). */
export async function previewInventorySkus(itemType: string, count: number) {
  const locale = await getServerLocale();
  await assertCanManageItemCatalog(locale);
  const company = await requireCompany(locale);
  const trimmed = String(itemType ?? "").trim();
  const n = Number(count);
  if (!trimmed || !Number.isInteger(n) || n < 1) return [];
  return allocateInventorySkus(
    company.id,
    trimmed,
    Math.min(n, MAX_BULK_CREATE_LINES)
  );
}

/**
 * Step 1 — catalog only.
 * Fields: item type, name, system SKU (from type), unit, min stock, description.
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
    const minStock = parseNonNegWholeQty(formData.get("minStock"), locale);

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
    const unit = normalizeInventoryUnit(
      String(formData.get("unit") ?? "").trim() ||
        defaultUnitForItemType(itemType)
    );

    const plate = isVehicleItemType(itemType)
      ? normalizeVehiclePlate(String(formData.get("vehiclePlate") ?? ""))
      : "";

    await prisma.$transaction(async (tx) => {
      const sku = await getNextInventorySku(company.id, itemType, tx);
      const item = await tx.inventoryItem.create({
        data: {
          companyId: company.id,
          sku,
          name,
          itemType,
          description: description || null,
          unit,
          minStock: toDecimal(isVehicleItemType(itemType) ? 0 : minStock),
          sortOrder,
          active: true,
          tracksStock: !isVehicleItemType(itemType),
        },
      });
      if (plate) {
        await mintVehicleAssetByPlate(tx, company.id, item.id, plate);
      }
    });

    revalidateInventory();
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.createItemFailed")
    );
  }
}

export async function createInventoryItemsInBulk(formData: FormData) {
  const locale = await getServerLocale();
  try {
    await assertCanManageItemCatalog(locale);

    const itemType = titleCaseWords(
      String(formData.get("itemType") ?? "").trim()
    );
    if (!itemType) {
      throw new Error(translate(locale, "pages.inventory.itemTypeRequired"));
    }

    const company = await requireCompany(locale);
    const lineCount = parseBulkLineCount(formData);
    const items: Array<{ name: string; description: string | null }> = [];
    const seenKeys = new Set<string>();

    const existingItems = await prisma.inventoryItem.findMany({
      where: { companyId: company.id },
      select: { name: true, itemType: true },
    });
    for (const item of existingItems) {
      seenKeys.add(
        `${item.itemType.trim().toLowerCase()}::${item.name.trim().toLowerCase()}`
      );
    }

    for (let index = 0; index < lineCount; index += 1) {
      const name = String(bulkLineValue(formData, index, "name")).trim();
      const description = capitalizeProper(
        bulkLineValue(formData, index, "description")
      );
      if (!name && !description) continue;
      if (!name) {
        throw new Error(
          translate(locale, "bulkCreate.lineError", {
            n: String(index + 1),
            message: translate(locale, "pages.inventory.itemNameRequired"),
          })
        );
      }
      const key = `${itemType.toLowerCase()}::${name.toLowerCase()}`;
      if (seenKeys.has(key)) {
        throw new Error(
          translate(locale, "bulkCreate.lineError", {
            n: String(index + 1),
            message: translate(locale, "pages.inventory.import.duplicateInFile", {
              name,
              itemType,
            }),
          })
        );
      }
      seenKeys.add(key);
      items.push({ name, description: description || null });
    }

    if (items.length === 0) {
      throw new Error(translate(locale, "bulkCreate.emptyLines"));
    }

    let sortOrder = await nextCompanyScopedSortOrder(
      "inventoryItem",
      company.id
    );

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const sku = await getNextInventorySku(company.id, itemType, tx);
        await tx.inventoryItem.create({
          data: {
            companyId: company.id,
            sku,
            name: item.name,
            itemType,
            description: item.description,
            sortOrder,
            active: true,
          },
        });
        sortOrder += SORT_ORDER_STEP;
      }
    });

    revalidateInventory();
    return items.length;
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
    const unit = normalizeInventoryUnit(unitRaw || existing.unit || "pcs");

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
        movement: { voidedAt: null },
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
  /** Lifetime sales: when it left stock and who bought it. Price lives on Finance → Sales. */
  sales: Array<{
    id: string;
    soldAt: string;
    buyer: string | null;
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

    const [purchaseAgg, issueAgg, writeOffAgg, soldAgg, issueGroups, saleRows] =
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
        prisma.inventorySale.findMany({
          where: {
            companyId: company.id,
            itemId: id,
            movement: { voidedAt: null },
          },
          select: {
            id: true,
            soldAt: true,
            buyer: true,
            quantity: true,
            client: { select: { name: true } },
          },
          orderBy: { soldAt: "desc" },
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
      sales: saleRows
        .map((row) => ({
          id: row.id,
          soldAt: row.soldAt.toISOString(),
          buyer: row.buyer?.trim() || row.client?.name?.trim() || null,
          quantity: Math.abs(inventoryQtyFromDecimal(row.quantity)),
        }))
        .filter((row) => row.quantity > 0),
    };

    return detail;
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.stockDetailLoadFailed")
    );
  }
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
      select: { id: true, unit: true, itemType: true },
    });
    if (!item) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
    }

    const writeOffSource = String(formData.get("writeOffSource") ?? "")
      .trim()
      .toLowerCase();
    const writeOffIssued =
      isEquipmentItemType(item.itemType) &&
      (writeOffSource === "issued" || assetIds.length > 0);

    if (writeOffIssued) {
      if (assetIds.length === 0) {
        throw new Error(translate(locale, "pages.inventory.writeOffAssetsRequired"));
      }
      if (assetIds.length !== quantity) {
        throw new Error(
          translate(locale, "pages.inventory.writeOffAssetQtyMismatch")
        );
      }
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

        if (writeOffIssued) {
          await retireEquipmentAssets(
            tx,
            company.id,
            item.id,
            quantity,
            reason,
            {
              writeOffMovementId: movement.id,
              assetIds,
            }
          );
        } else if (isEquipmentItemType(item.itemType)) {
          const counts = await countEquipmentAssetsByStatus(tx, item.id);
          const uncoded = uncodedWarehouseQty(currentStock, counts.available);
          if (quantity > uncoded) {
            throw new Error(
              translate(locale, "pages.inventory.factoryReturn.insufficientNew")
            );
          }
        } else {
          await retireEquipmentAssets(
            tx,
            company.id,
            item.id,
            quantity,
            reason,
            { writeOffMovementId: movement.id }
          );
        }

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

    revalidateInventory(null, item.id);
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
 * Reverse a stock sale — inventory module access.
 * Soft-voids the SOLD_OFF movement, restores on-hand stock, and reactivates linked equipment assets.
 * Sale income is then excluded from the financial report (voided movements are skipped).
 */
export async function reverseInventorySoldOff(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanReverseSale(locale);
    const company = await requireCompany(locale);

    const id = String(formData.get("id") ?? "").trim();
    const reverseReasonRaw = String(formData.get("reverseReason") ?? "").trim();
    const reverseReason = reverseReasonRaw
      ? capitalizeProper(reverseReasonRaw)
      : "";

    if (!id) {
      throw new Error(translate(locale, "pages.inventory.movementNotFound"));
    }

    const sale = await prisma.inventorySale.findFirst({
      where: {
        id,
        companyId: company.id,
        movement: { type: "SOLD_OFF", voidedAt: null },
      },
      select: {
        id: true,
        itemId: true,
        quantity: true,
        notes: true,
        buyer: true,
        movementId: true,
        item: { select: { itemType: true, unit: true } },
      },
    });
    if (!sale) {
      throw new Error(translate(locale, "pages.inventory.saleAlreadyReversed"));
    }

    const restoreQty = Math.abs(inventoryQtyFromDecimal(sale.quantity));
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
      const locked = await lockInventoryItemRow(tx, sale.itemId);
      if (!locked) {
        throw new Error(translate(locale, "pages.inventory.itemNotFound"));
      }

      const currentStock = inventoryQtyFromDecimal(locked.currentStock);

      const voided = await tx.inventoryMovement.updateMany({
        where: { id: sale.movementId, voidedAt: null, type: "SOLD_OFF" },
        data: {
          voidedAt: new Date(),
          voidReason,
        },
      });
      if (voided.count !== 1) {
        throw new Error(translate(locale, "pages.inventory.saleAlreadyReversed"));
      }

      if (isEquipmentItemType(sale.item.itemType)) {
        await restoreEquipmentAssetsForSoldOff(
          tx,
          company.id,
          sale.movementId,
          sale.itemId,
          restoreQty,
          sale.notes ?? sale.buyer
        );
        const available = await tx.equipmentAsset.count({
          where: { itemId: sale.itemId, status: "AVAILABLE" },
        });
        await tx.inventoryItem.update({
          where: { id: sale.itemId },
          data: { currentStock: toDecimal(available) },
        });
      } else {
        await tx.inventoryItem.update({
          where: { id: sale.itemId },
          data: {
            currentStock: toDecimal(
              normalizeInventoryQty(currentStock + restoreQty)
            ),
          },
        });
      }
    });

    await writeRecordChange({
      companyId: company.id,
      userId: session.user.id,
      action: "REVERSE",
      entity: "InventorySale",
      entityId: id,
      description: voidReason,
      oldValue: {
        quantity: inventoryQtyFromDecimal(sale.quantity),
        buyer: sale.buyer,
        notes: sale.notes,
      },
      newValue: { voided: true, voidReason },
    });

    revalidateSales();
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.inventory.reverseSaleFailed")
    );
  }
}

async function persistGeneratedSaleInvoice(options: {
  companyId: string;
  bankAccount: CompanyBankAccountRow | null;
  invoiceNumber: string;
  soldAt: Date;
  buyer: string;
  buyerType: "INDIVIDUAL" | "COMPANY" | null;
  buyerPicName: string | null;
  buyerPhone: string | null;
  buyerTaxId: string | null;
  buyerIdNumber: string | null;
  itemName: string;
  itemSku: string;
  itemUnit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  taxAmount: number;
  taxRatePercent: number | null;
  totalPrice: number;
  notes: string | null;
}): Promise<string> {
  const loaded =
    (await loadCompanyForPdf(options.companyId)) ?? { name: "" };
  const company = overlayCompanyBankForPdf(loaded, options.bankAccount);
  return generateInventorySaleInvoicePdf({
    invoiceNumber: options.invoiceNumber,
    soldAt: options.soldAt,
    buyerName: options.buyer,
    buyerType: options.buyerType,
    buyerPicName: options.buyerPicName,
    buyerPhone: options.buyerPhone,
    buyerTaxId: options.buyerTaxId,
    buyerIdNumber: options.buyerIdNumber,
    itemName: options.itemName,
    itemSku: options.itemSku,
    itemUnit: options.itemUnit,
    quantity: options.quantity,
    unitPrice: options.unitPrice,
    subtotal: options.subtotal,
    taxAmount: options.taxAmount,
    taxRatePercent: options.taxRatePercent,
    totalPrice: options.totalPrice,
    notes: options.notes,
    company,
  });
}

/**
 * Record a stock sale from Finance → Sales.
 * Generates the sale invoice PDF (stored on InventorySale.invoiceUrl), requires a
 * company bank account, exclusive PPN, and a tax invoice (faktur pajak) for COMPANY buyers.
 * Payment proof is optional at record time.
 * Decrements on-hand stock, retires Equipment assets, and stores sale proceeds on InventorySale.
 * Movement unitCost/totalCost = inventory cost basis leaving stock (not sale price).
 */
export async function createInventorySoldOff(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await assertCanRecordSale(locale);
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

    const rawBankAccountId = String(formData.get("bankAccountId") ?? "").trim();
    if (!rawBankAccountId) {
      throw new Error(translate(locale, "pages.sales.bankAccountRequired"));
    }
    const bankAccount = await getCompanyBankAccount(
      company.id,
      rawBankAccountId
    );
    if (!bankAccount) {
      throw new Error(translate(locale, "pages.sales.bankAccountRequired"));
    }
    const bankAccountId = bankAccount.id;

    const item = await prisma.inventoryItem.findFirst({
      where: {
        id: itemId,
        companyId: company.id,
        active: true,
        deletedAt: null,
      },
      select: { id: true, sku: true, name: true, unit: true, itemType: true },
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

    const saleSource = String(formData.get("saleSource") ?? "")
      .trim()
      .toLowerCase();
    const sellIssuedEquipment =
      isEquipmentItemType(item.itemType) &&
      (saleSource === "issued" || assetIds.length > 0);
    const sellNewEquipment =
      isEquipmentItemType(item.itemType) && !sellIssuedEquipment;

    if (sellIssuedEquipment) {
      if (assetIds.length !== quantity) {
        throw new Error(
          translate(locale, "pages.inventory.soldOffSelectAssetsRequired")
        );
      }
    } else if (assetIds.length > 0) {
      throw new Error(translate(locale, "pages.inventory.itemNotFound"));
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

    const paymentProofUrl =
      (await saveReceipt(formData, {
        sku: item.sku,
        fieldName: "paymentProof",
        filePrefix: "SALE_PAYMENT",
      })) ?? null;

    const paidAtInput = parseFormDateInput(formData.get("paidAt"), {
      fieldLabel: translate(locale, "pages.sales.form.paidAt"),
    });
    const paidAt = paymentProofUrl
      ? paidAtInput ?? soldAt
      : paidAtInput;

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
    const soldFromProjectIds: string[] = [];
    const invoiceNumber = saleInvoiceNumber(
      soldAt,
      item.sku,
      `${item.sku}-${Date.now().toString(36)}`
    );
    let invoiceUrl: string;
    try {
      invoiceUrl = await persistGeneratedSaleInvoice({
        companyId: company.id,
        bankAccount,
        invoiceNumber,
        soldAt,
        buyer,
        buyerType,
        buyerPicName,
        buyerPhone,
        buyerTaxId,
        buyerIdNumber,
        itemName: item.name,
        itemSku: item.sku,
        itemUnit: item.unit,
        quantity,
        unitPrice,
        subtotal: vat.dpp,
        taxAmount,
        taxRatePercent,
        totalPrice: totalSalePrice,
        notes,
      });
    } catch {
      throw new Error(translate(locale, "pages.sales.invoiceGenerateFailed"));
    }

    await prisma.$transaction(async (tx) => {
      const locked = await lockInventoryItemRow(tx, item.id);
      if (!locked || !locked.active) {
        throw new Error(translate(locale, "pages.inventory.itemNotFound"));
      }

      const currentStock = inventoryQtyFromDecimal(locked.currentStock);
      const isEquipmentSale = isEquipmentItemType(item.itemType);
      let warehouseQty = quantity;

      try {
        const catalogUnitCost =
          decimalToNumber(locked.avgUnitCost) ??
          decimalToNumber(locked.lastUnitCost) ??
          0;

        let unitCost = Math.max(0, catalogUnitCost);
        let totalCost = movementTotalCost(quantity, unitCost);

        if (sellIssuedEquipment) {
          const assets = await tx.equipmentAsset.findMany({
            where: {
              id: { in: assetIds },
              companyId: company.id,
              itemId: item.id,
              status: { in: ["AVAILABLE", "ON_PROJECT"] },
            },
            select: { id: true, status: true, unitCost: true },
          });
          if (assets.length !== quantity) {
            throw new Error(
              translate(locale, "pages.inventory.soldOffSelectAssetsRequired")
            );
          }
          warehouseQty = assets.filter(
            (asset) => asset.status === "AVAILABLE"
          ).length;
          totalCost = assets.reduce((sum, asset) => {
            const cost =
              decimalToNumber(asset.unitCost) ?? Math.max(0, catalogUnitCost);
            return sum + Math.max(0, cost);
          }, 0);
          unitCost = quantity > 0 ? totalCost / quantity : 0;
        } else if (sellNewEquipment) {
          const counts = await countEquipmentAssetsByStatus(tx, item.id);
          const uncoded = uncodedWarehouseQty(currentStock, counts.available);
          if (quantity > uncoded) {
            throw new Error(
              translate(locale, "pages.inventory.insufficientUncodedStock", {
                available: formatInventoryQty(uncoded),
                unit: locked.unit,
              })
            );
          }
          warehouseQty = quantity;
        }

        if (warehouseQty > currentStock) {
          throw new Error(
            translate(locale, "pages.inventory.insufficientStock", {
              available: formatInventoryQty(currentStock),
              unit: locked.unit,
            })
          );
        }
        if (!isEquipmentSale && (currentStock <= 0 || quantity > currentStock)) {
          throw new Error(
            translate(locale, "pages.inventory.insufficientStock", {
              available: formatInventoryQty(currentStock),
              unit: locked.unit,
            })
          );
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
            paymentProofUrl,
            paidAt,
            clientId,
            notes,
            bankAccountId,
            movementId: movement.id,
            createdById: session.user.id,
          },
        });

        if (sellIssuedEquipment) {
          const retired = await retireEquipmentAssetsForSale(
            tx,
            company.id,
            item.id,
            quantity,
            notes ?? buyer,
            {
              soldOffMovementId: movement.id,
              assetIds,
            }
          );
          warehouseQty = retired.warehouseQty;
          soldFromProjectIds.push(...retired.projectIds);
        }

        if (warehouseQty > 0) {
          const stockUpdate = await tx.inventoryItem.updateMany({
            where: {
              id: item.id,
              currentStock: { gte: toDecimal(warehouseQty) },
            },
            data: {
              currentStock: toDecimal(
                normalizeInventoryQty(currentStock - warehouseQty)
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

    revalidateSales();
    revalidatePath(`/inventory/equipment/${item.id}`);
    for (const projectId of [...new Set(soldFromProjectIds)]) {
      revalidatePath(`/projects/${projectId}`);
    }
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
  paymentProofUrl: string | null;
  paidAt: Date | null;
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
    paymentProofUrl: row.paymentProofUrl,
    paidAt: row.paidAt?.toISOString() ?? null,
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
    await assertCanAccessSales(locale);
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
    await assertCanAccessSales(locale);
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

/** List active stock sales for Finance → Sales (month window or all recent). */
export async function listInventorySales(options?: {
  start?: Date;
  endExclusive?: Date;
  take?: number;
}) {
  const locale = await getServerLocale();
  try {
    await assertCanAccessSales(locale);
    const company = await requireCompany(locale);
    const rows = await prisma.inventorySale.findMany({
      where: {
        companyId: company.id,
        movement: { voidedAt: null },
        ...(options?.start && options?.endExclusive
          ? { soldAt: { gte: options.start, lt: options.endExclusive } }
          : {}),
      },
      include: soldOffInclude,
      orderBy: { soldAt: "desc" },
      take: options?.take ?? 500,
    });
    return rows
      .map(mapSoldOffRow)
      .filter((row): row is NonNullable<typeof row> => row != null);
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.sales.loadFailed")
    );
  }
}

/**
 * Attach customer payment or tax invoice on an existing sale.
 * Sale invoices are generated (never uploaded). Missing invoices are generated here.
 */
export async function attachInventorySaleDocuments(formData: FormData) {
  const locale = await getServerLocale();
  try {
    await assertCanRecordSale(locale);
    const company = await requireCompany(locale);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      throw new Error(translate(locale, "pages.inventory.movementNotFound"));
    }

    const sale = await prisma.inventorySale.findFirst({
      where: {
        id,
        companyId: company.id,
        movement: { voidedAt: null },
      },
      select: {
        id: true,
        soldAt: true,
        quantity: true,
        unitPrice: true,
        totalPrice: true,
        subtotal: true,
        taxAmount: true,
        taxRatePercent: true,
        buyer: true,
        buyerType: true,
        buyerPicName: true,
        buyerPhone: true,
        buyerTaxId: true,
        buyerIdNumber: true,
        notes: true,
        invoiceUrl: true,
        paymentProofUrl: true,
        buyerIdentityDocUrl: true,
        paidAt: true,
        bankAccountId: true,
        item: { select: { sku: true, name: true, unit: true } },
      },
    });
    if (!sale) {
      throw new Error(translate(locale, "pages.inventory.saleAlreadyReversed"));
    }

    const sku = sale.item.sku;
    let nextInvoiceUrl = sale.invoiceUrl;
    if (!nextInvoiceUrl?.trim()) {
      const bankAccount = sale.bankAccountId
        ? await getCompanyBankAccount(company.id, sale.bankAccountId)
        : null;
      try {
        nextInvoiceUrl = await persistGeneratedSaleInvoice({
          companyId: company.id,
          bankAccount,
          invoiceNumber: saleInvoiceNumber(sale.soldAt, sku, sale.id),
          soldAt: sale.soldAt,
          buyer: sale.buyer ?? "",
          buyerType: sale.buyerType,
          buyerPicName: sale.buyerPicName,
          buyerPhone: sale.buyerPhone,
          buyerTaxId: sale.buyerTaxId,
          buyerIdNumber: sale.buyerIdNumber,
          itemName: sale.item.name,
          itemSku: sku,
          itemUnit: sale.item.unit,
          quantity: inventoryQtyFromDecimal(sale.quantity),
          unitPrice: decimalToNumber(sale.unitPrice) ?? 0,
          subtotal: decimalToNumber(sale.subtotal) ?? 0,
          taxAmount: decimalToNumber(sale.taxAmount) ?? 0,
          taxRatePercent: decimalToNumber(sale.taxRatePercent),
          totalPrice: decimalToNumber(sale.totalPrice) ?? 0,
          notes: sale.notes,
        });
      } catch {
        throw new Error(translate(locale, "pages.sales.invoiceGenerateFailed"));
      }
    }
    const nextPaymentProofUrl =
      (await saveReceipt(formData, {
        sku,
        fieldName: "paymentProof",
        filePrefix: "SALE_PAYMENT",
      })) ?? sale.paymentProofUrl;
    let nextTaxInvoiceUrl = sale.buyerIdentityDocUrl;
    if (sale.buyerType === "COMPANY") {
      nextTaxInvoiceUrl =
        (await saveReceipt(formData, {
          sku,
          fieldName: "buyerIdentityDoc",
          filePrefix: "SALE_TAX_INVOICE",
        })) ?? sale.buyerIdentityDocUrl;
    }

    const paidAtInput = parseFormDateInput(formData.get("paidAt"), {
      fieldLabel: translate(locale, "pages.sales.form.paidAt"),
    });
    const nextPaidAt =
      paidAtInput ??
      sale.paidAt ??
      (nextPaymentProofUrl && !sale.paymentProofUrl ? sale.soldAt : sale.paidAt);

    if (
      nextInvoiceUrl === sale.invoiceUrl &&
      nextPaymentProofUrl === sale.paymentProofUrl &&
      nextTaxInvoiceUrl === sale.buyerIdentityDocUrl &&
      nextPaidAt?.getTime() === sale.paidAt?.getTime()
    ) {
      throw new Error(translate(locale, "pages.sales.attachRequired"));
    }

    await prisma.inventorySale.update({
      where: { id: sale.id },
      data: {
        invoiceUrl: nextInvoiceUrl,
        paymentProofUrl: nextPaymentProofUrl,
        buyerIdentityDocUrl: nextTaxInvoiceUrl,
        paidAt: nextPaidAt,
      },
    });

    revalidateSales();
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.sales.attachFailed")
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
