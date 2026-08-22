import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  inventoryQtyFromDecimal,
  normalizeInventoryQty,
  toDecimal,
} from "@/lib/inventory";
import { isVehicleItemType } from "@/lib/inventory-sku";
import { parseRequiredVehiclePlate } from "@/lib/vehicle-plate";

const EQUIPMENT_ITEM_TYPE = "Equipment";

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

/** Equipment units use SKU-A{n}. Vehicles use the number plate as the asset code. */
export function isCodedIdentityItemType(itemType: string): boolean {
  return isEquipmentItemType(itemType) || isVehicleItemType(itemType);
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
 * Warehouse new (never issued) = on-hand stock minus coded AVAILABLE units.
 * Coded AVAILABLE units are returned / used machines at Head Office.
 */
export function uncodedWarehouseQty(
  currentStock: number,
  availableCoded: number
): number {
  return Math.max(0, normalizeInventoryQty(currentStock - availableCoded));
}

/**
 * Mint N discrete EquipmentAsset rows. Codes are born when warehouse sends.
 * Purchase no longer mints — sealed warehouse boxes stay uncoded.
 * Each new asset locks ex-tax `unitCost` from that receipt (not catalog WAVG,
 * not tax-inclusive invoice gross).
 * Returns the number of assets created (whole units only).
 */
export async function mintEquipmentAssets(
  db: DbClient,
  companyId: string,
  itemId: string,
  qty: number,
  options?: {
    unitCost?: number | null;
    status?: "AVAILABLE" | "IN_TRANSIT";
    projectId?: string | null;
    issueMovementId?: string | null;
    assignedAt?: Date | null;
  }
): Promise<number> {
  const wholeUnits = Math.round(qty);
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
      status: options?.status ?? "AVAILABLE",
      projectId: options?.projectId ?? null,
      issueMovementId: options?.issueMovementId ?? null,
      assignedAt: options?.assignedAt ?? null,
      unitCost: lockedUnitCost,
    })),
  });
  return wholeUnits;
}

/**
 * Mint one vehicle unit whose asset code is the number plate.
 * Catalog SKU stays VEH-###; the plate is the physical identity.
 */
export async function mintVehicleAssetByPlate(
  db: DbClient,
  companyId: string,
  itemId: string,
  plateNumber: string,
  options?: {
    unitCost?: number | null;
    vehicleYear?: number | null;
    status?: "AVAILABLE" | "IN_TRANSIT";
  }
): Promise<string> {
  const plate = parseRequiredVehiclePlate(plateNumber);

  const item = await db.inventoryItem.findFirst({
    where: { id: itemId, companyId },
    select: { id: true, itemType: true },
  });
  if (!item || !isVehicleItemType(item.itemType)) {
    throw new Error("Number plate can only be used for a Vehicle catalog item.");
  }

  const existing = await db.equipmentAsset.findFirst({
    where: { companyId, assetCode: plate },
    select: { id: true, itemId: true },
  });
  if (existing) {
    if (existing.itemId !== item.id) {
      throw new Error("This number plate is already on file as a vehicle asset.");
    }
    const existingPatch: {
      unitCost?: ReturnType<typeof toDecimal>;
      vehicleYear?: number;
    } = {};
    if (options?.unitCost != null && Number.isFinite(options.unitCost)) {
      existingPatch.unitCost = toDecimal(options.unitCost);
    }
    if (options?.vehicleYear != null) {
      existingPatch.vehicleYear = options.vehicleYear;
    }
    if (Object.keys(existingPatch).length > 0) {
      await db.equipmentAsset.update({
        where: { id: existing.id },
        data: existingPatch,
      });
    }
    return plate;
  }

  const lockedUnitCost =
    options?.unitCost != null && Number.isFinite(options.unitCost)
      ? toDecimal(options.unitCost)
      : null;

  await db.equipmentAsset.create({
    data: {
      companyId,
      itemId: item.id,
      assetCode: plate,
      serialNo: plate,
      status: options?.status ?? "AVAILABLE",
      unitCost: lockedUnitCost,
      vehicleYear: options?.vehicleYear ?? null,
    },
  });
  return plate;
}

/**
 * Delete leftover warehouse units minted at purchase time (legacy).
 * New purchases do not mint — if the purchase window is empty or has fewer
 * assets than the buy qty, skip delete so uncoded warehouse stock can reverse.
 * A full window of AVAILABLE units is still removed.
 */
export async function deleteEquipmentAssetsMintedForPurchase(
  db: DbClient,
  options: {
    companyId: string;
    itemId: string;
    qty: number;
    purchasedAt: Date;
  }
): Promise<number> {
  const wholeUnits = Math.round(options.qty);
  if (wholeUnits <= 0) return 0;

  const windowEnd = new Date(options.purchasedAt.getTime() + 5 * 60 * 1000);
  const minted = await db.equipmentAsset.findMany({
    where: {
      companyId: options.companyId,
      itemId: options.itemId,
      createdAt: { gte: options.purchasedAt, lte: windowEnd },
    },
    select: { id: true, status: true },
    orderBy: [{ createdAt: "asc" }, { assetCode: "asc" }],
  });

  if (minted.length === 0 || minted.length < wholeUnits) {
    return 0;
  }

  const toRemove = minted.slice(0, wholeUnits);
  if (toRemove.some((asset) => asset.status !== "AVAILABLE")) {
    throw new Error(
      "Cannot reverse this purchase. Equipment from this buy is already issued, in transit, sold, or written off. Return or reverse those first."
    );
  }

  await db.equipmentAsset.deleteMany({
    where: { id: { in: toRemove.map((asset) => asset.id) } },
  });
  return wholeUnits;
}

