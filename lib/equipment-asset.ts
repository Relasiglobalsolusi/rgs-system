import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  inventoryQtyFromDecimal,
  normalizeInventoryQty,
  toDecimal,
} from "@/lib/inventory";
import { decimalToNumber } from "@/lib/project-billing";

const EQUIPMENT_ITEM_TYPE = "Equipment";

/**
 * Legacy note from when surplus mint phantoms were soft-retired (RETIRED).
 * New reconcile hard-deletes those rows; this remains for UI + leftover purge.
 */
export const EQUIPMENT_SURPLUS_RETIRE_NOTE =
  "System cleanup: duplicate unit removed";

const LEGACY_SURPLUS_RETIRE_NOTES = [
  EQUIPMENT_SURPLUS_RETIRE_NOTE,
  "Reconcile: surplus mint from stock+onProject backfill",
] as const;

export function isEquipmentSurplusRetireNote(
  notes: string | null | undefined
): boolean {
  return (
    !!notes &&
    (LEGACY_SURPLUS_RETIRE_NOTES as readonly string[]).includes(notes)
  );
}

export function isEquipmentItemType(itemType: string): boolean {
  return itemType.trim().toLowerCase() === EQUIPMENT_ITEM_TYPE.toLowerCase();
}

/**
 * Asset code scheme (company-scoped, per catalog item):
 *   {ITEM_SKU}-A{n}
 *   e.g.  EQP-001-A1   (1st unit of catalog item EQP-001)
 *         EQP-001-A2   (2nd unit)
 *         EQP-001-A10  (10th unit)
 *         TOOL-003-A1  (1st unit of catalog item TOOL-003)
 *
 * The prefix is always the catalog item's SKU, making the code
 * human-readable and directly traceable to its type without a lookup.
 * Sequence is unpadded and per-item (not company-wide).
 * Gaps left by retired assets are NOT reused — sequence only grows.
 */
export const ASSET_CODE_SEPARATOR = "-A";

export function formatAssetCode(itemSku: string, sequence: number): string {
  return `${itemSku}${ASSET_CODE_SEPARATOR}${sequence}`;
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
 * Rewrite legacy zero-padded suffixes (…-A0001) to short form (…-A1).
 * Safe to re-run; skips codes that are already short or would collide.
 */
export async function shortenPaddedAssetCodes(
  db: DbClient = prisma,
  companyId?: string
): Promise<number> {
  const assets = await db.equipmentAsset.findMany({
    where: companyId ? { companyId } : undefined,
    select: {
      id: true,
      companyId: true,
      assetCode: true,
      item: { select: { sku: true } },
    },
  });

  let updated = 0;
  for (const asset of assets) {
    const sku = asset.item?.sku;
    if (!sku) continue;
    const prefix = `${sku}${ASSET_CODE_SEPARATOR}`;
    if (!asset.assetCode.startsWith(prefix)) continue;
    const suffix = asset.assetCode.slice(prefix.length);
    // Only rewrite zero-padded numeric suffixes (e.g. 0001 → 1).
    if (!/^0+\d+$/.test(suffix)) continue;
    const seq = parseInt(suffix, 10);
    if (isNaN(seq)) continue;
    const shortCode = formatAssetCode(sku, seq);
    if (shortCode === asset.assetCode) continue;

    const clash = await db.equipmentAsset.findFirst({
      where: {
        companyId: asset.companyId,
        assetCode: shortCode,
        NOT: { id: asset.id },
      },
      select: { id: true },
    });
    if (clash) continue;

    await db.equipmentAsset.update({
      where: { id: asset.id },
      data: { assetCode: shortCode },
    });
    updated++;
  }
  return updated;
}

/**
 * Mint N discrete EquipmentAsset rows when stock increases for an Equipment item.
 * Call inside the same transaction as the PURCHASE / receive movement.
 * Each new asset locks ex-tax `unitCost` from that purchase (not catalog WAVG,
 * not tax-inclusive invoice gross).
 * Returns the number of assets created (whole units only).
 */
export async function mintEquipmentAssets(
  db: DbClient,
  companyId: string,
  itemId: string,
  qty: number,
  options?: { unitCost?: number | null }
): Promise<number> {
  const wholeUnits = normalizeInventoryQty(qty);
  if (wholeUnits <= 0) return 0;

  const item = await db.inventoryItem.findFirst({
    where: { id: itemId, companyId },
    select: { id: true, sku: true, itemType: true },
  });
  if (!item || !isEquipmentItemType(item.itemType)) return 0;

  const lockedUnitCost =
    options?.unitCost != null && Number.isFinite(options.unitCost)
      ? toDecimal(options.unitCost)
      : null;

  const assetCodes = await allocateAssetCodes(companyId, item.sku, wholeUnits, db);
  await db.equipmentAsset.createMany({
    data: assetCodes.map((assetCode) => ({
      companyId,
      itemId: item.id,
      assetCode,
      status: "AVAILABLE" as const,
      unitCost: lockedUnitCost,
    })),
  });
  return wholeUnits;
}

/**
 * Fill missing EquipmentAsset.unitCost for legacy rows.
 * Prefers catalog avgUnitCost, then lastUnitCost, then latest purchase unit price.
 */
export async function backfillEquipmentAssetUnitCosts(
  db: DbClient = prisma,
  companyId?: string
): Promise<{ assetsUpdated: number }> {
  const assets = await db.equipmentAsset.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      unitCost: null,
    },
    select: {
      id: true,
      itemId: true,
      item: {
        select: {
          avgUnitCost: true,
          lastUnitCost: true,
        },
      },
    },
  });

  let assetsUpdated = 0;
  const purchasePriceByItem = new Map<string, number | null>();

  for (const asset of assets) {
    let cost =
      decimalToNumber(asset.item.avgUnitCost) ??
      decimalToNumber(asset.item.lastUnitCost) ??
      null;

    if (cost == null) {
      if (!purchasePriceByItem.has(asset.itemId)) {
        const lastPurchase = await db.inventoryPurchase.findFirst({
          where: { itemId: asset.itemId },
          orderBy: { purchasedAt: "desc" },
          select: { unitPrice: true },
        });
        purchasePriceByItem.set(
          asset.itemId,
          decimalToNumber(lastPurchase?.unitPrice) ?? null
        );
      }
      cost = purchasePriceByItem.get(asset.itemId) ?? null;
    }

    if (cost == null || !Number.isFinite(cost)) continue;

    await db.equipmentAsset.update({
      where: { id: asset.id },
      data: { unitCost: toDecimal(cost) },
    });
    assetsUpdated++;
  }

  return { assetsUpdated };
}

