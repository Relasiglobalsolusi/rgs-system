import type { Prisma } from "@prisma/client";

import {
  assignInTransitEquipmentAssetsToProject,
  isEquipmentItemType,
  retireInTransitEquipmentAssets,
  returnInTransitEquipmentAssetsToWarehouse,
} from "@/lib/equipment-asset";
import {
  inventoryQtyFromDecimal,
  movementTotalCost,
  normalizeInventoryQty,
  toDecimal,
} from "@/lib/inventory";
import { lockInventoryItemRow } from "@/lib/inventory-access";
import { decimalToNumber } from "@/lib/project-billing";

export function transferOrderInTransitNote(orderId: string) {
  return `Transfer order in transit: ${orderId}`;
}

export function transferOrderIssueNote(orderId: string) {
  return `Transfer order received: ${orderId}`;
}

export function transferOrderReturnNote(orderId: string) {
  return `Item return: ${orderId}`;
}

export function transferOrderWriteOffNote(orderId: string) {
  return `Item return write-off: ${orderId}`;
}

export async function findInTransitMovements(
  tx: Prisma.TransactionClient,
  companyId: string,
  projectId: string,
  orderId: string
) {
  return tx.inventoryMovement.findMany({
    where: {
      companyId,
      projectId,
      type: "IN_TRANSIT",
      voidedAt: null,
      notes: transferOrderInTransitNote(orderId),
    },
  });
}

/** Restore warehouse stock from in-transit lines. Does not book project cost. */
export async function returnInTransitStockToWarehouse(
  tx: Prisma.TransactionClient,
  options: {
    companyId: string;
    orderId: string;
    projectId: string;
    userId: string;
  }
) {
  const movements = await findInTransitMovements(
    tx,
    options.companyId,
    options.projectId,
    options.orderId
  );
  const movedAt = new Date();

  for (const transit of movements) {
    const quantity = Math.abs(inventoryQtyFromDecimal(transit.quantity));
    const locked = await lockInventoryItemRow(tx, transit.itemId);
    if (!locked) continue;
    const currentStock = inventoryQtyFromDecimal(locked.currentStock);
    const unitCost = decimalToNumber(transit.unitCost) ?? 0;

    await tx.inventoryMovement.create({
      data: {
        companyId: options.companyId,
        itemId: transit.itemId,
        projectId: options.projectId,
        type: "ADJUSTMENT",
        quantity: toDecimal(quantity),
        unitCost: toDecimal(unitCost),
        totalCost: toDecimal(movementTotalCost(quantity, unitCost)),
        movedAt,
        notes: transferOrderReturnNote(options.orderId),
        createdById: options.userId,
      },
    });

    await tx.inventoryItem.update({
      where: { id: transit.itemId },
      data: {
        currentStock: toDecimal(normalizeInventoryQty(currentStock + quantity)),
      },
    });

    await returnInTransitEquipmentAssetsToWarehouse(
      tx,
      options.companyId,
      transit.id
    );
  }

  return movements.length;
}

/** Write off in-transit stock. Warehouse qty already left on send — do not reduce again. */
export async function writeOffInTransitStock(
  tx: Prisma.TransactionClient,
  options: {
    companyId: string;
    orderId: string;
    projectId: string;
    userId: string;
  }
) {
  const movements = await findInTransitMovements(
    tx,
    options.companyId,
    options.projectId,
    options.orderId
  );
  const movedAt = new Date();

  for (const transit of movements) {
    const quantity = Math.abs(inventoryQtyFromDecimal(transit.quantity));
    const unitCost = decimalToNumber(transit.unitCost) ?? 0;
    const totalCost = decimalToNumber(transit.totalCost) ?? 0;
    const writeOff = await tx.inventoryMovement.create({
      data: {
        companyId: options.companyId,
        itemId: transit.itemId,
        projectId: options.projectId,
        type: "WRITE_OFF",
        quantity: toDecimal(-quantity),
        unitCost: toDecimal(unitCost),
        totalCost: toDecimal(totalCost),
        movedAt,
        notes: transferOrderWriteOffNote(options.orderId),
        createdById: options.userId,
      },
    });

    await retireInTransitEquipmentAssets(tx, options.companyId, transit.id, {
      writeOffMovementId: writeOff.id,
      notes: transferOrderWriteOffNote(options.orderId),
    });
  }

  return movements.length;
}

/** Book in-transit stock onto a project (receive or manager assign). */
export async function issueInTransitStockToProject(
  tx: Prisma.TransactionClient,
  options: {
    companyId: string;
    orderId: string;
    fromProjectId: string;
    toProjectId: string;
    userId: string;
    itemTypesByItemId: Map<string, string>;
  }
) {
  const movements = await findInTransitMovements(
    tx,
    options.companyId,
    options.fromProjectId,
    options.orderId
  );
  const movedAt = new Date();

  for (const transit of movements) {
    const quantity = Math.abs(inventoryQtyFromDecimal(transit.quantity));
    const unitCost = decimalToNumber(transit.unitCost) ?? 0;
    const totalCost = decimalToNumber(transit.totalCost) ?? 0;
    const isEquipment = isEquipmentItemType(
      options.itemTypesByItemId.get(transit.itemId) ?? ""
    );

    const issue = await tx.inventoryMovement.create({
      data: {
        companyId: options.companyId,
        itemId: transit.itemId,
        projectId: options.toProjectId,
        type: "ISSUE_TO_PROJECT",
        quantity: toDecimal(-quantity),
        unitCost: toDecimal(unitCost),
        totalCost: toDecimal(isEquipment ? 0 : totalCost),
        movedAt,
        notes: transferOrderIssueNote(options.orderId),
        createdById: options.userId,
      },
    });

    if (isEquipment) {
      await assignInTransitEquipmentAssetsToProject(
        tx,
        options.companyId,
        transit.itemId,
        options.toProjectId,
        quantity,
        {
          transitMovementId: transit.id,
          issueMovementId: issue.id,
          assignedAt: movedAt,
          fromProjectId: options.fromProjectId,
        }
      );
    }
  }

  return movements.length;
}
