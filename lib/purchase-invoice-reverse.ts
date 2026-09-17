import type { Prisma } from "@prisma/client";

import { deleteEquipmentAssetsMintedForPurchase, isEquipmentItemType } from "@/lib/equipment-asset";
import { isVehicleItemType } from "@/lib/inventory-sku";
import { returnVehicleCardsToPool } from "@/lib/prepaid-card-lifecycle";
import {
  inventoryQtyFromDecimal,
  normalizeInventoryQty,
  reverseWeightedAvgUnitCost,
  toDecimal,
} from "@/lib/inventory";
import { lockInventoryItemRow } from "@/lib/inventory-access";
import { isPrepaidCardTopUpInvoice, unwindPrepaidTopUpFromInvoice } from "@/lib/advance-cash-expense";
import { reverseCashSpendForPurchase } from "@/lib/company-cash";
import { decimalToNumber } from "@/lib/project-billing";
import { voidOdometerReadingForSource } from "@/lib/vehicle-odometer";

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

  if (invoice.vehicleAssetId && invoice.vehicleExpenseKind === "PURCHASE") {
    const asset = await tx.equipmentAsset.findFirst({
      where: { id: invoice.vehicleAssetId, companyId: options.companyId },
      select: {
        id: true,
        status: true,
        soldOffMovementId: true,
        writeOffMovementId: true,
      },
    });
    if (asset) {
      if (
        asset.status !== "AVAILABLE" ||
        asset.soldOffMovementId ||
        asset.writeOffMovementId
      ) {
        throw new Error(
          "This vehicle cannot be reversed. It is no longer Available. Use Sold Off if the car has left the company."
        );
      }
      const laterSpend = await tx.purchaseInvoice.findFirst({
        where: {
          companyId: options.companyId,
          vehicleAssetId: asset.id,
          reversedAt: null,
          NOT: { id: invoice.id },
        },
        select: { id: true },
      });
      if (laterSpend) {
        throw new Error(
          "This vehicle has later costs. Reverse those first, or use Sold Off."
        );
      }
      await returnVehicleCardsToPool(tx, {
        companyId: options.companyId,
        vehicleAssetIds: [asset.id],
      });
      await tx.equipmentAsset.delete({ where: { id: asset.id } });
    }
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
    if (isVehicleItemType(itemType)) {
      // Plate-coded vehicles are removed above when still Available.
    } else if (isEquipmentItemType(itemType)) {
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

  await tx.bpjsRemittance.deleteMany({
    where: { purchaseInvoiceId: invoice.id },
  });

  await tx.payrollDeduction.deleteMany({
    where: { purchaseInvoiceId: invoice.id },
  });

  if (invoice.pettyCashEntry && invoice.pettyCashEntry.status !== "VOIDED") {
    await tx.pettyCashEntry.update({
      where: { id: invoice.pettyCashEntry.id },
      data: { status: "VOIDED" },
    });
  }

  if (isPrepaidCardTopUpInvoice(invoice)) {
    await unwindPrepaidTopUpFromInvoice(tx, invoice);
  }

  await reverseCashSpendForPurchase(tx, invoice.id);

  await voidOdometerReadingForSource(tx, {
    purchaseInvoiceId: invoice.id,
  });

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
