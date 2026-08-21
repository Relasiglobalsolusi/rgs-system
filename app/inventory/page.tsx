import { prisma } from "@/lib/prisma";
import {
  canAssignInventoryToProject,
  canReturnEquipmentToFactory,
} from "@/lib/inventory-access";
import { canManageInventory } from "@/lib/project-access";
import { decimalToNumber } from "@/lib/project-billing";
import { inventoryQtyFromDecimal } from "@/lib/inventory";
import { requireModule, toPermissionUser } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import InventoryWorkspace from "@/components/inventory/InventoryWorkspace";
import T from "@/components/i18n/T";

const RECENT_PURCHASE_LIMIT = 200;

export default async function InventoryPage() {
  const session = await requireModule("inventory");
  const permissionUser = toPermissionUser(session);
  const canManage = canManageInventory(permissionUser);
  const canAssignToProject = await canAssignInventoryToProject(
    session.user.id,
    {
      ...permissionUser,
      username: session.user.username,
    }
  );
  const canReturnToFactory = await canReturnEquipmentToFactory(
    session.user.id,
    {
      ...permissionUser,
      username: session.user.username,
    }
  );

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    return (
      <AppShell
        titleKey="pages.inventory.title"
        descriptionKey="pages.inventory.description"
      >
        <p className="rounded-3xl border border-border bg-elevated p-8 text-text">
          <T k="pages.inventory.companyNotFound" />
        </p>
      </AppShell>
    );
  }

  const [
    items,
    purchases,
    issues,
    writeOffs,
    assetRows,
    factoryRows,
  ] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { companyId: company.id, deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.inventoryPurchase.findMany({
        where: { companyId: company.id, movement: { voidedAt: null } },
        include: {
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              unit: true,
              itemType: true,
            },
          },
          vendor: { select: { id: true, name: true, shortCode: true } },
        },
        orderBy: { purchasedAt: "desc" },
        take: RECENT_PURCHASE_LIMIT,
      }),
      prisma.inventoryMovement.findMany({
        where: {
          companyId: company.id,
          type: "ISSUE_TO_PROJECT",
          voidedAt: null,
        },
        include: {
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              unit: true,
              itemType: true,
            },
          },
          project: {
            select: { id: true, name: true, status: true },
          },
        },
        orderBy: { movedAt: "desc" },
        take: 200,
      }),
      prisma.inventoryMovement.findMany({
        where: {
          companyId: company.id,
          type: "WRITE_OFF",
          voidedAt: null,
        },
        include: {
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              unit: true,
              itemType: true,
            },
          },
          createdBy: {
            select: { id: true, name: true, username: true },
          },
        },
        orderBy: { movedAt: "desc" },
        take: 200,
      }),
      prisma.equipmentAsset.findMany({
        where: { companyId: company.id },
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
          item: {
            select: { id: true, sku: true, name: true, itemType: true },
          },
          project: { select: { id: true, name: true } },
        },
        orderBy: [{ assetCode: "asc" }],
      }),
      prisma.equipmentFactoryReturn.findMany({
        where: { companyId: company.id },
        include: {
          asset: { select: { assetCode: true } },
          vendor: { select: { name: true } },
          item: { select: { id: true, sku: true, name: true } },
          createdBy: { select: { id: true, name: true, username: true } },
        },
        orderBy: { sentAt: "desc" },
        take: 200,
      }),
    ]);

  const catalogItems = items.map((item) => ({
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
  }));

  const purchaseRows = purchases
    .filter((row) => row.item?.id != null && row.vendor?.id != null)
    .map((row) => ({
      id: row.id,
      purchasedAt: row.purchasedAt.toISOString(),
      quantity: Math.abs(inventoryQtyFromDecimal(row.quantity)),
      unitPrice: decimalToNumber(row.unitPrice) ?? 0,
      totalPrice: decimalToNumber(row.totalPrice) ?? 0,
      invoiceNo: row.invoiceNo,
      receiptUrl: row.receiptUrl,
      notes: row.notes,
      item: row.item!,
      vendor: row.vendor!,
    }));

  const issueRows = issues
    .filter((row) => row.item?.id != null)
    .map((row) => ({
      id: row.id,
      movedAt: row.movedAt.toISOString(),
      quantity: Math.abs(inventoryQtyFromDecimal(row.quantity)),
      unitCost: decimalToNumber(row.unitCost) ?? 0,
      totalCost: decimalToNumber(row.totalCost) ?? 0,
      notes: row.notes,
      item: row.item!,
      project: row.project,
    }));

  const writeOffRows = writeOffs
    .filter((row) => row.item?.id != null)
    .map((row) => ({
      id: row.id,
      movedAt: row.movedAt.toISOString(),
      quantity: Math.abs(inventoryQtyFromDecimal(row.quantity)),
      unitCost: decimalToNumber(row.unitCost) ?? 0,
      totalCost: decimalToNumber(row.totalCost) ?? 0,
      reason: row.notes ?? "",
      createdBy: row.createdBy,
      item: row.item!,
    }));

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

  const overviewAssets = assetRows
    .filter((a) => a.item?.id != null)
    .map((a) => {
      const sale = a.soldOffMovementId
        ? saleByMovement.get(a.soldOffMovementId)
        : undefined;
      return {
        id: a.id,
        assetCode: a.assetCode,
        status: a.status,
        unitCost: decimalToNumber(a.unitCost),
        serialNo: a.serialNo,
        notes: a.notes,
        assignedAt: a.assignedAt?.toISOString() ?? null,
        writeOffMovementId: a.writeOffMovementId,
        soldOffMovementId: a.soldOffMovementId,
        soldBuyer: sale?.buyer ?? null,
        soldAt: sale?.soldAt ?? null,
        item: a.item!,
        project: a.project,
      };
    });

  return (
    <AppShell
      titleKey="pages.inventory.title"
      descriptionKey={
        canManage
          ? "pages.inventory.descriptionManage"
          : "pages.inventory.descriptionReadonly"
      }
    >
      <InventoryWorkspace
        canManage={canManage}
        canAssignToProject={canAssignToProject}
        canReturnToFactory={canReturnToFactory}
        items={catalogItems}
        purchases={purchaseRows}
        issues={issueRows}
        writeOffs={writeOffRows}
        factoryReturns={factoryRows
          .filter((row) => row.item?.id != null)
          .map((row) => ({
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
            item: row.item!,
            createdBy: row.createdBy,
          }))}
        equipmentAssets={overviewAssets}
      />
    </AppShell>
  );
}
