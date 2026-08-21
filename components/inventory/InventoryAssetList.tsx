"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import type {
  InventoryCatalogItem,
  InventoryOverviewAssetRow,
} from "@/components/inventory/inventory-types";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { uncodedWarehouseQty } from "@/lib/equipment-asset";
import {
  isBelowMinStock,
  formatInventoryQty,
  formatInventoryQtyWithUnit,
} from "@/lib/inventory";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

type Props = {
  items: InventoryCatalogItem[];
  equipmentAssets: InventoryOverviewAssetRow[];
  searchQuery: string;
  canManage?: boolean;
};

export default function InventoryAssetList({
  items,
  equipmentAssets,
  searchQuery,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const trimmedSearch = searchQuery.trim();

  const equipmentOwnedByItem = useMemo(() => {
    const map = new Map<
      string,
      {
        warehouse: number;
        onProject: number;
        ownedValue: number;
        available: number;
      }
    >();
    for (const item of items) {
      map.set(item.id, {
        warehouse: item.currentStock,
        onProject: 0,
        ownedValue: 0,
        available: 0,
      });
    }
    for (const asset of equipmentAssets) {
      const itemId = asset.item?.id;
      if (!itemId) continue;
      const entry = map.get(itemId) ?? {
        warehouse: 0,
        onProject: 0,
        ownedValue: 0,
        available: 0,
      };
      if (asset.status === "AVAILABLE") {
        entry.available += 1;
      }
      if (
        asset.status === "ON_PROJECT" ||
        asset.status === "IN_TRANSIT" ||
        asset.status === "AT_FACTORY"
      ) {
        entry.onProject += 1;
      }
      if (asset.status !== "RETIRED") {
        entry.ownedValue += asset.unitCost ?? 0;
      }
      map.set(itemId, entry);
    }
    return map;
  }, [equipmentAssets, items]);

  const equipmentColumns: DataTableColumn<InventoryCatalogItem>[] = [
    {
      key: "sku",
      title: t("pages.inventory.columns.sku"),
      width: "7rem",
      render: (row) => (
        <span className="font-mono text-sm text-muted">{row.sku}</span>
      ),
    },
    {
      key: "name",
      title: t("pages.inventory.columns.item"),
      share: 2,
      render: (row) => row?.name ?? "—",
    },
    {
      key: "warehouse",
      title: t("pages.inventory.columns.warehouseOnHand"),
      width: "11rem",
      align: "right",
      render: (row) => {
        const warehouse = row.currentStock;
        const available = equipmentOwnedByItem.get(row.id)?.available ?? 0;
        const uncoded = uncodedWarehouseQty(warehouse, available);
        const low = isBelowMinStock(warehouse, row.minStock);
        return (
          <span className={low ? "font-semibold text-warning" : undefined}>
            {formatInventoryQtyWithUnit(warehouse, row.unit)}
            {low ? (
              <AlertTriangle className="ml-1 inline h-3.5 w-3.5 align-text-bottom" />
            ) : null}
            {uncoded > 0 ? (
              <span className="mt-0.5 block text-xs font-normal text-muted">
                {t("pages.inventory.product.newStockRow", {
                  qty: formatInventoryQty(uncoded),
                })}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: "owned",
      title: t("pages.inventory.columns.owned"),
      width: "7rem",
      align: "right",
      render: (row) => {
        const counts = equipmentOwnedByItem.get(row.id);
        const owned = (counts?.warehouse ?? row.currentStock) + (counts?.onProject ?? 0);
        return formatInventoryQtyWithUnit(owned, row.unit);
      },
    },
    {
      key: "minStock",
      title: t("pages.inventory.columns.minStock"),
      width: "7rem",
      align: "right",
      render: (row) =>
        row.minStock > 0
          ? formatInventoryQtyWithUnit(row.minStock, row.unit)
          : "—",
    },
    {
      key: "value",
      title: t("pages.inventory.columns.valueOwned"),
      width: "9rem",
      align: "right",
      render: (row) => {
        const ownedValue = equipmentOwnedByItem.get(row.id)?.ownedValue ?? 0;
        return formatContractPrice(ownedValue);
      },
    },
  ];

  if (items.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          title={
            trimmedSearch
              ? t("pages.inventory.emptySearch", { query: trimmedSearch })
              : t("pages.inventory.emptyAssetList")
          }
          description={
            trimmedSearch
              ? t("pages.inventory.emptySearchDesc")
              : t("pages.inventory.emptyAssetListDesc")
          }
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">
          {t("pages.inventory.overview.categoryEquipment")}
        </p>
        <p className="text-xs text-muted">
          {t("pages.inventory.stock.equipmentClickHint")}
        </p>
      </div>

      <DataTable
        columns={equipmentColumns}
        data={items}
        getRowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/inventory/equipment/${row.id}`)}
      />
    </div>
  );
}
