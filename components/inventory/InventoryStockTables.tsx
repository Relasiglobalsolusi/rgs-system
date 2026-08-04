"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { matchInventoryItemType } from "@/components/inventory/inventory-category";
import InventoryStockItemDetailDialog from "@/components/inventory/InventoryStockItemDetailDialog";
import type { InventoryCatalogItem } from "@/components/inventory/inventory-types";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import {
  isBelowMinStock,
  stockValueOnHand,
  formatInventoryQtyWithUnit,
} from "@/lib/inventory";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

type Props = {
  items: InventoryCatalogItem[];
  searchQuery: string;
};

export default function InventoryStockTables({ items, searchQuery }: Props) {
  const { t } = useT();
  const trimmedSearch = searchQuery.trim();
  const [detailItem, setDetailItem] = useState<InventoryCatalogItem | null>(
    null
  );

  const chemicalItems = useMemo(
    () =>
      items.filter((item) => matchInventoryItemType(item.itemType, "chemical")),
    [items]
  );
  const consumableItems = useMemo(
    () =>
      items.filter((item) =>
        matchInventoryItemType(item.itemType, "consumable")
      ),
    [items]
  );
  /** Other + any custom item types that are not Chemical / Equipment / Consumable. */
  const otherItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !matchInventoryItemType(item.itemType, "chemical") &&
          !matchInventoryItemType(item.itemType, "equipment") &&
          !matchInventoryItemType(item.itemType, "consumable")
      ),
    [items]
  );

  const stockColumns: DataTableColumn<InventoryCatalogItem>[] = [
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
      key: "currentStock",
      title: t("pages.inventory.columns.onHand"),
      width: "8rem",
      align: "right",
      render: (row) => {
        const low = isBelowMinStock(row.currentStock, row.minStock);
        return (
          <span className={low ? "font-semibold text-warning" : undefined}>
            {formatInventoryQtyWithUnit(row.currentStock, row.unit)}
            {low ? (
              <AlertTriangle className="ml-1 inline h-3.5 w-3.5 align-text-bottom" />
            ) : null}
          </span>
        );
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
      key: "avgUnitCost",
      title: t("pages.inventory.columns.avgCost"),
      width: "8rem",
      align: "right",
      render: (row) =>
        row.avgUnitCost != null ? formatContractPrice(row.avgUnitCost) : "—",
    },
    {
      key: "lastUnitCost",
      title: t("pages.inventory.columns.lastCost"),
      width: "8rem",
      align: "right",
      render: (row) =>
        row.lastUnitCost != null ? formatContractPrice(row.lastUnitCost) : "—",
    },
    {
      key: "value",
      title: t("pages.inventory.columns.valueOnHand"),
      width: "9rem",
      align: "right",
      render: (row) =>
        formatContractPrice(
          stockValueOnHand(row.currentStock, row.avgUnitCost)
        ),
    },
  ];

  function renderCategoryTable(
    title: string,
    rows: InventoryCatalogItem[]
  ) {
    if (rows.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">
          {title}
        </p>
        <DataTable
          columns={stockColumns}
          data={rows}
          getRowKey={(row) => row.id}
          onRowClick={setDetailItem}
          isRowSelected={(row) => row.id === detailItem?.id}
        />
      </div>
    );
  }

  const allEmpty =
    chemicalItems.length === 0 &&
    consumableItems.length === 0 &&
    otherItems.length === 0;

  if (allEmpty) {
    return (
      <SectionCard>
        <EmptyState
          title={
            trimmedSearch
              ? t("pages.inventory.emptySearch", { query: trimmedSearch })
              : t("pages.inventory.emptyStock")
          }
          description={
            trimmedSearch
              ? t("pages.inventory.emptySearchDesc")
              : t("pages.inventory.emptyStockDesc")
          }
        />
      </SectionCard>
    );
  }

  return (
    <>
      <p className="mb-3 text-xs leading-relaxed text-muted">
        {t("pages.inventory.stock.itemClickHint")}
      </p>
      <div className="space-y-8">
        {chemicalItems.length > 0
          ? renderCategoryTable(
              t("pages.inventory.overview.categoryChemicals"),
              chemicalItems
            )
          : null}

        {consumableItems.length > 0
          ? renderCategoryTable(
              t("pages.inventory.overview.categoryConsumables"),
              consumableItems
            )
          : null}

        {otherItems.length > 0
          ? renderCategoryTable(
              t("pages.inventory.overview.categoryOthers"),
              otherItems
            )
          : null}
      </div>

      <InventoryStockItemDetailDialog
        open={detailItem != null}
        onOpenChange={(next) => {
          if (!next) setDetailItem(null);
        }}
        item={detailItem}
      />
    </>
  );
}
