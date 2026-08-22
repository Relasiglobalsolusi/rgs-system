import type { Prisma } from "@prisma/client";

import { deleteEquipmentAssetsMintedForPurchase, isEquipmentItemType } from "@/lib/equipment-asset";
import {
  inventoryQtyFromDecimal,
  normalizeInventoryQty,
  reverseWeightedAvgUnitCost,
  toDecimal,
} from "@/lib/inventory";
import { lockInventoryItemRow } from "@/lib/inventory-access";
import { decimalToNumber } from "@/lib/project-billing";

type ReverseDb = Prisma.TransactionClient;

/**
 * Undo every side effect of a purchase, then mark it reversed.
 * Product / import: void stock-in, drop on-hand, remove unused equipment units.
 * Service on a project: the bill leaves that job (reversedAt).
 * Petty Cash top-up: void the matching float entry.
 */
export async function unwindAndReversePurchaseInvoice(
  tx: ReverseDb,
  options: {
    companyId: string;
    userId: string;
    invoiceId: string;
    reason: string;
  }
): Promise<{
  amount: number;
  paidAt: Date | null;
  projectId: string | null;
}> {
  const invoice = await tx.purchaseInvoice.findFirst({
    where: {
      id: options.invoiceId,
      companyId: options.companyId,
      reversedAt: null,
    },
    include: {
      lines: {
        include: {
          inventoryPurchase: {
            include: {
              movement: {
                select: {
                  id: true,
                  voidedAt: true,
                },
              },
            },
          },
          item: { select: { itemType: true } },
        },
      },
      pettyCashEntry: { select: { id: true, status: true } },
    },
  });
  if (!invoice) {
    throw new Error("Purchase not found.");
  }

  const voidReason = options.reason.trim();

  for (const line of invoice.lines) {
    const purchase = line.inventoryPurchase;
    if (!purchase || purchase.movement.voidedAt) continue;

    const qty = inventoryQtyFromDecimal(purchase.quantity);
    const unitPrice = decimalToNumber(purchase.unitPrice) ?? 0;
    if (qty <= 0) continue;

    const locked = await lockInventoryItemRow(tx, purchase.itemId);
    if (!locked) {
      throw new Error("One or more items are missing from the catalog.");
    }

    const currentStock = inventoryQtyFromDecimal(locked.currentStock);
    if (currentStock + 1e-9 < qty) {
      throw new Error(
        "Cannot reverse this purchase. Some of this stock has already been issued or sold. Return or reverse those first."
      );
    }

    const itemType = line.item?.itemType ?? "";
    if (isEquipmentItemType(itemType)) {
      // New purchases stay uncoded. Only leftover AVAILABLE units minted in
      // this purchase window are deleted; an empty window is a no-op.
      await deleteEquipmentAssetsMintedForPurchase(tx, {
        companyId: options.companyId,
        itemId: purchase.itemId,
        qty,
        purchasedAt: invoice.createdAt,
      });
    }

    const voided = await tx.inventoryMovement.updateMany({
      where: {
        id: purchase.movement.id,
        voidedAt: null,
        type: "PURCHASE",
      },
      data: {
        voidedAt: new Date(),
        voidReason,
      },
    });
    if (voided.count !== 1) {
      throw new Error("This purchase stock movement was already reversed.");
    }

    const newStock = normalizeInventoryQty(currentStock - qty);
    const newAvg = reverseWeightedAvgUnitCost({
      currentStock,
      avgUnitCost: decimalToNumber(locked.avgUnitCost),
      removeQty: qty,
      removeUnitPrice: unitPrice,
    });
    const lastOpenPurchase = await tx.inventoryMovement.findFirst({
      where: {
        itemId: purchase.itemId,
        type: "PURCHASE",
        voidedAt: null,
      },
      orderBy: [{ movedAt: "desc" }, { createdAt: "desc" }],
      select: { unitCost: true },
    });

    await tx.inventoryItem.update({
      where: { id: purchase.itemId },
      data: {
        currentStock: toDecimal(newStock),
        avgUnitCost: newStock > 0 ? toDecimal(newAvg) : null,
        lastUnitCost: lastOpenPurchase?.unitCost ?? null,
      },
    });
  }

  await tx.loanMovement.updateMany({
    where: {
      purchaseInvoiceId: invoice.id,
      reversedAt: null,
    },
    data: { reversedAt: new Date() },
  });

  if (invoice.pettyCashEntry && invoice.pettyCashEntry.status !== "VOIDED") {
    await tx.pettyCashEntry.update({
      where: { id: invoice.pettyCashEntry.id },
      data: { status: "VOIDED" },
    });
  }

  await tx.purchaseInvoice.update({
    where: { id: invoice.id },
    data: {
      reversedAt: new Date(),
      reversedById: options.userId,
      notes: invoice.notes
        ? `${invoice.notes}\nReversed: ${voidReason}`
        : `Reversed: ${voidReason}`,
    },
  });

  return {
    amount: decimalToNumber(invoice.amount) ?? 0,
    paidAt: invoice.paidAt,
    projectId: invoice.projectId,
  };
}