/**
 * Equipment `currentStock` / On Hand = uncoded new warehouse qty + coded
 * AVAILABLE (returned used units at Head Office).
 * Units ON_PROJECT / IN_TRANSIT / AT_FACTORY stay company-owned off-hand.
 */
export async function countEquipmentAssetsByStatus(
  db: DbClient,
  itemId: string
): Promise<{
  available: number;
  onProject: number;
  inTransit: number;
  atFactory: number;
  retired: number;
}> {
  const [available, onProject, inTransit, atFactory, retired] =
    await Promise.all([
      db.equipmentAsset.count({ where: { itemId, status: "AVAILABLE" } }),
      db.equipmentAsset.count({ where: { itemId, status: "ON_PROJECT" } }),
      db.equipmentAsset.count({ where: { itemId, status: "IN_TRANSIT" } }),
      db.equipmentAsset.count({ where: { itemId, status: "AT_FACTORY" } }),
      db.equipmentAsset.count({ where: { itemId, status: "RETIRED" } }),
    ]);
  return { available, onProject, inTransit, atFactory, retired };
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
  const wholeUnits = Math.round(qty);
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
 * Sell specific equipment units from the warehouse or from a site.
 * Keeps the asset code. On-site units are marked sold in place — they do not
 * return to the warehouse first. Detaches them from the project issue so
 * open-issue qty still matches remaining on-site units.
 */
export async function retireEquipmentAssetsForSale(
  db: DbClient,
  companyId: string,
  itemId: string,
  qty: number,
  reason: string | null | undefined,
  options: {
    soldOffMovementId: string;
    assetIds: string[];
  }
): Promise<{ warehouseQty: number; projectIds: string[] }> {
  const wholeUnits = Math.round(qty);
  if (wholeUnits <= 0) {
    return { warehouseQty: 0, projectIds: [] };
  }

  const item = await db.inventoryItem.findFirst({
    where: { id: itemId, companyId },
    select: { id: true, itemType: true },
  });
  if (!item || !isEquipmentItemType(item.itemType)) {
    return { warehouseQty: 0, projectIds: [] };
  }

  const assetIds = options.assetIds.filter(Boolean);
  if (assetIds.length !== wholeUnits) {
    throw new InsufficientEquipmentAssetsError(assetIds.length, wholeUnits);
  }

  const assets = await db.equipmentAsset.findMany({
    where: {
      id: { in: assetIds },
      companyId,
      itemId,
      status: { in: ["AVAILABLE", "ON_PROJECT"] },
    },
    select: {
      id: true,
      status: true,
      projectId: true,
      movementId: true,
      issueMovementId: true,
    },
  });
  if (assets.length !== wholeUnits) {
    throw new InsufficientEquipmentAssetsError(assets.length, wholeUnits);
  }

  const warehouseQty = assets.filter((asset) => asset.status === "AVAILABLE")
    .length;
  const projectIds = [
    ...new Set(
      assets
        .map((asset) => asset.projectId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const issueMovementIds = [
    ...new Set(
      assets.flatMap((asset) =>
        [asset.movementId, asset.issueMovementId].filter(
          (id): id is string => Boolean(id)
        )
      )
    ),
  ];

  const note = reason?.trim()
    ? `Sold off: ${reason.trim()}`
    : "Sold off";

  await db.equipmentAsset.updateMany({
    where: { id: { in: assets.map((asset) => asset.id) } },
    data: {
      status: "RETIRED",
      soldOffMovementId: options.soldOffMovementId,
      projectId: null,
      movementId: null,
      issueMovementId: null,
      assignedAt: null,
      notes: note,
    },
  });

  await shrinkOrVoidEquipmentIssueMovements(
    db,
    companyId,
    issueMovementIds,
    "Sold from site"
  );

  return { warehouseQty, projectIds };
}

/** Shrink or void open project issues after coded units leave the site. */
export async function shrinkOrVoidEquipmentIssueMovements(
  db: DbClient,
  companyId: string,
  issueMovementIds: string[],
  voidReason: string
): Promise<void> {
  for (const movementId of issueMovementIds) {
    const remaining = await db.equipmentAsset.count({
      where: {
        companyId,
        status: "ON_PROJECT",
        OR: [{ movementId }, { issueMovementId: movementId }],
      },
    });
    const issue = await db.inventoryMovement.findFirst({
      where: {
        id: movementId,
        companyId,
        type: "ISSUE_TO_PROJECT",
        voidedAt: null,
      },
      select: { id: true },
    });
    if (!issue) continue;
    if (remaining <= 0) {
      await db.inventoryMovement.update({
        where: { id: movementId },
        data: {
          voidedAt: new Date(),
          voidReason,
        },
      });
    } else {
      await db.inventoryMovement.update({
        where: { id: movementId },
        data: { quantity: toDecimal(-remaining) },
      });
    }
  }
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
  const wholeUnits = Math.round(qty);
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
  const wholeUnits = Math.round(qty);
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
  const wholeUnits = Math.round(qty);
  if (wholeUnits <= 0) return 0;

  const item = await db.inventoryItem.findFirst({
    where: { id: itemId, companyId },
    select: {
      id: true,
      itemType: true,
      currentStock: true,
      lastUnitCost: true,
      avgUnitCost: true,
    },
  });
  if (!item || !isEquipmentItemType(item.itemType)) return 0;

  const availableCount = await db.equipmentAsset.count({
    where: { companyId, itemId, status: "AVAILABLE" },
  });
  const currentStock = inventoryQtyFromDecimal(item.currentStock);
  const uncodedBefore = uncodedWarehouseQty(
    currentStock + wholeUnits,
    availableCount
  );
  const mintCount = Math.min(uncodedBefore, wholeUnits);
  const codedCount = wholeUnits - mintCount;
  if (codedCount > availableCount) {
    throw new InsufficientEquipmentAssetsError(
      availableCount + uncodedBefore,
      wholeUnits
    );
  }

  const movedAt = options?.movedAt ?? new Date();
  const unitCost =
    decimalToNumberSafe(item.lastUnitCost) ??
    decimalToNumberSafe(item.avgUnitCost);

  if (mintCount > 0) {
    await mintEquipmentAssets(db, companyId, itemId, mintCount, {
      unitCost,
      status: "IN_TRANSIT",
      projectId,
      issueMovementId: options?.transitMovementId ?? null,
      assignedAt: movedAt,
    });
  }

  if (codedCount > 0) {
    const assets = await db.equipmentAsset.findMany({
      where: { companyId, itemId, status: "AVAILABLE" },
      select: { id: true },
      orderBy: [{ createdAt: "asc" }, { assetCode: "asc" }],
      take: codedCount,
    });
    if (assets.length < codedCount) {
      throw new InsufficientEquipmentAssetsError(availableCount, wholeUnits);
    }

    await db.equipmentAsset.updateMany({
      where: { id: { in: assets.map((a) => a.id) } },
      data: {
        status: "IN_TRANSIT",
        projectId,
        issueMovementId: options?.transitMovementId ?? null,
        assignedAt: movedAt,
      },
    });
  }

  return wholeUnits;
}

function decimalToNumberSafe(value: Prisma.Decimal | null | undefined): number | null {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
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
  const wholeUnits = Math.round(qty);
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
 * - `currentStock >= count(AVAILABLE)` (uncoded new = stock − AVAILABLE)
 * - owned active === stock + ON_PROJECT + IN_TRANSIT + AT_FACTORY
 * - optionally purchase − write-off − sold-off − factory send + factory receive
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
    const { available, onProject, inTransit, atFactory } =
      await countEquipmentAssetsByStatus(db, item.id);
    const stockOnHand = inventoryQtyFromDecimal(item.currentStock);
    if (stockOnHand < available) {
      violations.push({
        itemId: item.id,
        sku: item.sku,
        kind: "STOCK_VS_AVAILABLE",
        expected: available,
        actual: stockOnHand,
        detail: "currentStock must cover coded AVAILABLE units",
      });
    }

    // Owned active = uncoded warehouse + coded AVAILABLE + off-hand custody.
    const activeOwned = stockOnHand + onProject + inTransit + atFactory;

    if (options?.checkOwnedVsPurchases) {
      const movements = await db.inventoryMovement.findMany({
        where: {
          itemId: item.id,
          companyId,
          voidedAt: null,
          type: {
            in: [
              "PURCHASE",
              "WRITE_OFF",
              "SOLD_OFF",
              "RETURN_TO_FACTORY",
              "RECEIVE_FROM_FACTORY",
            ],
          },
        },
        select: { type: true, quantity: true },
      });
      let expectedOwned = 0;
      for (const movement of movements) {
        const qty = Math.abs(inventoryQtyFromDecimal(movement.quantity));
        if (
          movement.type === "PURCHASE" ||
          movement.type === "RECEIVE_FROM_FACTORY"
        ) {
          expectedOwned += qty;
        } else {
          expectedOwned -= qty;
        }
      }
      expectedOwned = Math.max(0, normalizeInventoryQty(expectedOwned));
      if (activeOwned !== expectedOwned) {
        violations.push({
          itemId: item.id,
          sku: item.sku,
          kind: "OWNED_VS_ACTIVE",
          expected: expectedOwned,
          actual: activeOwned,
          detail:
            "purchaseNet vs warehouse+ON_PROJECT+IN_TRANSIT+AT_FACTORY",
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