/**
 * Equipment `currentStock` / On Hand = warehouse AVAILABLE units only.
 * Units ON_PROJECT remain company-owned (location change), so they are not
 * included in On Hand — unlike chemicals/consumables which consume stock.
 */
export async function countEquipmentAssetsByStatus(
  db: DbClient,
  itemId: string
): Promise<{ available: number; onProject: number; retired: number }> {
  const [available, onProject, retired] = await Promise.all([
    db.equipmentAsset.count({ where: { itemId, status: "AVAILABLE" } }),
    db.equipmentAsset.count({ where: { itemId, status: "ON_PROJECT" } }),
    db.equipmentAsset.count({ where: { itemId, status: "RETIRED" } }),
  ]);
  return { available, onProject, retired };
}

/**
 * Hard-delete surplus never-deployed AVAILABLE assets when active owned units
 * exceed net purchase stock-in (purchases minus active write-offs). Typical
 * cause: the old backfill formula `stock + onProject - totalAssets` minted an
 * extra warehouse unit while another unit was already ON_PROJECT.
 *
 * Also purges leftover RETIRED surplus-mint phantoms (system-cleanup notes,
 * never deployed, no write-off link). Real write-offs
 * (`writeOffMovementId` set or non-surplus notes) are never deleted.
 *
 * Only targets never-deployed rows (no project/movement links), newest first.
 */
