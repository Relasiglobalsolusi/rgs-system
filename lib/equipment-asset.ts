import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";

const EQUIPMENT_ITEM_TYPE = "Equipment";

export function isEquipmentItemType(itemType: string): boolean {
  return itemType.trim().toLowerCase() === EQUIPMENT_ITEM_TYPE.toLowerCase();
}

/**
 * Asset code scheme (company-scoped, per catalog item):
 *   {ITEM_SKU}-A{####}
 *   e.g.  EQP-0001-A0001  (1st unit of catalog item EQP-0001)
 *         EQP-0001-A0002  (2nd unit)
 *         TOOL-0003-A0001 (1st unit of catalog item TOOL-0003)
 *
 * The prefix is always the catalog item's SKU, making the code
 * human-readable and directly traceable to its type without a lookup.
 * Sequence is padded to 4 digits and is per-item (not company-wide).
 * Gaps left by retired assets are NOT reused — sequence only grows.
 */
export const ASSET_CODE_SUFFIX_PAD = 4;
export const ASSET_CODE_SEPARATOR = "-A";

export function formatAssetCode(itemSku: string, sequence: number): string {
  return `${itemSku}${ASSET_CODE_SEPARATOR}${String(sequence).padStart(ASSET_CODE_SUFFIX_PAD, "0")}`;
}

// Use TransactionClient | PrismaClient as the broadest shared type
type DbClient = Prisma.TransactionClient | typeof prisma;

function parseAssetSequence(assetCode: string, itemSku: string): number | null {
  const prefix = `${itemSku}${ASSET_CODE_SEPARATOR}`;
  if (!assetCode.startsWith(prefix)) return null;
  const seq = parseInt(assetCode.slice(prefix.length), 10);
  return isNaN(seq) ? null : seq;
}

/**
 * Allocate N sequential asset codes for the same catalog item in one pass.
 * Sequence never recycles retired/deleted codes for immutable audit trails.
 */
export async function allocateAssetCodes(
  companyId: string,
  itemSku: string,
  count: number,
  db: DbClient = prisma
): Promise<string[]> {
  if (count <= 0) return [];

  const existing = await db.equipmentAsset.findMany({
    where: { companyId, assetCode: { startsWith: `${itemSku}${ASSET_CODE_SEPARATOR}` } },
    select: { assetCode: true },
  });

  const used = new Set(
    existing
      .map((r: { assetCode: string }) => parseAssetSequence(r.assetCode, itemSku))
      .filter((n: number | null): n is number => n !== null)
  );

  const allocated: string[] = [];
  let seq = 1;
  while (allocated.length < count) {
    while (used.has(seq)) seq++;
    allocated.push(formatAssetCode(itemSku, seq));
    used.add(seq);
    seq++;
  }
  return allocated;
}

/**
 * Mint N discrete EquipmentAsset rows when stock increases for an Equipment item.
 * Call inside the same transaction as the PURCHASE / receive movement.
 * Returns the number of assets created (whole units only).
 */
export async function mintEquipmentAssets(
  db: DbClient,
  companyId: string,
  itemId: string,
  qty: number
): Promise<number> {
  const wholeUnits = Math.floor(qty);
  if (wholeUnits <= 0) return 0;

  const item = await db.inventoryItem.findFirst({
    where: { id: itemId, companyId },
    select: { id: true, sku: true, itemType: true },
  });
  if (!item || !isEquipmentItemType(item.itemType)) return 0;

  const assetCodes = await allocateAssetCodes(companyId, item.sku, wholeUnits, db);
  await db.equipmentAsset.createMany({
    data: assetCodes.map((assetCode) => ({
      companyId,
      itemId: item.id,
      assetCode,
      status: "AVAILABLE" as const,
    })),
  });
  return wholeUnits;
}

/**
 * For each Equipment catalog item, mint AVAILABLE assets when physical units
 * are missing from the ledger (stock on hand + units on project).
 */
