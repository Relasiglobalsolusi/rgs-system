import {
  applyLocalizedHeaders,
  dataSheetName,
  INVENTORY_HEADER_LABELS,
  inventoryTemplateHeaderNote,
  inventoryTemplateTitle,
} from "@/lib/bulk-import/template-i18n";
import {
  buildProfessionalImportTemplate,
  type ColumnDef,
} from "@/lib/bulk-import/xlsx";
import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { INVENTORY_ITEM_TYPE_PRESETS } from "@/lib/inventory-sku";

/**
 * Inventory catalog import columns only (no purchase fields).
 * Item Type | Item Name | Description — SKU is system-generated on confirm.
 */
const BASE_INVENTORY_IMPORT_COLUMNS: ColumnDef[] = [
  {
    key: "itemType",
    header: INVENTORY_HEADER_LABELS.itemType!.en,
    required: true,
    width: 16,
    centerContent: true,
    dropdownValues: [...INVENTORY_ITEM_TYPE_PRESETS],
  },
  {
    key: "name",
    header: INVENTORY_HEADER_LABELS.name!.en,
    required: true,
    width: 28,
    centerContent: true,
  },
  {
    key: "description",
    header: INVENTORY_HEADER_LABELS.description!.en,
    width: 36,
    centerContent: true,
  },
];

/** Parser columns — English headers + bilingual aliases. */
export const INVENTORY_IMPORT_COLUMNS: ColumnDef[] = applyLocalizedHeaders(
  BASE_INVENTORY_IMPORT_COLUMNS,
  DEFAULT_LOCALE,
  INVENTORY_HEADER_LABELS
);

function getInventoryImportColumns(locale: AppLocale): ColumnDef[] {
  return applyLocalizedHeaders(
    BASE_INVENTORY_IMPORT_COLUMNS,
    locale,
    INVENTORY_HEADER_LABELS
  ).map((column) => {
    if (column.key === "itemType") {
      return {
        ...column,
        dropdownValues: [...INVENTORY_ITEM_TYPE_PRESETS],
      };
    }
    return column;
  });
}

export async function buildInventoryImportTemplate(
  locale: AppLocale = DEFAULT_LOCALE
): Promise<Buffer> {
  return buildProfessionalImportTemplate({
    columns: getInventoryImportColumns(locale),
    title: inventoryTemplateTitle(locale),
    sheetName: dataSheetName(),
    includeInstructionsSheet: false,
    headerNote: inventoryTemplateHeaderNote(locale),
  });
}