export async function deleteSurplusNeverDeployedEquipmentAssets(
  db: DbClient = prisma,
  companyId?: string
): Promise<number> {
  const legacyPhantoms = await db.equipmentAsset.deleteMany({
    where: {
      ...(companyId ? { companyId } : {}),
      status: "RETIRED",
      writeOffMovementId: null,
      projectId: null,
      movementId: null,
      issueMovementId: null,
      notes: { in: [...LEGACY_SURPLUS_RETIRE_NOTES] },
    },
  });
  let deleted = legacyPhantoms.count;

  const items = await db.inventoryItem.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      itemType: { equals: EQUIPMENT_ITEM_TYPE, mode: "insensitive" },
    },
    select: { id: true, companyId: true },
  });

  for (const item of items) {
    const movements = await db.inventoryMovement.findMany({
      where: {
        itemId: item.id,
        voidedAt: null,
        type: { in: ["PURCHASE", "WRITE_OFF", "SOLD_OFF"] },
      },
      select: { type: true, quantity: true },
    });

    let expectedOwned = 0;
    for (const movement of movements) {
      const qty = Math.abs(inventoryQtyFromDecimal(movement.quantity));
      if (movement.type === "PURCHASE") expectedOwned += qty;
      else if (
        movement.type === "WRITE_OFF" ||
        movement.type === "SOLD_OFF"
      ) {
        expectedOwned -= qty;
      }
    }
    expectedOwned = Math.max(0, normalizeInventoryQty(expectedOwned));

    const { available, onProject } = await countEquipmentAssetsByStatus(
      db,
      item.id
    );
    const surplus = available + onProject - expectedOwned;
    if (surplus <= 0) continue;

    const candidates = await db.equipmentAsset.findMany({
      where: {
        companyId: item.companyId,
        itemId: item.id,
        status: "AVAILABLE",
        projectId: null,
        movementId: null,
        issueMovementId: null,
        writeOffMovementId: null,
        soldOffMovementId: null,
      },
      select: { id: true },
      orderBy: [{ createdAt: "desc" }, { assetCode: "desc" }],
      take: surplus,
    });
    if (candidates.length === 0) continue;

    const removed = await db.equipmentAsset.deleteMany({
      where: { id: { in: candidates.map((row) => row.id) } },
    });
    deleted += removed.count;
  }
  return deleted;
}

/** @deprecated Prefer {@link deleteSurplusNeverDeployedEquipmentAssets}. */
export async function retireSurplusNeverDeployedEquipmentAssets(
  db: DbClient = prisma,
  companyId?: string
): Promise<number> {
  return deleteSurplusNeverDeployedEquipmentAssets(db, companyId);
}

/**
 * Set Equipment `currentStock` from the AVAILABLE asset ledger (source of truth
 * for warehouse qty). Does not mint or retire assets.
 */
export async function reconcileEquipmentWarehouseStock(
  db: DbClient = prisma,
  companyId?: string
): Promise<{ itemsProcessed: number; itemsAdjusted: number }> {
  const items = await db.inventoryItem.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      itemType: { equals: EQUIPMENT_ITEM_TYPE, mode: "insensitive" },
    },
    select: { id: true, currentStock: true },
  });

  let itemsAdjusted = 0;
  for (const item of items) {
    const available = await db.equipmentAsset.count({
      where: { itemId: item.id, status: "AVAILABLE" },
    });
    const stockOnHand = inventoryQtyFromDecimal(item.currentStock);
    if (stockOnHand === available) continue;
    await db.inventoryItem.update({
      where: { id: item.id },
      data: { currentStock: toDecimal(available) },
    });
    itemsAdjusted++;
  }
  return { itemsProcessed: items.length, itemsAdjusted };
}

/**
 * For each Equipment catalog item:
 * - If no active assets exist but warehouse stock > 0, mint AVAILABLE assets
 *   (legacy migration before the asset ledger).
 * - Otherwise treat the asset ledger as source of truth and sync
 *   `currentStock` to the AVAILABLE count (never mint from inflated stock).
 */
export async function backfillEquipmentAssets(
  db: DbClient = prisma,
  companyId?: string
): Promise<{
  itemsProcessed: number;
  assetsMinted: number;
  assetsShortened: number;
  stockAdjusted: number;
}> {
  const assetsShortened = await shortenPaddedAssetCodes(db, companyId);

  const items = await db.inventoryItem.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      itemType: { equals: EQUIPMENT_ITEM_TYPE, mode: "insensitive" },
      active: true,
    },
    select: {
      id: true,
      companyId: true,
      currentStock: true,
      avgUnitCost: true,
      lastUnitCost: true,
    },
  });

  let assetsMinted = 0;
  let stockAdjusted = 0;
  for (const item of items) {
    const stockOnHand = inventoryQtyFromDecimal(item.currentStock);
    const { available, onProject } = await countEquipmentAssetsByStatus(
      db,
      item.id
    );
    const activeOwned = available + onProject;

    if (activeOwned === 0 && stockOnHand > 0) {
      const legacyCost =
        decimalToNumber(item.avgUnitCost) ??
        decimalToNumber(item.lastUnitCost) ??
        null;
      assetsMinted += await mintEquipmentAssets(
        db,
        item.companyId,
        item.id,
        stockOnHand,
        { unitCost: legacyCost }
      );
      continue;
    }

    if (stockOnHand !== available) {
      await db.inventoryItem.update({
        where: { id: item.id },
        data: { currentStock: toDecimal(available) },
      });
      stockAdjusted++;
    }
  }
  return {
    itemsProcessed: items.length,
    assetsMinted,
    assetsShortened,
    stockAdjusted,
  };
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
 * Call inside the same transaction as the WRITE_OFF or SOLD_OFF movement.
 * Oldest assets first (createdAt, then assetCode), unless `assetIds` is provided.
 * Fails if not enough AVAILABLE assets.
 */
