import type { SpreadsheetRow } from "@/lib/bulk-import/xlsx";
import { isNotApplicableImportValue } from "@/lib/bulk-import/template-i18n";
import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import {
  INVENTORY_ITEM_TYPE_PRESETS,
  type InventoryItemTypePreset,
} from "@/lib/inventory-sku";
import { capitalizeProper, titleCaseWords } from "@/lib/text-case";

export type ParsedInventoryImportRow = {
  itemType: string;
  name: string;
  description: string | null;
};

function importCellValue(raw: string | undefined): string {
  const value = raw?.trim() ?? "";
  if (!value || isNotApplicableImportValue(value)) {
    return "";
  }
  return value;
}

function normalizeItemType(raw: string, locale: AppLocale): string {
  const value = importCellValue(raw);
  if (!value) {
    throw new Error(translate(locale, "pages.inventory.itemTypeRequired"));
  }

  const preset = INVENTORY_ITEM_TYPE_PRESETS.find(
    (label) => label.toLowerCase() === value.toLowerCase()
  );
  if (preset) return preset;

  // Allow custom types (still Title Cased); SKU prefix is derived from the label.
  return titleCaseWords(value) as InventoryItemTypePreset | string;
}

export function parseInventoryImportRow(
  values: SpreadsheetRow,
  locale: AppLocale = DEFAULT_LOCALE
): ParsedInventoryImportRow {
  const itemType = normalizeItemType(values.itemType ?? "", locale);
  const name = titleCaseWords(importCellValue(values.name));
  if (!name) {
    throw new Error(translate(locale, "pages.inventory.itemNameRequired"));
  }

  const descriptionRaw = importCellValue(values.description);
  const description = descriptionRaw
    ? capitalizeProper(descriptionRaw)
    : null;

  return { itemType, name, description };
}
