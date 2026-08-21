import type { Prisma } from "@prisma/client";

import {
  countEquipmentAssetsByStatus,
  isEquipmentItemType,
  shrinkOrVoidEquipmentIssueMovements,
  uncodedWarehouseQty,
} from "@/lib/equipment-asset";
import {
  inventoryQtyFromDecimal,
  movementTotalCost,
  normalizeInventoryQty,
  toDecimal,
} from "@/lib/inventory";
import { decimalToNumber } from "@/lib/project-billing";

type DbClient = Prisma.TransactionClient;

export type FactoryReturnIntentValue = "REFUND" | "REPAIR" | "REPLACE";
export type FactoryReturnSourceValue = "new" | "issued";

function catalogUnitCost(item: {
  avgUnitCost: Prisma.Decimal | null;
  lastUnitCost: Prisma.Decimal | null;
}): number {
  return Math.max(
    0,
    decimalToNumber(item.avgUnitCost) ?? decimalToNumber(item.lastUnitCost) ?? 0
  );
}

async function createFactoryStockMovement(
  db: DbClient,
  options: {
    companyId: string;
    itemId: string;
    type: "RETURN_TO_FACTORY" | "RECEIVE_FROM_FACTORY";
    quantity: number;
    unitCost: number;
    movedAt: Date;
    notes: string;
    createdById: string;
  }
) {
  const signedQty =
    options.type === "RETURN_TO_FACTORY"
      ? -Math.abs(options.quantity)
      : Math.abs(options.quantity);
  return db.inventoryMovement.create({
    data: {
      companyId: options.companyId,
      itemId: options.itemId,
      type: options.type,
      quantity: toDecimal(signedQty),
      unitCost: toDecimal(options.unitCost),
      totalCost: toDecimal(
        movementTotalCost(Math.abs(options.quantity), options.unitCost)
      ),
      movedAt: options.movedAt,
      notes: options.notes,
      createdById: options.createdById,
    },
  });
}