export async function retireEquipmentAssets(
  db: DbClient,
  companyId: string,
  itemId: string,
  qty: number,
  reason?: string,
  options?: {
    writeOffMovementId?: string;
    soldOffMovementId?: string;
    /** When set, retire these specific AVAILABLE assets (must match qty). */
    assetIds?: string[];
    notePrefix?: "Write-off" | "Sold off";
  }
): Promise<number> {
  const wholeUnits = normalizeInventoryQty(qty);
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

  let assets: { id: string }[];
  const specificIds = options?.assetIds?.filter(Boolean) ?? [];
  if (specificIds.length > 0) {
    if (specificIds.length !== wholeUnits) {
      throw new InsufficientEquipmentAssetsError(
        specificIds.length,
        wholeUnits
      );
    }
    assets = await db.equipmentAsset.findMany({
      where: {
        id: { in: specificIds },
        companyId,
        itemId,
        status: "AVAILABLE",
      },
      select: { id: true },
    });
    if (assets.length !== wholeUnits) {
      throw new InsufficientEquipmentAssetsError(assets.length, wholeUnits);
    }
  } else {
    assets = await db.equipmentAsset.findMany({
      where: { companyId, itemId, status: "AVAILABLE" },
      select: { id: true },
      orderBy: [{ createdAt: "asc" }, { assetCode: "asc" }],
      take: wholeUnits,
    });
    if (assets.length < wholeUnits) {
      throw new InsufficientEquipmentAssetsError(availableCount, wholeUnits);
    }
  }

  const prefix = options?.notePrefix ?? "Write-off";
  const note = reason?.trim() ? `${prefix}: ${reason.trim()}` : undefined;

  await db.equipmentAsset.updateMany({
    where: { id: { in: assets.map((a) => a.id) } },
    data: {
      status: "RETIRED",
      ...(options?.writeOffMovementId
        ? { writeOffMovementId: options.writeOffMovementId }
        : {}),
      ...(options?.soldOffMovementId
        ? { soldOffMovementId: options.soldOffMovementId }
        : {}),
      ...(note ? { notes: note } : {}),
    },
  });

  return wholeUnits;
}

/**
 * Restore equipment assets retired by a stock write-off back to AVAILABLE.
 * Does not void the movement or restore stock — caller handles that for full reversals.
 */
export async function restoreEquipmentAssetsForWriteOff(
  db: DbClient,
  companyId: string,
  writeOffMovementId: string,
  itemId: string,
  qty: number,
  writeOffReason?: string | null
): Promise<number> {
  const wholeUnits = normalizeInventoryQty(qty);
  if (wholeUnits <= 0) return 0;

  const linked = await db.equipmentAsset.updateMany({
    where: {
      companyId,
      itemId,
      writeOffMovementId,
      status: "RETIRED",
    },
    data: {
      status: "AVAILABLE",
      writeOffMovementId: null,
    },
  });
  if (linked.count >= wholeUnits) {
    return linked.count;
  }

  const remaining = wholeUnits - linked.count;
  const note = writeOffReason?.trim()
    ? `Write-off: ${writeOffReason.trim()}`
    : null;
  if (!note) {
    return linked.count;
  }

  const legacyAssets = await db.equipmentAsset.findMany({
    where: {
      companyId,
      itemId,
      status: "RETIRED",
      writeOffMovementId: null,
      notes: note,
    },
    select: { id: true },
    orderBy: [{ updatedAt: "desc" }, { assetCode: "asc" }],
    take: remaining,
  });
  if (legacyAssets.length === 0) {
    return linked.count;
  }

  const legacy = await db.equipmentAsset.updateMany({
    where: { id: { in: legacyAssets.map((a) => a.id) } },
    data: {
      status: "AVAILABLE",
      writeOffMovementId: null,
    },
  });
  return linked.count + legacy.count;
}

