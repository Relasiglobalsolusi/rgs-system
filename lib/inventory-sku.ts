import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | {
  inventoryItem: Prisma.InventoryItemDelegate;
};

const SKU_PREFIX = "INV";
const SKU_PAD = 3;

function parseSkuSequence(sku: string): number | null {
  const match = sku
    .trim()
    .toUpperCase()
    .match(new RegExp(`^${SKU_PREFIX}(\\d+)$`));
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

export function formatInventorySku(sequence: number): string {
  return `${SKU_PREFIX}${String(sequence).padStart(SKU_PAD, "0")}`;
}

/**
 * Next company-scoped SKU (INV001, INV002, …). Soft-deleted items keep
 * their SKUs; gaps are reused only if freed.
 */
export async function getNextInventorySku(
  companyId: string,
  db: DbClient = prisma
): Promise<string> {
  const items = await db.inventoryItem.findMany({
    where: {
      companyId,
      sku: { startsWith: SKU_PREFIX },
    },
    select: { sku: true },
  });

  const usedSequences = items
    .map((item) => parseSkuSequence(item.sku))
    .filter((sequence): sequence is number => sequence !== null);

  return formatInventorySku(findLowestAvailableSequence(usedSequences));
}

/** Suggested Item Type presets (labels; stored as plain strings). */
export const INVENTORY_ITEM_TYPE_PRESETS = [
  "Consumable",
  "Equipment",
  "Chemical",
  "Material",
  "Tool",
  "Other",
] as const;