export async function backfillEquipmentAssets(
  db: DbClient = prisma,
  companyId?: string
): Promise<{ itemsProcessed: number; assetsMinted: number }> {
  const items = await db.inventoryItem.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      itemType: { equals: EQUIPMENT_ITEM_TYPE, mode: "insensitive" },
      active: true,
    },
    select: { id: true, companyId: true, currentStock: true },
  });

  let assetsMinted = 0;
  for (const item of items) {
    const stockOnHand = Math.floor(decimalToNumber(item.currentStock) ?? 0);
    const [totalAssets, onProject] = await Promise.all([
      db.equipmentAsset.count({ where: { itemId: item.id } }),
      db.equipmentAsset.count({
        where: { itemId: item.id, status: "ON_PROJECT" },
      }),
    ]);
    const expectedTotal = stockOnHand + onProject;
    const deficit = expectedTotal - totalAssets;
    if (deficit > 0) {
      assetsMinted += await mintEquipmentAssets(
        db,
        item.companyId,
        item.id,
        deficit
      );
    }
  }
  return { itemsProcessed: items.length, assetsMinted };
}

export class InsufficientEquipmentAssetsError extends Error {
  readonly code = "INSUFFICIENT_EQUIPMENT_ASSETS" as const;

  constructor(
    readonly available: number,
    readonly requested: number
  ) {
    super("INSUFFICIENT_EQUIPMENT_ASSETS");
    this.name = "InsufficientEquipmentAssetsError";
  }
}

/**
 * Retire N discrete AVAILABLE EquipmentAsset rows when stock decreases for an Equipment item.
 * Call inside the same transaction as the WRITE_OFF movement.
 * Oldest assets first (createdAt, then assetCode). Fails if not enough AVAILABLE assets.
 */
export async function retireEquipmentAssets(
  db: DbClient,
  companyId: string,
  itemId: string,
  qty: number,
  writeOffReason?: string
): Promise<number> {
  const wholeUnits = Math.floor(qty);
  if (wholeUnits <= 0) return 0;

  const item = await db.inventoryItem.findFirst({
    where: { id: itemId, companyId },
    select: { id: true, itemType: true },
  });
  if (!item || !isEquipmentItemType(item.itemType)) return 0;

  const availableCount = await db.equipmentAsset.count({
    where: { companyId, itemId, status: "AVAILABLE" },
  });
  if (wholeUnits > availableCount) {
    throw new InsufficientEquipmentAssetsError(availableCount, wholeUnits);
  }

  const assets = await db.equipmentAsset.findMany({
    where: { companyId, itemId, status: "AVAILABLE" },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }, { assetCode: "asc" }],
    take: wholeUnits,
  });
  if (assets.length < wholeUnits) {
    throw new InsufficientEquipmentAssetsError(availableCount, wholeUnits);
  }

  const note = writeOffReason?.trim()
    ? `Write-off: ${writeOffReason.trim()}`
    : undefined;

  await db.equipmentAsset.updateMany({
    where: { id: { in: assets.map((a) => a.id) } },
    data: {
      status: "RETIRED",
      ...(note ? { notes: note } : {}),
    },
  });

  return wholeUnits;
}

/** All AVAILABLE assets for an item, ordered by assetCode. */
export async function listAvailableAssetsForItem(
  companyId: string,
  itemId: string,
  db: DbClient = prisma
): Promise<{ id: string; assetCode: string; serialNo: string | null }[]> {
  return db.equipmentAsset.findMany({
    where: { companyId, itemId, status: "AVAILABLE" },
    select: { id: true, assetCode: true, serialNo: true },
    orderBy: { assetCode: "asc" },
  });
}

/** All ON_PROJECT assets for a project, with catalog item info. */
export async function listProjectEquipmentAssets(
  companyId: string,
  projectId: string,
  db: DbClient = prisma
): Promise<
  {
    id: string;
    assetCode: string;
    serialNo: string | null;
    movementId: string | null;
    item: { id: string; sku: string; name: string };
  }[]
> {
  return db.equipmentAsset.findMany({
    where: { companyId, projectId, status: "ON_PROJECT" },
    select: {
      id: true,
      assetCode: true,
      serialNo: true,
      movementId: true,
      item: { select: { id: true, sku: true, name: true } },
    },
    orderBy: [{ item: { name: "asc" } }, { assetCode: "asc" }],
  });
}