/**
 * Assign N AVAILABLE EquipmentAsset rows to a project without creating cost movements.
 * Used when a bulk ISSUE_TO_PROJECT movement already records financial cost.
 * Oldest assets first (createdAt, then assetCode). Fails if not enough AVAILABLE assets.
 */
export async function assignAvailableEquipmentAssetsToProject(
  db: DbClient,
  companyId: string,
  itemId: string,
  projectId: string,
  qty: number,
  options?: { issueMovementId?: string; assignedAt?: Date }
): Promise<number> {
  const wholeUnits = normalizeInventoryQty(qty);
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

  const assignedAt = options?.assignedAt ?? new Date();
  await db.equipmentAsset.updateMany({
    where: { id: { in: assets.map((a) => a.id) } },
    data: {
      status: "ON_PROJECT",
      projectId,
      issueMovementId: options?.issueMovementId ?? null,
      assignedAt,
    },
  });

  return wholeUnits;
}

/**
 * Release equipment assets linked to an ISSUE_TO_PROJECT movement back to AVAILABLE.
 * Clears both picker (`movementId`) and bulk (`issueMovementId`) links.
 * Does not void the movement or restore stock — caller handles that for full voids.
 */
export async function releaseEquipmentAssetsForBulkIssue(
  db: DbClient,
  companyId: string,
  issueMovementId: string
): Promise<number> {
  const result = await db.equipmentAsset.updateMany({
    where: {
      companyId,
      status: "ON_PROJECT",
      OR: [
        { issueMovementId },
        { movementId: issueMovementId },
      ],
    },
    data: {
      status: "AVAILABLE",
      projectId: null,
      movementId: null,
      issueMovementId: null,
      assignedAt: null,
    },
  });
  return result.count;
}

/**
 * Assets linked to an ISSUE_TO_PROJECT movement via either:
 * - `movementId` (per-asset picker assign), or
 * - `issueMovementId` (bulk inventory issue / historical backfill).
 */
async function listAssetsLinkedToIssueMovement(
  db: DbClient,
  companyId: string,
  issueMovementId: string
): Promise<
  {
    id: string;
    movementId: string | null;
    issueMovementId: string | null;
    assignedAt: Date | null;
    createdAt: Date;
  }[]
> {
  return db.equipmentAsset.findMany({
    where: {
      companyId,
      status: "ON_PROJECT",
      OR: [
        { movementId: issueMovementId },
        { issueMovementId: issueMovementId },
      ],
    },
    select: {
      id: true,
      movementId: true,
      issueMovementId: true,
      assignedAt: true,
      createdAt: true,
    },
  });
}

/**
 * Release ON_PROJECT assets that exceed an open issue's quantity.
 *
 * Typical cause: page-load backfill only counted `issueMovementId`, so a picker
 * assign (linked via `movementId`) still looked like a deficit and pulled an
 * extra AVAILABLE unit onto the project without decrementing stock.
 *
 * Phantoms are returned to AVAILABLE with no stock change (stock was never
 * reduced for them). Prefer keeping `movementId` links over `issueMovementId`.
 */
export async function releaseOverAssignedEquipmentAssets(
  db: DbClient,
  companyId: string,
  projectId?: string
): Promise<number> {
  const issues = await db.inventoryMovement.findMany({
    where: {
      companyId,
      ...(projectId ? { projectId } : {}),
      type: "ISSUE_TO_PROJECT",
      voidedAt: null,
      item: { itemType: { equals: EQUIPMENT_ITEM_TYPE, mode: "insensitive" } },
    },
    select: {
      id: true,
      quantity: true,
    },
  });

  let released = 0;
  for (const issue of issues) {
    const issuedQty = Math.abs(inventoryQtyFromDecimal(issue.quantity));
    const linked = await listAssetsLinkedToIssueMovement(
      db,
      companyId,
      issue.id
    );
    if (linked.length <= issuedQty) continue;

    // Keep picker (`movementId`) links first, then oldest assignments.
    const ranked = [...linked].sort((a, b) => {
      const aPicker = a.movementId === issue.id ? 0 : 1;
      const bPicker = b.movementId === issue.id ? 0 : 1;
      if (aPicker !== bPicker) return aPicker - bPicker;
      const aTime = (a.assignedAt ?? a.createdAt).getTime();
      const bTime = (b.assignedAt ?? b.createdAt).getTime();
      return aTime - bTime;
    });
    const phantoms = ranked.slice(issuedQty);
    if (phantoms.length === 0) continue;

    await db.equipmentAsset.updateMany({
      where: { id: { in: phantoms.map((row) => row.id) } },
      data: {
        status: "AVAILABLE",
        projectId: null,
        movementId: null,
        issueMovementId: null,
        assignedAt: null,
      },
    });
    released += phantoms.length;
  }
  return released;
}

