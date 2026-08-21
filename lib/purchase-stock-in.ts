import type { Prisma } from "@prisma/client";

import { isEquipmentItemType } from "@/lib/equipment-asset";
import { lockInventoryItemRow } from "@/lib/inventory-access";
import {
  inventoryQtyFromDecimal,
  isWholeInventoryQty,
  nextWeightedAvgUnitCost,
  normalizeInventoryQty,
  toDecimal,
} from "@/lib/inventory";
import { decimalToNumber } from "@/lib/project-billing";
import type { PurchaseCategory, PurchasePurpose } from "@prisma/client";

import { purchaseCreatesStock } from "@/lib/purchase-purpose";

export async function applyPurchaseLineStockIn(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    userId: string;
    invoiceDate: Date;
    invoiceRef: string;
    filePath: string;
    notes: string | null;
    vendorId: string;
    itemId: string;
    purchaseInvoiceLineId: string;
    stockQty: number;
    costUnitPrice: number;
    costTotalPrice: number;
  }
): Promise<void> {
  const locked = await lockInventoryItemRow(tx, params.itemId);
  if (!locked || !locked.active) {
    throw new Error("One or more items are missing from the catalog.");
  }
  const currentStock = inventoryQtyFromDecimal(locked.currentStock);
  const avgUnitCost = decimalToNumber(locked.avgUnitCost);
  const newAvg = nextWeightedAvgUnitCost({
    currentStock,
    avgUnitCost,
    purchaseQty: params.stockQty,
    purchaseUnitPrice: params.costUnitPrice,
  });
  const newStock = normalizeInventoryQty(currentStock + params.stockQty);

  const movement = await tx.inventoryMovement.create({
    data: {
      companyId: params.companyId,
      itemId: params.itemId,
      type: "PURCHASE",
      quantity: toDecimal(params.stockQty),
      unitCost: toDecimal(params.costUnitPrice),
      totalCost: toDecimal(params.costTotalPrice),
      movedAt: params.invoiceDate,
      notes: params.notes,
      createdById: params.userId,
    },
  });

  await tx.inventoryPurchase.create({
    data: {
      companyId: params.companyId,
      itemId: params.itemId,
      vendorId: params.vendorId,
      purchasedAt: params.invoiceDate,
      quantity: toDecimal(params.stockQty),
      unitPrice: toDecimal(params.costUnitPrice),
      totalPrice: toDecimal(params.costTotalPrice),
      invoiceNo: params.invoiceRef,
      receiptUrl: params.filePath,
      notes: params.notes,
      movementId: movement.id,
      purchaseInvoiceLineId: params.purchaseInvoiceLineId,
      createdById: params.userId,
    },
  });

  await tx.inventoryItem.update({
    where: { id: params.itemId },
    data: {
      currentStock: toDecimal(newStock),
      lastUnitCost:
        params.costUnitPrice > 0
          ? toDecimal(params.costUnitPrice)
          : locked.lastUnitCost,
      avgUnitCost: toDecimal(newAvg),
    },
  });
}

/**
 * Stock-in purchase lines that have not yet hit the warehouse.
 * Used when an import arrives in Jakarta after the factory order was saved.
 */
export async function stockInPendingPurchaseLines(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    userId: string;
    invoice: {
      id: string;
      invoiceDate: Date;
      invoiceRef: string;
      filePath: string;
      notes: string | null;
      vendorId: string | null;
      purpose: PurchasePurpose;
      purchaseCategory: PurchaseCategory;
    };
  }
): Promise<void> {
  if (
    !purchaseCreatesStock(params.invoice.purpose, params.invoice.purchaseCategory)
  ) {
    return;
  }
  if (!params.invoice.vendorId) return;

  const lines = await tx.purchaseInvoiceLine.findMany({
    where: { purchaseInvoiceId: params.invoice.id },
    include: {
      item: {
        select: { id: true, tracksStock: true, itemType: true },
      },
      inventoryPurchase: { select: { id: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  for (const line of lines) {
    if (!line.itemId || !line.item?.tracksStock) continue;
    if (line.inventoryPurchase) continue;

    const stockQty = normalizeInventoryQty(decimalToNumber(line.quantity));
    if (stockQty <= 0) continue;
    if (
      isEquipmentItemType(line.item.itemType) &&
      !isWholeInventoryQty(stockQty)
    ) {
      throw new Error("Equipment quantity must be a whole number.");
    }

    const costTotalPrice = decimalToNumber(line.totalPrice);
    const costUnitPrice =
      stockQty > 0
        ? Math.round((costTotalPrice / stockQty) * 100) / 100
        : decimalToNumber(line.unitPrice);

    await applyPurchaseLineStockIn(tx, {
      companyId: params.companyId,
      userId: params.userId,
      invoiceDate: params.invoice.invoiceDate,
      invoiceRef: params.invoice.invoiceRef,
      filePath: params.invoice.filePath,
      notes: params.invoice.notes,
      vendorId: params.invoice.vendorId,
      itemId: line.itemId,
      purchaseInvoiceLineId: line.id,
      stockQty,
      costUnitPrice,
      costTotalPrice,
    });
  }
}
