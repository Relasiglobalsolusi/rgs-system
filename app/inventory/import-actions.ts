"use server";

import { revalidatePath } from "next/cache";

import { INVENTORY_IMPORT_COLUMNS } from "@/lib/bulk-import/inventory-template";
import {
  parseInventoryImportRow,
  type ParsedInventoryImportRow,
} from "@/lib/bulk-import/parse-inventory-row";
import {
  createBulkImportPreview,
  createBulkImportResult,
  recordImportCreated,
  recordImportFailed,
  recordImportSkipped,
  type BulkImportPreview,
  type BulkImportPreviewRow,
  type BulkImportResult,
} from "@/lib/bulk-import/types";
import {
  parseSpreadsheetRows,
  readSpreadsheetFile,
} from "@/lib/bulk-import/xlsx";
import { getNextInventorySku } from "@/lib/inventory-sku";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { nextCompanyScopedSortOrder } from "@/lib/persist-reorder";
import { prisma } from "@/lib/prisma";
import { canManageInventory } from "@/lib/project-access";
import { SORT_ORDER_STEP } from "@/lib/reorder";
import { requireModule, toPermissionUser } from "@/lib/session";

async function assertCanManageInventory() {
  const session = await requireModule("inventory");
  if (!canManageInventory(toPermissionUser(session))) {
    const locale = await getServerLocale();
    throw new Error(translate(locale, "pages.inventory.permissionDenied"));
  }
}

function previewFieldsFromValues(values: Record<string, string>) {
  return {
    "Item Type": values.itemType?.trim() || "—",
    "Item Name": values.name?.trim() || "—",
    Description: values.description?.trim() || "—",
  };
}

function previewFieldsFromParsed(parsed: ParsedInventoryImportRow) {
  return {
    "Item Type": parsed.itemType,
    "Item Name": parsed.name,
    Description: parsed.description ?? "—",
  };
}

async function loadInventoryImportContext(file: File) {
  const locale = await getServerLocale();
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    throw new Error(translate(locale, "pages.inventory.companyNotFound"));
  }

  const buffer = await readSpreadsheetFile(file);
  const { rows } = parseSpreadsheetRows(buffer, INVENTORY_IMPORT_COLUMNS);

  if (rows.length === 0) {
    throw new Error(translate(locale, "pages.inventory.import.noDataRows"));
  }

  const existingItems = await prisma.inventoryItem.findMany({
    where: { companyId: company.id },
    select: { name: true, itemType: true },
  });

  const seenKeys = new Set(
    existingItems.map(
      (item) =>
        `${item.itemType.trim().toLowerCase()}::${item.name.trim().toLowerCase()}`
    )
  );

  return { company, rows, seenKeys, locale };
}

export async function previewBulkImportInventoryItems(
  formData: FormData
): Promise<BulkImportPreview> {
  await assertCanManageInventory();

  const locale = await getServerLocale();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error(translate(locale, "bulkImport.chooseExcel"));
  }

  const { rows, seenKeys } = await loadInventoryImportContext(file);
  const previewKeys = new Set(seenKeys);
  const previewRows: BulkImportPreviewRow[] = [];

  for (const { rowNumber, values } of rows) {
    const fields = previewFieldsFromValues(values);

    try {
      const parsed = parseInventoryImportRow(values, locale);
      const key = `${parsed.itemType.toLowerCase()}::${parsed.name.toLowerCase()}`;

      if (previewKeys.has(key)) {
        previewRows.push({
          rowNumber,
          status: "duplicate",
          message: translate(locale, "pages.inventory.import.duplicateInFile", {
            name: parsed.name,
            itemType: parsed.itemType,
          }),
          fields: previewFieldsFromParsed(parsed),
        });
        continue;
      }

      previewKeys.add(key);
      previewRows.push({
        rowNumber,
        status: "ready",
        fields: previewFieldsFromParsed(parsed),
        message: translate(locale, "pages.inventory.import.skuAssignedOnSave"),
      });
    } catch (error) {
      previewRows.push({
        rowNumber,
        status: "invalid",
        message:
          error instanceof Error
            ? error.message
            : translate(locale, "pages.inventory.import.invalidRow"),
        fields,
      });
    }
  }

  return createBulkImportPreview(previewRows);
}

/**
 * Excel import is catalog create-only.
 * Duplicates (same Item Type + Item Name) are skipped. SKU is assigned per type on save.
 */
export async function confirmBulkImportInventoryItems(
  formData: FormData
): Promise<BulkImportResult> {
  await assertCanManageInventory();

  const locale = await getServerLocale();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error(translate(locale, "bulkImport.chooseExcel"));
  }

  const { company, rows, seenKeys } = await loadInventoryImportContext(file);
  const result = createBulkImportResult();
  let nextSortOrder = await nextCompanyScopedSortOrder(
    "inventoryItem",
    company.id
  );

  for (const { rowNumber, values } of rows) {
    try {
      const parsed = parseInventoryImportRow(values, locale);
      const key = `${parsed.itemType.toLowerCase()}::${parsed.name.toLowerCase()}`;

      if (seenKeys.has(key)) {
        recordImportSkipped(
          result,
          rowNumber,
          translate(locale, "pages.inventory.import.duplicateSkipped", {
            name: parsed.name,
            itemType: parsed.itemType,
          })
        );
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const sku = await getNextInventorySku(
          company.id,
          parsed.itemType,
          tx
        );
        await tx.inventoryItem.create({
          data: {
            companyId: company.id,
            sku,
            name: parsed.name,
            itemType: parsed.itemType,
            description: parsed.description,
            sortOrder: nextSortOrder,
            active: true,
          },
        });
      });

      seenKeys.add(key);
      nextSortOrder += SORT_ORDER_STEP;
      recordImportCreated(result);
    } catch (error) {
      recordImportFailed(
        result,
        rowNumber,
        error instanceof Error
          ? error.message
          : translate(locale, "pages.inventory.import.invalidRow")
      );
    }
  }

  revalidatePath("/inventory");
  return result;
}