/**
 * Release over-assigned phantoms for a project's open Equipment issues.
 *
 * Assign/mint side effects are opt-in only (`assignMissing: true`) and must
 * never run on project page load — silent re-assign caused double/ghost units.
 * Prefer scripts/reconcile-equipment-stock.ts for repair; default is release-only.
 */
export async function backfillProjectEquipmentIssueAssignments(
  db: DbClient,
  companyId: string,
  projectId: string,
  options?: { assignMissing?: boolean }
): Promise<number> {
  const released = await releaseOverAssignedEquipmentAssets(
    db,
    companyId,
    projectId
  );
  if (!options?.assignMissing) {
    return released;
  }

  const issues = await db.inventoryMovement.findMany({
    where: {
      companyId,
      projectId,
      type: "ISSUE_TO_PROJECT",
      voidedAt: null,
      item: { itemType: { equals: EQUIPMENT_ITEM_TYPE, mode: "insensitive" } },
    },
    select: {
      id: true,
      itemId: true,
      quantity: true,
      movedAt: true,
    },
  });

  let assigned = 0;
  for (const issue of issues) {
    const issuedQty = Math.abs(inventoryQtyFromDecimal(issue.quantity));
    if (issuedQty <= 0) continue;

    const linked = await listAssetsLinkedToIssueMovement(
      db,
      companyId,
      issue.id
    );
    const deficit = issuedQty - linked.length;
    if (deficit <= 0) continue;

    const availableCount = await db.equipmentAsset.count({
      where: { companyId, itemId: issue.itemId, status: "AVAILABLE" },
    });
    const toAssign = Math.min(deficit, availableCount);
    if (toAssign <= 0) continue;

    assigned += await assignAvailableEquipmentAssetsToProject(
      db,
      companyId,
      issue.itemId,
      projectId,
      toAssign,
      { issueMovementId: issue.id, assignedAt: issue.movedAt }
    );
  }
  return released + assigned;
}

export type EquipmentInvariantViolation = {
  itemId: string;
  sku: string;
  kind:
    | "STOCK_VS_AVAILABLE"
    | "OWNED_VS_ACTIVE"
    | "OPEN_ISSUE_VS_LINKED";
  expected: number;
  actual: number;
  detail?: string;
};

export class EquipmentInvariantError extends Error {
  readonly code = "EQUIPMENT_INVARIANT_VIOLATION" as const;

  constructor(readonly violations: EquipmentInvariantViolation[]) {
    super(
      `Equipment inventory invariants failed (${violations.length}): ${violations
        .map(
          (v) =>
            `${v.sku}/${v.kind} expected=${v.expected} actual=${v.actual}${
              v.detail ? ` (${v.detail})` : ""
            }`
        )
        .join("; ")}`
    );
    this.name = "EquipmentInvariantError";
  }
}

/**
 * Read-only checks that Inventory and asset ledger agree for Equipment items.
 *
 * - `currentStock === count(AVAILABLE)`
 * - owned active === AVAILABLE + ON_PROJECT (always; status partition)
 * - optionally purchase − write-off − sold-off === AVAILABLE + ON_PROJECT
 *   (`checkOwnedVsPurchases` — use in reconcile; skip on hot paths so legacy
 *   surplus drift cannot block assign / release / contract end)
 * - open Equipment ISSUE abs(qty) === linked ON_PROJECT assets for that movement
 *
 * Scope with `itemIds` / `projectId` after assign, release, or demob.
 */
