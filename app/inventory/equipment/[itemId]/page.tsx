import { notFound } from "next/navigation";

import EquipmentProductPage from "@/components/inventory/EquipmentProductPage";
import AppShell from "@/components/layout/AppShell";
import { getInventoryStockItemDetail } from "@/app/inventory/actions";
import { canReturnEquipmentToFactory } from "@/lib/inventory-access";
import { inventoryQtyFromDecimal } from "@/lib/inventory";
import { isEquipmentItemType } from "@/lib/equipment-asset";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { canManageInventory } from "@/lib/project-access";
import { requireModule, toPermissionUser } from "@/lib/session";

export default async function EquipmentItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const session = await requireModule("inventory");
  const permissionUser = toPermissionUser(session);
  const { itemId } = await params;
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) notFound();

  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, companyId: company.id, deletedAt: null },
  });
  if (!item || !isEquipmentItemType(item.itemType)) {
    notFound();
  }

  const [detail, assetRows, factoryRows, uncodedSaleRows, vendors] =
    await Promise.all([
      getInventoryStockItemDetail(item.id),
      prisma.equipmentAsset.findMany({
        where: { companyId: company.id, itemId: item.id },
        select: {
          id: true,
          assetCode: true,
          status: true,
          unitCost: true,
          serialNo: true,
          notes: true,
          assignedAt: true,
          writeOffMovementId: true,
          soldOffMovementId: true,
          vehicleYear: true,
          createdAt: true,
          item: {
            select: { id: true, sku: true, name: true, itemType: true },
          },
          project: { select: { id: true, name: true } },
        },
        orderBy: [{ assetCode: "asc" }],
      }),
      prisma.equipmentFactoryReturn.findMany({
        where: { companyId: company.id, itemId: item.id },
        include: {
          asset: { select: { assetCode: true } },
          vendor: { select: { name: true } },
          createdBy: { select: { id: true, name: true, username: true } },
        },
        orderBy: { sentAt: "desc" },
      }),
      prisma.inventorySale.findMany({
        where: {
          companyId: company.id,
          itemId: item.id,
          movement: {
            voidedAt: null,
            equipmentAssetsFromSoldOff: { none: {} },
          },
        },
        select: {
          id: true,
          soldAt: true,
          quantity: true,
          buyer: true,
          client: { select: { name: true } },
        },
        orderBy: { soldAt: "desc" },
      }),
      prisma.vendor.findMany({
        where: { companyId: company.id, active: true },
        select: { id: true, name: true, shortCode: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const soldMovementIds = [
    ...new Set(
      assetRows
        .map((row) => row.soldOffMovementId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const soldSales =
    soldMovementIds.length > 0
      ? await prisma.inventorySale.findMany({
          where: {
            companyId: company.id,
            movementId: { in: soldMovementIds },
          },
          select: {
            movementId: true,
            soldAt: true,
            buyer: true,
            client: { select: { name: true } },
          },
        })
      : [];
  const saleByMovement = new Map(
    soldSales.map((sale) => [
      sale.movementId,
      {
        buyer: sale.buyer?.trim() || sale.client?.name?.trim() || null,
        soldAt: sale.soldAt.toISOString(),
      },
    ])
  );

  const canReturnToFactory =
    canManageInventory(permissionUser) &&
    (await canReturnEquipmentToFactory(session.user.id, {
      ...permissionUser,
      username: session.user.username,
    }));

  return (
    <AppShell title={item.name} descriptionKey="pages.inventory.product.description">
      <EquipmentProductPage
        item={{
          id: item.id,
          sku: item.sku,
          name: item.name,
          itemType: item.itemType,
          description: item.description,
          unit: item.unit,
          minStock: inventoryQtyFromDecimal(item.minStock),
          currentStock: inventoryQtyFromDecimal(item.currentStock),
          lastUnitCost: decimalToNumber(item.lastUnitCost),
          avgUnitCost: decimalToNumber(item.avgUnitCost),
          active: item.active,
        }}
        detail={detail}
        equipmentAssets={assetRows.map((row) => {
          const sale = row.soldOffMovementId
            ? saleByMovement.get(row.soldOffMovementId)
            : undefined;
          return {
            id: row.id,
            assetCode: row.assetCode,
            status: row.status,
            unitCost: decimalToNumber(row.unitCost),
            serialNo: row.serialNo,
            notes: row.notes,
            assignedAt: row.assignedAt?.toISOString() ?? null,
            writeOffMovementId: row.writeOffMovementId,
            soldOffMovementId: row.soldOffMovementId,
            soldBuyer: sale?.buyer ?? null,
            soldAt: sale?.soldAt ?? null,
            vehicleYear: row.vehicleYear,
            createdAt: row.createdAt.toISOString(),
            item: row.item,
            project: row.project,
          };
        })}
        factoryReturns={factoryRows.map((row) => ({
          id: row.id,
          sentAt: row.sentAt.toISOString(),
          originalIntent: row.originalIntent,
          status: row.status,
          reason: row.reason,
          quantity: inventoryQtyFromDecimal(row.quantity),
          refundAmount: decimalToNumber(row.refundAmount),
          refundedAt: row.refundedAt?.toISOString() ?? null,
          receivedAt: row.receivedAt?.toISOString() ?? null,
          vendorName: row.vendor?.name ?? null,
          assetCode: row.asset?.assetCode ?? null,
          item: { id: item.id, sku: item.sku, name: item.name },
          createdBy: row.createdBy,
        }))}
        uncodedSales={uncodedSaleRows.map((row) => ({
          id: row.id,
          soldAt: row.soldAt.toISOString(),
          quantity: inventoryQtyFromDecimal(row.quantity),
          buyer: row.buyer?.trim() || row.client?.name?.trim() || null,
        }))}
        vendors={vendors}
        canReturnToFactory={canReturnToFactory}
      />
    </AppShell>
  );
}
