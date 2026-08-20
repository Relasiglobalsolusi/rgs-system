import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  inventoryQtyFromDecimal,
  normalizeInventoryQty,
  toDecimal,
} from "@/lib/inventory";

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

export type EquipmentRetirementKind = "sold" | "writtenOff";

/** Why a RETIRED unit left the warehouse — sold vs written off, never a generic “retired”. */
export function equipmentRetirementKind(asset: {
  status: string;
  writeOffMovementId?: string | null;
  soldOffMovementId?: string | null;
  notes?: string | null;
}): EquipmentRetirementKind | null {
  if (asset.status !== "RETIRED") return null;
  if (asset.soldOffMovementId) return "sold";
  if (asset.writeOffMovementId) return "writtenOff";
  const notes = (asset.notes ?? "").trim();
  if (notes.startsWith("Sold off")) return "sold";
  if (notes.startsWith("Write-off") || notes.startsWith("Write-Off")) {
    return "writtenOff";
  }
  return null;
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
const ASSET_CODE_SEPARATOR = "-A";

function formatAssetCode(itemSku: string, sequence: number): string {
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
async function allocateAssetCodes(
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
 * Equipment `currentStock` / On Hand = warehouse AVAILABLE units only.
 * Units ON_PROJECT remain company-owned (location change), so they are not
 * included in On Hand — unlike chemicals/consumables which consume stock.
 */
async function countEquipmentAssetsByStatus(
  db: DbClient,
  itemId: string
): Promise<{
  available: number;
  onProject: number;
  inTransit: number;
  retired: number;
}> {
  const [available, onProject, inTransit, retired] = await Promise.all([
    db.equipmentAsset.count({ where: { itemId, status: "AVAILABLE" } }),
    db.equipmentAsset.count({ where: { itemId, status: "ON_PROJECT" } }),
    db.equipmentAsset.count({ where: { itemId, status: "IN_TRANSIT" } }),
    db.equipmentAsset.count({ where: { itemId, status: "RETIRED" } }),
  ]);
  return { available, onProject, inTransit, retired };
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
 * Restore equipment assets retired by a stock sale back to AVAILABLE.
 * Does not void the movement or restore stock — caller handles that for full reversals.
 */
export async function restoreEquipmentAssetsForSoldOff(
  db: DbClient,
  companyId: string,
  soldOffMovementId: string,
  itemId: string,
  qty: number,
  soldOffReason?: string | null
): Promise<number> {
  const wholeUnits = normalizeInventoryQty(qty);
  if (wholeUnits <= 0) return 0;

  const linked = await db.equipmentAsset.updateMany({
    where: {
      companyId,
      itemId,
      soldOffMovementId,
      status: "RETIRED",
    },
    data: {
      status: "AVAILABLE",
      soldOffMovementId: null,
    },
  });
  if (linked.count >= wholeUnits) {
    return linked.count;
  }

  const remaining = wholeUnits - linked.count;
  const note = soldOffReason?.trim()
    ? `Sold off: ${soldOffReason.trim()}`
    : null;
  if (!note) {
    return linked.count;
  }

  const legacyAssets = await db.equipmentAsset.findMany({
    where: {
      companyId,
      itemId,
      status: "RETIRED",
      soldOffMovementId: null,
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
      soldOffMovementId: null,
    },
  });
  return linked.count + legacy.count;
}

export async function markAvailableEquipmentAssetsInTransit(
  db: DbClient,
  companyId: string,
  itemId: string,
  projectId: string,
  qty: number,
  options?: { transitMovementId?: string; movedAt?: Date }
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

  await db.equipmentAsset.updateMany({
    where: { id: { in: assets.map((a) => a.id) } },
    data: {
      status: "IN_TRANSIT",
      projectId,
      issueMovementId: options?.transitMovementId ?? null,
      assignedAt: options?.movedAt ?? new Date(),
    },
  });

  return wholeUnits;
}

/**
 * Site receive: book IN_TRANSIT assets onto the project (ON_PROJECT) and
 * attach the ISSUE_TO_PROJECT movement. Does not change warehouse stock.
 */
export async function assignInTransitEquipmentAssetsToProject(
  db: DbClient,
  companyId: string,
  itemId: string,
  projectId: string,
  qty: number,
  options?: {
    transitMovementId?: string;
    issueMovementId?: string;
    assignedAt?: Date;
    fromProjectId?: string;
  }
): Promise<number> {
  const wholeUnits = normalizeInventoryQty(qty);
  if (wholeUnits <= 0) return 0;

  const assets = await db.equipmentAsset.findMany({
    where: {
      companyId,
      itemId,
      status: "IN_TRANSIT",
      ...(options?.transitMovementId
        ? { issueMovementId: options.transitMovementId }
        : { projectId: options?.fromProjectId ?? projectId }),
    },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }, { assetCode: "asc" }],
    take: wholeUnits,
  });
  if (assets.length < wholeUnits) {
    throw new InsufficientEquipmentAssetsError(assets.length, wholeUnits);
  }

  await db.equipmentAsset.updateMany({
    where: { id: { in: assets.map((a) => a.id) } },
    data: {
      status: "ON_PROJECT",
      projectId,
      issueMovementId: options?.issueMovementId ?? options?.transitMovementId ?? null,
      assignedAt: options?.assignedAt ?? new Date(),
    },
  });

  return wholeUnits;
}

/** Return IN_TRANSIT assets for a movement back to warehouse AVAILABLE. */
export async function returnInTransitEquipmentAssetsToWarehouse(
  db: DbClient,
  companyId: string,
  transitMovementId: string
): Promise<number> {
  const result = await db.equipmentAsset.updateMany({
    where: {
      companyId,
      status: "IN_TRANSIT",
      issueMovementId: transitMovementId,
    },
    data: {
      status: "AVAILABLE",
      projectId: null,
      issueMovementId: null,
      assignedAt: null,
    },
  });
  return result.count;
}

/** Retire IN_TRANSIT assets linked to a send movement (write-off of lost stock). */
export async function retireInTransitEquipmentAssets(
  db: DbClient,
  companyId: string,
  transitMovementId: string,
  options?: { writeOffMovementId?: string; notes?: string }
): Promise<number> {
  const result = await db.equipmentAsset.updateMany({
    where: {
      companyId,
      status: "IN_TRANSIT",
      issueMovementId: transitMovementId,
    },
    data: {
      status: "RETIRED",
      projectId: null,
      writeOffMovementId: options?.writeOffMovementId ?? null,
      notes: options?.notes ?? null,
    },
  });
  return result.count;
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
async function checkEquipmentInventoryInvariants(
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
    const { available, onProject, inTransit } =
      await countEquipmentAssetsByStatus(db, item.id);
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

    // Owned active (non-retired custody) is AVAILABLE + ON_PROJECT + IN_TRANSIT.
    const activeOwned = available + onProject + inTransit;

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
          detail: "purchaseNet vs AVAILABLE+ON_PROJECT+IN_TRANSIT",
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
