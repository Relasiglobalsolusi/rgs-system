import { notFound } from "next/navigation";

import VehicleDetailPage from "@/components/inventory/VehicleDetailPage";
import AppShell from "@/components/layout/AppShell";
import { isVehicleItemType } from "@/lib/inventory-sku";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { canManageInventory } from "@/lib/project-access";
import { requireModule, toPermissionUser } from "@/lib/session";
import { rankLeasePayments } from "@/lib/vehicle-expense";
import {
  remainingAfterLeaseRows,
  summarizeVehicleLeaseProgress,
} from "@/lib/vehicle-lease";

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
      vehicleCondition: true,
      isVehicleLease: true,
      leaseOtrAmount: true,
      leaseDownPayment: true,
      leaseTenorMonths: true,
      leaseInterestPercentYear: true,
      leaseAdminFee: true,
      leaseInsuranceAmount: true,
      leaseFiduciaryFee: true,
      leaseProvisionFee: true,
      leaseOtherFee: true,
      leaseMonthlyInstallment: true,
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

  const expenses = await prisma.purchaseInvoice.findMany({
    where: {
      companyId: company.id,
      reversedAt: null,
      OR: [
        { vehicleAssetId: asset.id },
        {
          AND: [
            { vehiclePlate: asset.assetCode },
            { purchaseCategory: "VEHICLE" },
          ],
        },
      ],
    },
    select: {
      id: true,
      invoiceDate: true,
      amount: true,
      vehicleExpenseKind: true,
      vehicleOtherCostDescription: true,
      invoiceRef: true,
      supplierName: true,
      isVehicleLease: true,
      leaseTenorMonths: true,
    },
    orderBy: [{ invoiceDate: "asc" }, { id: "asc" }],
  });

  const leaseRanks = rankLeasePayments(
    expenses.filter((row) => row.vehicleExpenseKind === "LEASE_PAYMENT")
  );
  const costLogBase = expenses.map((row) => ({
    id: row.id,
    invoiceDate: row.invoiceDate.toISOString(),
    kind: row.vehicleExpenseKind,
    description: row.vehicleOtherCostDescription,
    amount: decimalToNumber(row.amount) ?? 0,
    invoiceRef: row.invoiceRef,
    supplierName: row.supplierName,
    isVehicleLease: row.isVehicleLease,
    installmentNumber: leaseRanks.get(row.id) ?? null,
    tenorMonths: row.leaseTenorMonths ?? asset.leaseTenorMonths,
  }));
  const costLogTotal = costLogBase.reduce((sum, row) => sum + row.amount, 0);
  const leaseProgress =
    asset.isVehicleLease
      ? summarizeVehicleLeaseProgress(
          {
            otrAmount: decimalToNumber(asset.leaseOtrAmount) ?? 0,
            downPayment: decimalToNumber(asset.leaseDownPayment) ?? 0,
            tenorMonths: asset.leaseTenorMonths ?? 0,
            interestPercentYear:
              decimalToNumber(asset.leaseInterestPercentYear) ?? 0,
            adminFee: decimalToNumber(asset.leaseAdminFee) ?? 0,
            insuranceAmount: decimalToNumber(asset.leaseInsuranceAmount) ?? 0,
            fiduciaryFee: decimalToNumber(asset.leaseFiduciaryFee) ?? 0,
            provisionFee: decimalToNumber(asset.leaseProvisionFee) ?? 0,
            otherFee: decimalToNumber(asset.leaseOtherFee) ?? 0,
            monthlyInstallment: decimalToNumber(asset.leaseMonthlyInstallment),
          },
          costLogBase.map((row) => ({ kind: row.kind, amount: row.amount }))
        )
      : null;
  const remainingAfter = leaseProgress
    ? remainingAfterLeaseRows(
        leaseProgress.scheduledTotalCost,
        costLogBase.map((row) => ({ kind: row.kind, amount: row.amount }))
      )
    : [];
  const costLog = costLogBase.map((row, index) => ({
    ...row,
    remainingAfter: remainingAfter[index] ?? null,
  }));

  return (
    <AppShell
      title={asset.assetCode}
    >
      <VehicleDetailPage
        canManage={canManageInventory(permissionUser)}
        costLog={costLog}
        costLogTotal={costLogTotal}
        leaseProgress={leaseProgress}
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
          vehicleCondition: asset.vehicleCondition,
          isVehicleLease: asset.isVehicleLease,
          leaseOtrAmount: decimalToNumber(asset.leaseOtrAmount),
          leaseDownPayment: decimalToNumber(asset.leaseDownPayment),
          leaseTenorMonths: asset.leaseTenorMonths,
          leaseInterestPercentYear: decimalToNumber(
            asset.leaseInterestPercentYear
          ),
          leaseAdminFee: decimalToNumber(asset.leaseAdminFee),
          leaseInsuranceAmount: decimalToNumber(asset.leaseInsuranceAmount),
          leaseFiduciaryFee: decimalToNumber(asset.leaseFiduciaryFee),
          leaseProvisionFee: decimalToNumber(asset.leaseProvisionFee),
          leaseOtherFee: decimalToNumber(asset.leaseOtherFee),
          leaseMonthlyInstallment: decimalToNumber(
            asset.leaseMonthlyInstallment
          ),
          createdAt: asset.createdAt.toISOString(),
          item: asset.item,
          project: asset.project,
        }}
      />
    </AppShell>
  );
}