export async function sendEquipmentToFactoryInTx(
  db: DbClient,
  options: {
    companyId: string;
    itemId: string;
    source: FactoryReturnSourceValue;
    intent: FactoryReturnIntentValue;
    quantity: number;
    assetIds: string[];
    reason: string;
    vendorId: string | null;
    refundAmount: number | null;
    sentAt: Date;
    createdById: string;
  }
): Promise<{ itemId: string; projectIds: string[] }> {
  const item = await db.inventoryItem.findFirst({
    where: { id: options.itemId, companyId: options.companyId },
    select: {
      id: true,
      itemType: true,
      currentStock: true,
      avgUnitCost: true,
      lastUnitCost: true,
    },
  });
  if (!item || !isEquipmentItemType(item.itemType)) {
    throw new Error("ITEM_NOT_EQUIPMENT");
  }

  const currentStock = inventoryQtyFromDecimal(item.currentStock);
  const counts = await countEquipmentAssetsByStatus(db, item.id);
  const uncoded = uncodedWarehouseQty(currentStock, counts.available);
  const unitCost = catalogUnitCost(item);
  const closesNow = options.intent === "REFUND";
  const status = closesNow ? "REFUNDED" : "WAITING";
  const refundedAt = closesNow ? options.sentAt : null;
  const notes = `Return To Vendor: ${options.reason}`;
  const projectIds: string[] = [];

  if (options.source === "new") {
    if (options.quantity <= 0 || options.quantity > uncoded) {
      throw new Error("INSUFFICIENT_UNCODED");
    }
    const movement = await createFactoryStockMovement(db, {
      companyId: options.companyId,
      itemId: item.id,
      type: "RETURN_TO_FACTORY",
      quantity: options.quantity,
      unitCost,
      movedAt: options.sentAt,
      notes,
      createdById: options.createdById,
    });
    await db.inventoryItem.update({
      where: { id: item.id },
      data: {
        currentStock: toDecimal(
          normalizeInventoryQty(currentStock - options.quantity)
        ),
      },
    });
    await db.equipmentFactoryReturn.create({
      data: {
        companyId: options.companyId,
        itemId: item.id,
        quantity: toDecimal(options.quantity),
        sentAt: options.sentAt,
        originalIntent: options.intent,
        status,
        reason: options.reason,
        vendorId: options.vendorId,
        refundAmount:
          options.refundAmount != null ? toDecimal(options.refundAmount) : null,
        refundedAt,
        createdById: options.createdById,
        closedById: closesNow ? options.createdById : null,
        sendMovementId: movement.id,
      },
    });
    return { itemId: item.id, projectIds };
  }

  const assetIds = [...new Set(options.assetIds.filter(Boolean))];
  if (assetIds.length === 0) {
    throw new Error("ASSETS_REQUIRED");
  }
  const assets = await db.equipmentAsset.findMany({
    where: {
      id: { in: assetIds },
      companyId: options.companyId,
      itemId: item.id,
      status: { in: ["AVAILABLE", "ON_PROJECT"] },
    },
    select: {
      id: true,
      status: true,
      projectId: true,
      movementId: true,
      issueMovementId: true,
      unitCost: true,
    },
  });
  if (assets.length !== assetIds.length) {
    throw new Error("ASSETS_REQUIRED");
  }

  const warehouseAssets = assets.filter((asset) => asset.status === "AVAILABLE");
  const siteAssets = assets.filter((asset) => asset.status === "ON_PROJECT");
  if (warehouseAssets.length > currentStock) {
    throw new Error("INSUFFICIENT_STOCK");
  }

  let sendMovementId: string | null = null;
  if (warehouseAssets.length > 0) {
    const warehouseCost = warehouseAssets.reduce((sum, asset) => {
      return sum + (decimalToNumber(asset.unitCost) ?? unitCost);
    }, 0);
    const movement = await createFactoryStockMovement(db, {
      companyId: options.companyId,
      itemId: item.id,
      type: "RETURN_TO_FACTORY",
      quantity: warehouseAssets.length,
      unitCost:
        warehouseAssets.length > 0
          ? warehouseCost / warehouseAssets.length
          : unitCost,
      movedAt: options.sentAt,
      notes,
      createdById: options.createdById,
    });
    sendMovementId = movement.id;
    await db.inventoryItem.update({
      where: { id: item.id },
      data: {
        currentStock: toDecimal(
          normalizeInventoryQty(currentStock - warehouseAssets.length)
        ),
      },
    });
  }

  await db.equipmentAsset.updateMany({
    where: { id: { in: assets.map((asset) => asset.id) } },
    data: {
      status: "AT_FACTORY",
      projectId: null,
      movementId: null,
      issueMovementId: null,
      assignedAt: null,
      notes,
    },
  });

  const issueMovementIds = [
    ...new Set(
      siteAssets.flatMap((asset) =>
        [asset.movementId, asset.issueMovementId].filter(
          (id): id is string => Boolean(id)
        )
      )
    ),
  ];
  await shrinkOrVoidEquipmentIssueMovements(
    db,
    options.companyId,
    issueMovementIds,
    "Returned To Vendor from site"
  );
  projectIds.push(
    ...siteAssets
      .map((asset) => asset.projectId)
      .filter((id): id is string => Boolean(id))
  );

  await db.equipmentFactoryReturn.createMany({
    data: assets.map((asset, index) => ({
      companyId: options.companyId,
      itemId: item.id,
      assetId: asset.id,
      quantity: toDecimal(1),
      sentAt: options.sentAt,
      originalIntent: options.intent,
      status,
      reason: options.reason,
      vendorId: options.vendorId,
      refundAmount:
        options.refundAmount != null && index === 0
          ? toDecimal(options.refundAmount)
          : null,
      refundedAt,
      createdById: options.createdById,
      closedById: closesNow ? options.createdById : null,
      sendMovementId: warehouseAssets.some((row) => row.id === asset.id)
        ? sendMovementId
        : null,
    })),
  });

  return { itemId: item.id, projectIds: [...new Set(projectIds)] };
}

export async function recordFactoryRefundInTx(
  db: DbClient,
  options: {
    companyId: string;
    returnId: string;
    refundAmount: number;
    closedById: string;
    refundedAt: Date;
  }
): Promise<{ itemId: string }> {
  const row = await db.equipmentFactoryReturn.findFirst({
    where: {
      id: options.returnId,
      companyId: options.companyId,
      status: "WAITING",
    },
    select: { id: true, itemId: true },
  });
  if (!row) throw new Error("FACTORY_RETURN_NOT_WAITING");

  await db.equipmentFactoryReturn.update({
    where: { id: row.id },
    data: {
      status: "REFUNDED",
      refundAmount: toDecimal(options.refundAmount),
      refundedAt: options.refundedAt,
      closedById: options.closedById,
    },
  });
  return { itemId: row.itemId };
}