export async function checkEquipmentInventoryInvariants(
  db: DbClient,
  companyId: string,
  options?: {
    itemIds?: string[];
    projectId?: string;
    /** When set, only these open ISSUE rows are checked for link parity. */
    movementIds?: string[];
    /** Compare active assets to purchase net. Default false on mutation paths. */
    checkOwnedVsPurchases?: boolean;
  }
): Promise<EquipmentInvariantViolation[]> {
  const itemFilter =
    options?.itemIds && options.itemIds.length > 0
      ? { id: { in: options.itemIds } }
      : {};

  const items = await db.inventoryItem.findMany({
    where: {
      companyId,
      ...itemFilter,
      itemType: { equals: EQUIPMENT_ITEM_TYPE, mode: "insensitive" },
    },
    select: { id: true, sku: true, currentStock: true },
  });

  const violations: EquipmentInvariantViolation[] = [];

  for (const item of items) {
    const { available, onProject } = await countEquipmentAssetsByStatus(
      db,
      item.id
    );
    const stockOnHand = inventoryQtyFromDecimal(item.currentStock);
    if (stockOnHand !== available) {
      violations.push({
        itemId: item.id,
        sku: item.sku,
        kind: "STOCK_VS_AVAILABLE",
        expected: available,
        actual: stockOnHand,
      });
    }

    // Owned active (non-retired custody) is exactly AVAILABLE + ON_PROJECT.
    // Recorded for callers that want the partition explicit; not a failure mode
    // unless purchase-net check is enabled below.
    const activeOwned = available + onProject;

    if (options?.checkOwnedVsPurchases) {
      const movements = await db.inventoryMovement.findMany({
        where: {
          itemId: item.id,
          companyId,
          voidedAt: null,
          type: { in: ["PURCHASE", "WRITE_OFF", "SOLD_OFF"] },
        },
        select: { type: true, quantity: true },
      });
      let expectedOwned = 0;
      for (const movement of movements) {
        const qty = Math.abs(inventoryQtyFromDecimal(movement.quantity));
        if (movement.type === "PURCHASE") expectedOwned += qty;
        else expectedOwned -= qty;
      }
      expectedOwned = Math.max(0, normalizeInventoryQty(expectedOwned));
      if (activeOwned !== expectedOwned) {
        violations.push({
          itemId: item.id,
          sku: item.sku,
          kind: "OWNED_VS_ACTIVE",
          expected: expectedOwned,
          actual: activeOwned,
          detail: "purchaseNet vs AVAILABLE+ON_PROJECT",
        });
      }
    }
  }

  // Empty `movementIds` skips issue-link checks (stock/owned only).
  const issues =
    options?.movementIds && options.movementIds.length === 0
      ? []
      : await db.inventoryMovement.findMany({
          where: {
            companyId,
            ...(options?.projectId ? { projectId: options.projectId } : {}),
            ...(options?.itemIds && options.itemIds.length > 0
              ? { itemId: { in: options.itemIds } }
              : {}),
            ...(options?.movementIds && options.movementIds.length > 0
              ? { id: { in: options.movementIds } }
              : {}),
            type: "ISSUE_TO_PROJECT",
            voidedAt: null,
            item: {
              itemType: { equals: EQUIPMENT_ITEM_TYPE, mode: "insensitive" },
            },
          },
          select: {
            id: true,
            itemId: true,
            quantity: true,
            projectId: true,
            item: { select: { sku: true } },
          },
        });

  for (const issue of issues) {
    const issuedQty = Math.abs(inventoryQtyFromDecimal(issue.quantity));
    const linked = await listAssetsLinkedToIssueMovement(
      db,
      companyId,
      issue.id
    );
    if (linked.length !== issuedQty) {
      violations.push({
        itemId: issue.itemId,
        sku: issue.item.sku,
        kind: "OPEN_ISSUE_VS_LINKED",
        expected: issuedQty,
        actual: linked.length,
        detail: `movement=${issue.id} project=${issue.projectId ?? "none"}`,
      });
    }
  }

  return violations;
}

/** Throws {@link EquipmentInvariantError} when checks fail. */
export async function assertEquipmentInventoryInvariants(
  db: DbClient,
  companyId: string,
  options?: {
    itemIds?: string[];
    projectId?: string;
    movementIds?: string[];
    checkOwnedVsPurchases?: boolean;
  }
): Promise<void> {
  const violations = await checkEquipmentInventoryInvariants(
    db,
    companyId,
    options
  );
  if (violations.length > 0) {
    throw new EquipmentInvariantError(violations);
  }
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
