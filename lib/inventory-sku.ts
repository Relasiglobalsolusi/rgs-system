import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DbClient =
  | Prisma.TransactionClient
  | {
      inventoryItem: Prisma.InventoryItemDelegate;
    };

/**
 * SKU scheme (company-scoped, per item-type prefix):
 *   {TYPE_CODE}-{####}   e.g. CONS-0001, TOOL-0001, CHEM-0002
 *
 * Preset Item Types use fixed codes in INVENTORY_ITEM_TYPE_CODES.
 * Custom types get a short uppercase slug from the label (letters/digits, max 6),
 * e.g. "Cleaning Pads" → CLNPAD, "Floor Wax" → FLOORW.
 * Sequence is per company + prefix; inactive items keep their SKUs; gaps are reused.
 */
export const INVENTORY_SKU_PAD = 4;
export const INVENTORY_SKU_SEPARATOR = "-";

/** Suggested Item Type presets (labels; stored as Title Case strings). */
export const INVENTORY_ITEM_TYPE_PRESETS = [
  "Consumable",
  "Equipment",
  "Chemical",
  "Material",
  "Tool",
  "Other",
] as const;

export type InventoryItemTypePreset =
  (typeof INVENTORY_ITEM_TYPE_PRESETS)[number];

/** Fixed type codes for presets (shown in SKUs). */
export const INVENTORY_ITEM_TYPE_CODES: Record<
  InventoryItemTypePreset,
  string
> = {
  Consumable: "CONS",
  Equipment: "EQUIP",
  Chemical: "CHEM",
  Material: "MAT",
  Tool: "TOOL",
  Other: "OTH",
};

const PRESET_BY_LOWER = new Map(
  INVENTORY_ITEM_TYPE_PRESETS.map((label) => [label.toLowerCase(), label])
);

/** Normalize a free-form Item Type label to a SKU prefix code. */
export function inventoryTypeCodeFromLabel(itemType: string): string {
  const trimmed = itemType.trim();
  if (!trimmed) return "OTH";

  const preset = PRESET_BY_LOWER.get(trimmed.toLowerCase());
  if (preset) {
    return INVENTORY_ITEM_TYPE_CODES[preset];
  }

  // Custom type → uppercase alphanumerics only, max 6 (e.g. "Cleaning" → CLEANI).
  const slug = trimmed
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 6);
  return slug || "OTH";
}

export function formatInventorySku(typeCode: string, sequence: number): string {
  const code = typeCode.trim().toUpperCase() || "OTH";
  return `${code}${INVENTORY_SKU_SEPARATOR}${String(sequence).padStart(
    INVENTORY_SKU_PAD,
    "0"
  )}`;
}

function parseSkuSequence(sku: string, typeCode: string): number | null {
  const code = typeCode.trim().toUpperCase();
  const match = sku
    .trim()
    .toUpperCase()
    .match(
      new RegExp(
        `^${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${INVENTORY_SKU_SEPARATOR}(\\d+)$`
      )
    );
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

function findLowestAvailableSequence(usedSequences: number[]): number {
  const used = new Set(usedSequences);
  let sequence = 1;
  while (used.has(sequence)) {
    sequence += 1;
  }
  return sequence;
}

/**
 * Next company-scoped SKU for the given Item Type (TYPE-0001…).
 * Soft-deleted / inactive items keep their SKUs so references stay stable.
 */
export async function getNextInventorySku(
  companyId: string,
  itemType: string,
  db: DbClient = prisma
): Promise<string> {
  const typeCode = inventoryTypeCodeFromLabel(itemType);
  const prefix = `${typeCode}${INVENTORY_SKU_SEPARATOR}`;

  const items = await db.inventoryItem.findMany({
    where: {
      companyId,
      sku: { startsWith: prefix },
    },
    select: { sku: true },
  });

  const usedSequences = items
    .map((item) => parseSkuSequence(item.sku, typeCode))
    .filter((sequence): sequence is number => sequence !== null);

  return formatInventorySku(
    typeCode,
    findLowestAvailableSequence(usedSequences)
  );
}

/**
 * Allocate N sequential SKUs for the same type inside one import pass.
 * Pass `reservedSkus` to avoid collisions with SKUs already claimed in-memory.
 */
export async function allocateInventorySkus(
  companyId: string,
  itemType: string,
  count: number,
  db: DbClient = prisma,
  reservedSkus?: Set<string>
): Promise<string[]> {
  if (count <= 0) return [];

  const typeCode = inventoryTypeCodeFromLabel(itemType);
  const prefix = `${typeCode}${INVENTORY_SKU_SEPARATOR}`;

  const items = await db.inventoryItem.findMany({
    where: {
      companyId,
      sku: { startsWith: prefix },
    },
    select: { sku: true },
  });

  const used = new Set(
    items
      .map((item) => parseSkuSequence(item.sku, typeCode))
      .filter((sequence): sequence is number => sequence !== null)
  );

  if (reservedSkus) {
    for (const sku of reservedSkus) {
      const seq = parseSkuSequence(sku, typeCode);
      if (seq != null) used.add(seq);
    }
  }

  const allocated: string[] = [];
  let sequence = 1;
  while (allocated.length < count) {
    while (used.has(sequence)) sequence += 1;
    const sku = formatInventorySku(typeCode, sequence);
    used.add(sequence);
    allocated.push(sku);
    if (reservedSkus) reservedSkus.add(sku);
    sequence += 1;
  }
  return allocated;
}
