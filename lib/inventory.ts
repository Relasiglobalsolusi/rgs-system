import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";

/** Projects that may receive inventory issues. */
export const INVENTORY_ISSUE_PROJECT_STATUSES = [
  "IN_PROGRESS",
  "WAITING_FOR_APPROVAL",
  "ON_HOLD",
] as const;

export function canIssueInventoryToProject(status: string): boolean {
  return (INVENTORY_ISSUE_PROJECT_STATUSES as readonly string[]).includes(
    status
  );
}

export type InventoryCostingNote =
  "Stock value and project issues use running weighted-average unit cost. Last purchase unit cost is shown for reference.";

export function toDecimal(
  value: number | string | Prisma.Decimal
): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function decimalQty(value: Prisma.Decimal | number | null | undefined) {
  return decimalToNumber(value) ?? 0;
}

/** Inventory counts are whole units; round away float drift (e.g. 1.999 → 2). */
export function normalizeInventoryQty(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function inventoryQtyFromDecimal(
  value: Prisma.Decimal | number | null | undefined
): number {
  return normalizeInventoryQty(decimalQty(value));
}

export function formatInventoryQty(value: number): string {
  return String(normalizeInventoryQty(value));
}

export function formatInventoryQtyWithUnit(value: number, unit: string): string {
  return `${formatInventoryQty(value)} ${unit}`;
}

export function isWholeInventoryQty(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value);
}

/**
 * Weighted-average unit cost after a stock-in of `qty` at `unitPrice`.
 * When prior stock is zero (or no avg), new purchase price becomes the avg.
 */
export function nextWeightedAvgUnitCost(options: {
  currentStock: number;
  avgUnitCost: number | null;
  purchaseQty: number;
  purchaseUnitPrice: number;
}): number {
  const { currentStock, avgUnitCost, purchaseQty, purchaseUnitPrice } = options;
  if (purchaseQty <= 0) {
    return avgUnitCost ?? purchaseUnitPrice;
  }
  if (currentStock <= 0 || avgUnitCost == null || !Number.isFinite(avgUnitCost)) {
    return purchaseUnitPrice;
  }
  const totalValue = currentStock * avgUnitCost + purchaseQty * purchaseUnitPrice;
  const totalQty = currentStock + purchaseQty;
  if (totalQty <= 0) return purchaseUnitPrice;
  return totalValue / totalQty;
}

/** Absolute money amount for a movement (qty × unit cost). */
export function movementTotalCost(quantity: number, unitCost: number): number {
  return Math.abs(quantity) * unitCost;
}

/**
 * Where-clause fragment: exclude Equipment ISSUE_TO_PROJECT rows from project COGS.
 * Equipment is location/custody only (also stored with zero unit/total cost going forward).
 */
export const excludeEquipmentFromProjectInventoryCost: Prisma.InventoryMovementWhereInput =
  {
    NOT: {
      item: { itemType: { equals: "Equipment", mode: "insensitive" } },
    },
  };

/**
 * Sum of non-voided ISSUE_TO_PROJECT totalCost for a project (IDR).
 * Equipment deployments are location/custody only and excluded from project COGS.
 * Use for project financial reports / P&L cost layer.
 */
export async function getProjectInventoryCost(
  projectId: string,
  options?: { companyId?: string }
): Promise<number> {
  const where: Prisma.InventoryMovementWhereInput = {
    projectId,
    type: "ISSUE_TO_PROJECT",
    voidedAt: null,
    ...excludeEquipmentFromProjectInventoryCost,
    ...(options?.companyId ? { companyId: options.companyId } : {}),
  };

  const agg = await prisma.inventoryMovement.aggregate({
    where,
    _sum: { totalCost: true },
  });

  return decimalToNumber(agg._sum.totalCost) ?? 0;
}

export type ProjectInventoryIssueRow = {
  id: string;
  movedAt: Date;
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes: string | null;
  item: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    itemType: string;
  };
};

/** Non-voided project issues for detail / report tables. */
export async function listProjectInventoryIssues(
  projectId: string,
  options?: { companyId?: string; take?: number }
): Promise<ProjectInventoryIssueRow[]> {
  const rows = await prisma.inventoryMovement.findMany({
    where: {
      projectId,
      type: "ISSUE_TO_PROJECT",
      voidedAt: null,
      ...(options?.companyId ? { companyId: options.companyId } : {}),
    },
    include: {
      item: {
        select: { id: true, sku: true, name: true, unit: true, itemType: true },
      },
    },
    orderBy: { movedAt: "desc" },
    take: options?.take,
  });

  return rows.map((row) => ({
    id: row.id,
    movedAt: row.movedAt,
    quantity: Math.abs(inventoryQtyFromDecimal(row.quantity)),
    unitCost: decimalQty(row.unitCost),
    totalCost: decimalQty(row.totalCost),
    notes: row.notes,
    item: row.item,
  }));
}

/** Value on hand for an item using weighted-average unit cost. */
export function stockValueOnHand(
  currentStock: number,
  avgUnitCost: number | null | undefined
): number {
  if (currentStock <= 0 || avgUnitCost == null) return 0;
  return currentStock * avgUnitCost;
}

/**
 * Low-stock warning: on-hand below the item's minStock threshold.
 * When minStock is 0 (unset), no warning.
 */
export function isBelowMinStock(
  currentStock: number,
  minStock: number
): boolean {
  return minStock > 0 && currentStock < minStock;
}
