import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DbClient =
  | Prisma.TransactionClient
  | {
      inventoryItem: Prisma.InventoryItemDelegate;
    };

/**
 * SKU scheme (company-scoped, per item-type prefix):
 *   {TYPE_CODE}-{###}   e.g. CNS-001, EQP-001, CHM-002
 *
 * Preset Item Types use fixed codes in INVENTORY_ITEM_TYPE_CODES.
 * Custom types get a short uppercase slug from the label (letters/digits, max 6),
 * e.g. "Cleaning Pads" → CLNPAD, "Floor Wax" → FLOORW.
 * Sequence is per company + prefix; inactive items keep their SKUs; gaps are reused.
 *
 * Legacy aliases (pre-migration): CHEM→CHM, CONS→CNS, and 4-digit padding (0001).
 * Allocation still counts sequences under legacy prefixes so new SKUs do not collide.
 */
export const INVENTORY_SKU_PAD = 3;
export const INVENTORY_SKU_SEPARATOR = "-";

/** Suggested Item Type presets (labels; stored as Title Case strings). */
export const INVENTORY_ITEM_TYPE_PRESETS = [
  "Consumable",
  "Equipment",
  "Chemical",
  "Other",
] as const;

export type InventoryItemTypePreset =
  (typeof INVENTORY_ITEM_TYPE_PRESETS)[number];

/** Fixed type codes for presets (shown in SKUs). */
export const INVENTORY_ITEM_TYPE_CODES: Record<
  InventoryItemTypePreset,
  string
> = {
  Consumable: "CNS",
  Equipment: "EQP",
  Chemical: "CHM",
  Other: "OTH",
};

/**
 * Former type codes that may still exist in DB until migrated.
 * Key = current code, value = legacy codes that map to the same type.
 */
export const INVENTORY_SKU_LEGACY_ALIASES: Record<string, readonly string[]> = {
  CHM: ["CHEM"],
  CNS: ["CONS"],
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

/** Map a stored type code (including legacy CHEM/CONS) to the current code. */
export function normalizeInventoryTypeCode(typeCode: string): string {
  const code = typeCode.trim().toUpperCase();
  if (!code) return "OTH";
  for (const [current, legacy] of Object.entries(INVENTORY_SKU_LEGACY_ALIASES)) {
    if (code === current || legacy.includes(code)) return current;
  }
  return code;
}

export function formatInventorySku(typeCode: string, sequence: number): string {
  const code = normalizeInventoryTypeCode(typeCode);
  return `${code}${INVENTORY_SKU_SEPARATOR}${String(sequence).padStart(
    INVENTORY_SKU_PAD,
    "0"
  )}`;
}

/**
 * Parse `{CODE}-{digits}` SKUs. Accepts any digit width (legacy 4-digit and current 3-digit).
 */
export function parseInventorySku(
  sku: string
): { typeCode: string; sequence: number } | null {
  const match = sku
    .trim()
    .toUpperCase()
    .match(/^([A-Z0-9]+)-(\d+)$/);
  if (!match) return null;
  const sequence = Number.parseInt(match[2], 10);
  if (!Number.isFinite(sequence) || sequence < 1) return null;
  return {
    typeCode: normalizeInventoryTypeCode(match[1]),
    sequence,
  };
}

function parseSkuSequence(sku: string, typeCode: string): number | null {
  const code = typeCode.trim().toUpperCase();
  const aliases = new Set<string>([
    code,
    ...(INVENTORY_SKU_LEGACY_ALIASES[code] ?? []),
  ]);
  // Also accept when caller passes a legacy code.
  for (const [current, legacy] of Object.entries(INVENTORY_SKU_LEGACY_ALIASES)) {
    if (legacy.includes(code)) {
      aliases.add(current);
      for (const a of legacy) aliases.add(a);
    }
  }

  const upper = sku.trim().toUpperCase();
  for (const alias of aliases) {
    const match = upper.match(
      new RegExp(
        `^${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${INVENTORY_SKU_SEPARATOR}(\\d+)$`
      )
    );
    if (match) {
      const sequence = Number.parseInt(match[1], 10);
      if (Number.isFinite(sequence) && sequence >= 1) return sequence;
    }
  }
  return null;
}

function findLowestAvailableSequence(usedSequences: number[]): number {
  const used = new Set(usedSequences);
  let sequence = 1;
  while (used.has(sequence)) {
    sequence += 1;
  }
  return sequence;
}

function typeCodePrefixes(typeCode: string): string[] {
  const code = normalizeInventoryTypeCode(typeCode);
  const codes = [code, ...(INVENTORY_SKU_LEGACY_ALIASES[code] ?? [])];
  return codes.map((c) => `${c}${INVENTORY_SKU_SEPARATOR}`);
}

/**
 * Canonical SKU for an existing row: current type code + 3-digit pad.
 * Returns null when the SKU is already canonical or cannot be parsed.
 *
 * - CHEM-0001 → CHM-001, CONS-0002 → CNS-002, EQP-0001 → EQP-001
 * - Custom prefixes only re-pad (TOOL-0003 → TOOL-003)
 * - When `itemType` is a preset and the SKU uses that preset/legacy code, sync to the preset code
 */
export function canonicalizeInventorySku(
  sku: string,
  itemType?: string
): string | null {
  const trimmed = sku.trim();
  const parsed = parseInventorySku(trimmed);
  if (!parsed) return null;

  const rawPrefix =
    trimmed.toUpperCase().split(INVENTORY_SKU_SEPARATOR)[0] ?? "";
  let typeCode = parsed.typeCode;

  if (itemType?.trim()) {
    const fromLabel = inventoryTypeCodeFromLabel(itemType);
    const presetCodes = new Set<string>(Object.values(INVENTORY_ITEM_TYPE_CODES));
    const legacyForLabel = INVENTORY_SKU_LEGACY_ALIASES[fromLabel] ?? [];
    if (
      presetCodes.has(fromLabel) &&
      (rawPrefix === fromLabel ||
        legacyForLabel.includes(rawPrefix) ||
        normalizeInventoryTypeCode(rawPrefix) === fromLabel)
    ) {
      typeCode = fromLabel;
    }
  }

  const next = formatInventorySku(typeCode, parsed.sequence);
  return next === trimmed || next === trimmed.toUpperCase() ? null : next;
}

/**
 * Next company-scoped SKU for the given Item Type (TYPE-001…).
 * Soft-deleted / inactive items keep their SKUs so references stay stable.
 * Counts legacy prefixes (CHEM/CONS) and any digit width when allocating.
 */
export async function getNextInventorySku(
  companyId: string,
  itemType: string,
  db: DbClient = prisma
): Promise<string> {
  const typeCode = inventoryTypeCodeFromLabel(itemType);
  const prefixes = typeCodePrefixes(typeCode);

  const items = await db.inventoryItem.findMany({
    where: {
      companyId,
      OR: prefixes.map((prefix) => ({ sku: { startsWith: prefix } })),
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
  const prefixes = typeCodePrefixes(typeCode);

  const items = await db.inventoryItem.findMany({
    where: {
      companyId,
      OR: prefixes.map((prefix) => ({ sku: { startsWith: prefix } })),
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
