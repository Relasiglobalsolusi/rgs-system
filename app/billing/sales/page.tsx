import { redirect } from "next/navigation";

import {
  listInventorySales,
} from "@/app/inventory/actions";
import SalesWorkspace from "@/components/billing/SalesWorkspace";
import type { InventoryOverviewAssetRow } from "@/components/inventory/inventory-types";
import AppShell from "@/components/layout/AppShell";
import { inventoryQtyFromDecimal } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { listCompanyBankAccountOptions } from "@/lib/company-bank-accounts";
import { requireFinanceChild } from "@/lib/session";
import { financePeriodRange, parseFinancePeriod } from "@/lib/finance-period";
import { utcRangeForJakartaYear } from "@/lib/vat";

type SearchParams = Promise<{
  year?: string;
  month?: string;
  day?: string;
}>;

function sumSales(rows: Awaited<ReturnType<typeof listInventorySales>>) {
  return rows.reduce(
    (acc, row) => ({
      count: acc.count + 1,
      sales: acc.sales + row.totalPrice,
      profit: acc.profit + row.gainLoss,
      cost: acc.cost + row.costBasis,
      vat: acc.vat + row.taxAmount,
    }),
    { count: 0, sales: 0, profit: 0, cost: 0, vat: 0 }
  );
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await requireFinanceChild("sales");

  if (session.user.clientId) {
    redirect("/billing");
  }
  if (session.user.vendorId) {
    redirect("/billing");
  }

  const params = searchParams ? await searchParams : {};
  const { year, month, day } = parseFinancePeriod(params);
  const { start, endExclusive } = financePeriodRange({ year, month, day });
  const yearRange = utcRangeForJakartaYear(year);

  const [monthSales, yearSales, items, assetRows, bankAccounts] = await Promise.all([
    listInventorySales({ start, endExclusive }),
    listInventorySales({
      start: yearRange.start,
      endExclusive: yearRange.endExclusive,
      take: 2000,
    }),
    prisma.inventoryItem.findMany({
      where: { companyId: session.user.companyId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.equipmentAsset.findMany({
      where: {
        companyId: session.user.companyId,
        status: { in: ["AVAILABLE", "ON_PROJECT"] },
      },
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
    session.user.companyId
      ? listCompanyBankAccountOptions(session.user.companyId)
      : Promise.resolve([]),
  ]);

  const monthTotals = sumSales(monthSales);
  const yearTotals = sumSales(yearSales);

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

  const equipmentAssets = assetRows
    .filter((asset) => asset.item?.id != null)
    .map((asset) => ({
      id: asset.id,
      assetCode: asset.assetCode,
      status: asset.status as InventoryOverviewAssetRow["status"],
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
      item: asset.item!,
      project: asset.project,
    }));

  return (
    <AppShell
      titleKey="pages.sales.title"
    >
      <SalesWorkspace
        year={year}
        month={month}
        day={day}
        soldOffs={monthSales}
        items={catalogItems}
        equipmentAssets={equipmentAssets}
        totals={{
          ...monthTotals,
          yearSales: yearTotals.sales,
          yearProfit: yearTotals.profit,
        }}
        canManage
        bankAccounts={bankAccounts}
      />
    </AppShell>
  );
}
