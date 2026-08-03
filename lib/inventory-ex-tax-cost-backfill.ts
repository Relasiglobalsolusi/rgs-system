/**
 * Correct stock / asset costs that were stored tax-inclusive from Finance
 * purchase invoices (includesPpn).
 *
 * Detectable only when:
 * - InventoryPurchase is linked to a PurchaseInvoiceLine
 * - Invoice includesPpn with a stored rate
 * - Stored purchase unitPrice still equals the invoice line unitPrice (gross)
 *
 * Caveat: catalog avgUnitCost / lastUnitCost and already-posted SOLD_OFF
 * costBasis are not recomputed here — those may still reflect inclusive costs
 * until affected items are reviewed or re-purchased.
 */
import type { Prisma } from "@prisma/client";

import {
  inventoryQtyFromDecimal,
  toDecimal,
} from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import {
  exclusiveUnitCostFromInclusive,
  ppnRateFromPercent,
} from "@/lib/vat";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function backfillInclusivePurchaseCostsToExTax(
  db: DbClient = prisma
): Promise<{
  purchasesUpdated: number;
  movementsUpdated: number;
  assetsUpdated: number;
}> {
  const purchases = await db.inventoryPurchase.findMany({
    where: {
      purchaseInvoiceLineId: { not: null },
      purchaseInvoiceLine: {
        purchaseInvoice: {
          includesPpn: true,
          ppnRatePercent: { not: null },
        },
      },
    },
    select: {
      id: true,
      itemId: true,
      quantity: true,
      unitPrice: true,
      movementId: true,
      createdAt: true,
      purchaseInvoiceLine: {
        select: {
          unitPrice: true,
          purchaseInvoice: {
            select: { ppnRatePercent: true },
          },
        },
      },
    },
  });

  let purchasesUpdated = 0;
  let movementsUpdated = 0;
  let assetsUpdated = 0;

  for (const purchase of purchases) {
    const line = purchase.purchaseInvoiceLine;
    if (!line) continue;

    const ratePercent = decimalToNumber(line.purchaseInvoice.ppnRatePercent);
    if (ratePercent == null || ratePercent <= 0) continue;

    const storedUnit = decimalToNumber(purchase.unitPrice);
    const lineUnit = decimalToNumber(line.unitPrice);
    if (storedUnit == null || lineUnit == null) continue;
    // Only rewrite when stock cost still matches the tax-inclusive invoice line.
    if (Math.abs(storedUnit - lineUnit) > 0.009) continue;

    const rate = ppnRateFromPercent(ratePercent);
    const exTaxUnit = exclusiveUnitCostFromInclusive(lineUnit, rate);
    if (Math.abs(exTaxUnit - storedUnit) < 0.009) continue;

    const qty = inventoryQtyFromDecimal(purchase.quantity);
    const exTaxTotal = qty * exTaxUnit;

    await db.inventoryPurchase.update({
      where: { id: purchase.id },
      data: {
        unitPrice: toDecimal(exTaxUnit),
        totalPrice: toDecimal(exTaxTotal),
      },
    });
    purchasesUpdated++;

    await db.inventoryMovement.update({
      where: { id: purchase.movementId },
      data: {
        unitCost: toDecimal(exTaxUnit),
        totalCost: toDecimal(exTaxTotal),
      },
    });
    movementsUpdated++;

    // Assets minted with the inclusive unit cost around this purchase.
    const windowStart = new Date(purchase.createdAt.getTime() - 60_000);
    const windowEnd = new Date(purchase.createdAt.getTime() + 60_000);
    const assetResult = await db.equipmentAsset.updateMany({
      where: {
        itemId: purchase.itemId,
        unitCost: toDecimal(storedUnit),
        createdAt: { gte: windowStart, lte: windowEnd },
      },
      data: { unitCost: toDecimal(exTaxUnit) },
    });
    assetsUpdated += assetResult.count;
  }

  return { purchasesUpdated, movementsUpdated, assetsUpdated };
}
