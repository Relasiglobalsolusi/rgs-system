import type { AppLocale } from "@/lib/i18n/locale";
import type { ColumnDef } from "@/lib/bulk-import/xlsx";

type LocalizedHeader = {
  en: string;
  id: string;
  /** Extra aliases beyond the en/id headers (already normalized keys). */
  aliases?: string[];
};

export function dataSheetName(): string {
  /** Keep stable for import parsers (both locales). */
  return "Data";
}

function localizeColumnHeader(
  locale: AppLocale,
  labels: LocalizedHeader
): string {
  return locale === "id" ? labels.id : labels.en;
}

/** Merge bilingual headers into ColumnDef aliases so either template imports. */
function withBilingualAliases(
  column: ColumnDef,
  labels: LocalizedHeader
): ColumnDef {
  const bilingual = [labels.en, labels.id, ...(labels.aliases ?? [])];
  const existing = column.aliases ?? [];
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const value of [...existing, ...bilingual]) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    aliases.push(value);
  }
  return { ...column, aliases };
}

export function applyLocalizedHeaders(
  columns: ColumnDef[],
  locale: AppLocale,
  labelsByKey: Record<string, LocalizedHeader>
): ColumnDef[] {
  return columns.map((column) => {
    const labels = labelsByKey[column.key];
    if (!labels) return column;
    return withBilingualAliases(
      { ...column, header: localizeColumnHeader(locale, labels) },
      labels
    );
  });
}

export const INVENTORY_HEADER_LABELS: Record<string, LocalizedHeader> = {
  itemType: {
    en: "Item Type",
    id: "Jenis Item",
    aliases: [
      "item type",
      "type",
      "jenis",
      "jenis item",
      "category",
      "kategori",
    ],
  },
  name: {
    en: "Item Name",
    id: "Nama Item",
    aliases: ["item name", "name", "nama", "nama item", "item"],
  },
  description: {
    en: "Description",
    id: "Deskripsi",
    aliases: ["description", "deskripsi", "notes", "catatan"],
  },
};

export function inventoryTemplateTitle(locale: AppLocale): string {
  return locale === "id"
    ? "RGS ONE — Impor Item Inventaris"
    : "RGS ONE — Inventory Items Import";
}

export function inventoryTemplateHeaderNote(locale: AppLocale): string {
  return locale === "id"
    ? "Katalog saja (bukan pembelian). Satu item per baris dari baris 3. Kolom * wajib. SKU dibuat sistem dari Jenis Item saat Konfirmasi (mis. TOOL-001). Unggah di Katalog Barang → Impor Excel."
    : "Catalog only (not purchases). One item per row from row 3. Columns marked * are required. SKU is system-generated from Item Type on Confirm (e.g. TOOL-001). Upload in Goods Catalog → Import Excel.";
}

/** True when a cell means “no value / not applicable” for import parsers. */
export function isNotApplicableImportValue(raw: string): boolean {
  const value = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return (
    !value ||
    value === "n/a" ||
    value === "na" ||
    value === "not applicable" ||
    value === "tidak berlaku" ||
    value === "tidak ada" ||
    value === "none" ||
    value === "-"
  );
}
