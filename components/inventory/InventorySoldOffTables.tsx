"use client";

import { useMemo, useState } from "react";
import { Undo2 } from "lucide-react";

import {
  compareMovedAtDesc,
  INVENTORY_CATEGORY_DISPLAY_ORDER,
  INVENTORY_CATEGORY_TITLE_KEY,
  partitionByInventoryItemType,
} from "@/components/inventory/inventory-category";
import InventorySoldOffDetailDialog from "@/components/inventory/InventorySoldOffDetailDialog";
import type { InventorySoldOffRow } from "@/components/inventory/inventory-types";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import { matchesDirectorySearch } from "@/components/ui/DirectorySearchInput";
import { formatInventoryQtyWithUnit } from "@/lib/inventory";
import { useT } from "@/lib/i18n/use-t";
import { formatDisplayDate } from "@/lib/format-date";
import { formatContractPrice } from "@/lib/project-billing";
import { formatUserDisplayLabel } from "@/lib/user-display";

type Props = {
  soldOffs: InventorySoldOffRow[];
  searchQuery: string;
  canReverse: boolean;
  canAttach?: boolean;
  onReverse: (row: InventorySoldOffRow) => void;
};

export default function InventorySoldOffTables({
  soldOffs,
  searchQuery,
  canReverse,
  canAttach = false,
  onReverse,
}: Props) {
  const { t } = useT();
  const trimmedSearch = searchQuery.trim();
  const [detailRow, setDetailRow] = useState<InventorySoldOffRow | null>(null);

  const visibleRows = useMemo(
    () =>
      soldOffs
        .filter((row) => row.item?.id != null)
        .filter((row) =>
          matchesDirectorySearch(
            searchQuery,
            row.item?.name,
            row.item?.sku,
            row.invoiceNumber,
            row.buyer,
            row.buyerPicName,
            row.buyerPhone,
            row.buyerIdNumber,
            row.buyerTaxId,
            row.clientName,
            row.notes,
            row.createdBy?.name,
            row.createdBy?.username,
            formatUserDisplayLabel(row.createdBy)
          )
        )
        .slice()
        .sort((a, b) =>
          compareMovedAtDesc(
            { movedAt: a.soldAt },
            { movedAt: b.soldAt }
          )
        ),
    [soldOffs, searchQuery]
  );

  const categorized = useMemo(
    () => partitionByInventoryItemType(visibleRows),
    [visibleRows]
  );

  const columns: DataTableColumn<InventorySoldOffRow>[] = [
    {
      key: "soldAt",
      title: t("pages.inventory.columns.date"),
      share: 1,
      render: (row) => formatDisplayDate(row.soldAt),
    },
    {
      key: "item",
      title: t("pages.inventory.columns.item"),
      share: 1,
      render: (row) => (
        <div>
          <p className="font-medium text-text">{row.item?.name ?? "—"}</p>
          <p className="text-xs text-subtle">{row.item?.sku ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "quantity",
      title: t("pages.inventory.columns.qty"),
      share: 1,
      align: "right",
      render: (row) =>
        formatInventoryQtyWithUnit(row.quantity, row.item?.unit ?? "pcs"),
    },
    {
      key: "gainLoss",
      title: t("pages.inventory.columns.gainLoss"),
      share: 1,
      align: "right",
      render: (row) => {
        const value = row.gainLoss;
        const tone =
          value > 0 ? "text-primary-dark" : value < 0 ? "text-danger" : undefined;
        return (
          <span className={tone}>{formatContractPrice(value)}</span>
        );
      },
    },
    {
      key: "totalPrice",
      title: t("pages.inventory.columns.saleTotal"),
      share: 1,
      align: "right",
      render: (row) => formatContractPrice(row.totalPrice),
    },
    {
      key: "invoiceNumber",
      title: t("pages.sales.columns.invoice"),
      share: 1.2,
      render: (row) => (
        <span className="font-medium tabular-nums text-text">
          {row.invoiceNumber || "—"}
        </span>
      ),
    },
    {
      key: "createdBy",
      title: t("pages.inventory.columns.soldBy"),
      share: 1,
      render: (row) => formatUserDisplayLabel(row.createdBy) ?? "—",
    },
    ...(canReverse
      ? [
          {
            key: "actions",
            title: t("pages.inventory.columns.actions"),
            width: "8rem",
            cellAlign: "center" as const,
            render: (row: InventorySoldOffRow) => (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={() => onReverse(row)}
              >
                <Undo2 className="h-3.5 w-3.5" />
                {t("pages.inventory.reverseSale")}
              </Button>
            ),
          } satisfies DataTableColumn<InventorySoldOffRow>,
        ]
      : []),
  ];

  function renderCategoryTable(title: string, rows: InventorySoldOffRow[]) {
    if (rows.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-subtle">
          {title}
        </p>
        <DataTable
          columns={columns}
          data={rows}
          getRowKey={(row) => row.id}
          onRowClick={setDetailRow}
        />
      </div>
    );
  }

  const allEmpty =
    categorized.equipment.length === 0 &&
    categorized.chemical.length === 0 &&
    categorized.consumable.length === 0 &&
    categorized.other.length === 0;

  if (allEmpty) {
    return (
      <SectionCard>
        <EmptyState
          title={
            trimmedSearch
              ? t("pages.inventory.emptySearch", { query: trimmedSearch })
              : t("pages.inventory.emptySoldOffs")
          }
          description={
            trimmedSearch
              ? t("pages.inventory.emptySearchDesc")
              : t("pages.inventory.emptySoldOffsDesc")
          }
        />
      </SectionCard>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {INVENTORY_CATEGORY_DISPLAY_ORDER.map((key) =>
          categorized[key].length > 0
            ? renderCategoryTable(
                t(INVENTORY_CATEGORY_TITLE_KEY[key]),
                categorized[key]
              )
            : null
        )}
      </div>

      <InventorySoldOffDetailDialog
        open={detailRow != null}
        onOpenChange={(next) => {
          if (!next) setDetailRow(null);
        }}
        row={detailRow}
        canReverse={canReverse}
        canAttach={canAttach}
        onReverse={(row) => {
          setDetailRow(null);
          onReverse(row);
        }}
      />
    </>
  );
}
