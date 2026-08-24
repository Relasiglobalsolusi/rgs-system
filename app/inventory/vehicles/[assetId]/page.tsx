import { notFound } from "next/navigation";

import VehicleDetailPage from "@/components/inventory/VehicleDetailPage";
import AppShell from "@/components/layout/AppShell";
import { isVehicleItemType } from "@/lib/inventory-sku";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { canManageInventory } from "@/lib/project-access";
import { requireModule, toPermissionUser } from "@/lib/session";

export default async function InventoryVehiclePage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const session = await requireModule("inventory");
  const permissionUser = toPermissionUser(session);
  const { assetId } = await params;
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) notFound();

  const asset = await prisma.equipmentAsset.findFirst({
    where: { id: assetId, companyId: company.id },
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
  });
  if (!asset || !isVehicleItemType(asset.item?.itemType)) {
    notFound();
  }

  return (
    <AppShell
      title={asset.assetCode}
    >
      <VehicleDetailPage
        canManage={canManageInventory(permissionUser)}
        vehicle={{
          id: asset.id,
          assetCode: asset.assetCode,
          status: asset.status,
          unitCost: decimalToNumber(asset.unitCost),
          serialNo: asset.serialNo,
          notes: asset.notes,
          assignedAt: asset.assignedAt?.toISOString() ?? null,
          writeOffMovementId: asset.writeOffMovementId,
          soldOffMovementId: asset.soldOffMovementId,
          soldBuyer: null,
          soldAt: null,
          vehicleYear: asset.vehicleYear,
          createdAt: asset.createdAt.toISOString(),
          item: asset.item,
          project: asset.project,
        }}
      />
    </AppShell>
  );
}