export async function confirmFactoryRepairedInTx(
  db: DbClient,
  options: {
    companyId: string;
    returnId: string;
    closedById: string;
    receivedAt: Date;
  }
): Promise<{ itemId: string }> {
  const row = await db.equipmentFactoryReturn.findFirst({
    where: {
      id: options.returnId,
      companyId: options.companyId,
      status: "WAITING",
    },
    include: {
      item: {
        select: {
          id: true,
          currentStock: true,
          avgUnitCost: true,
          lastUnitCost: true,
        },
      },
      asset: { select: { id: true, status: true } },
    },
  });
  if (!row) throw new Error("FACTORY_RETURN_NOT_WAITING");

  const quantity = Math.max(1, Math.round(inventoryQtyFromDecimal(row.quantity)));
  const unitCost = catalogUnitCost(row.item);
  const movement = await createFactoryStockMovement(db, {
    companyId: options.companyId,
    itemId: row.itemId,
    type: "RECEIVE_FROM_FACTORY",
    quantity,
    unitCost,
    movedAt: options.receivedAt,
    notes: row.assetId
      ? "Vendor repair — same machine returned"
      : "Vendor repair — new warehouse stock returned",
    createdById: options.closedById,
  });

  if (row.assetId) {
    if (row.asset?.status !== "AT_FACTORY") {
      throw new Error("FACTORY_RETURN_NOT_WAITING");
    }
    await db.equipmentAsset.update({
      where: { id: row.assetId },
      data: {
        status: "AVAILABLE",
        projectId: null,
        movementId: null,
        issueMovementId: null,
        assignedAt: null,
        notes: "Returned from vendor — repaired",
      },
    });
  }

  const currentStock = inventoryQtyFromDecimal(row.item.currentStock);
  await db.inventoryItem.update({
    where: { id: row.itemId },
    data: {
      currentStock: toDecimal(normalizeInventoryQty(currentStock + quantity)),
    },
  });
  await db.equipmentFactoryReturn.update({
    where: { id: row.id },
    data: {
      status: "REPAIRED",
      receivedAt: options.receivedAt,
      closedById: options.closedById,
      receiveMovementId: movement.id,
    },
  });
  return { itemId: row.itemId };
}

export async function receiveFactoryReplacementInTx(
  db: DbClient,
  options: {
    companyId: string;
    returnId: string;
    closedById: string;
    receivedAt: Date;
  }
): Promise<{ itemId: string }> {
  const row = await db.equipmentFactoryReturn.findFirst({
    where: {
      id: options.returnId,
      companyId: options.companyId,
      status: "WAITING",
    },
    include: {
      item: {
        select: {
          id: true,
          currentStock: true,
          avgUnitCost: true,
          lastUnitCost: true,
        },
      },
    },
  });
  if (!row) throw new Error("FACTORY_RETURN_NOT_WAITING");

  const quantity = Math.max(1, Math.round(inventoryQtyFromDecimal(row.quantity)));
  const unitCost = catalogUnitCost(row.item);
  const movement = await createFactoryStockMovement(db, {
    companyId: options.companyId,
    itemId: row.itemId,
    type: "RECEIVE_FROM_FACTORY",
    quantity,
    unitCost,
    movedAt: options.receivedAt,
    notes: "Vendor replacement — new warehouse stock, no asset code",
    createdById: options.closedById,
  });

  const currentStock = inventoryQtyFromDecimal(row.item.currentStock);
  await db.inventoryItem.update({
    where: { id: row.itemId },
    data: {
      currentStock: toDecimal(normalizeInventoryQty(currentStock + quantity)),
    },
  });
  await db.equipmentFactoryReturn.update({
    where: { id: row.id },
    data: {
      status: "REPLACED",
      receivedAt: options.receivedAt,
      closedById: options.closedById,
      receiveMovementId: movement.id,
    },
  });
  return { itemId: row.itemId };
}
