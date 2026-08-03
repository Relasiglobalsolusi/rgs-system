"use client";

import { useMemo } from "react";
import { Undo2 } from "lucide-react";

import {
  compareMovedAtDesc,
  partitionByInventoryItemType,
} from "@/components/inventory/inventory-category";
import type { InventoryWriteOffRow } from "@/components/inventory/inventory-types";
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
  writeOffs: InventoryWriteOffRow[];
  searchQuery: string;
  canReverse: boolean;
  onReverse: (row: InventoryWriteOffRow) => void;
};

export default function InventoryWriteOffTables({
  writeOffs,
  searchQuery,
  canReverse,
  onReverse,
}: Props) {
  const { t } = useT();
  const trimmedSearch = searchQuery.trim();

  const visibleRows = useMemo(
    () =>
      writeOffs
        .filter((row) => row.item?.id != null)
        .filter((row) =>
          matchesDirectorySearch(
            searchQuery,
            row.item?.name,
            row.item?.sku,
            row.reason,
            row.createdBy?.name,
            row.createdBy?.username,
            formatUserDisplayLabel(row.createdBy)
          )
        )
        .slice()
        .sort(compareMovedAtDesc),
    [writeOffs, searchQuery]
  );

  const categorized = useMemo(
    () => partitionByInventoryItemType(visibleRows),
    [visibleRows]
  );

  const writeOffColumns: DataTableColumn<InventoryWriteOffRow>[] = [
    {
      key: "movedAt",
      title: t("pages.inventory.columns.date"),
      width: "8rem",
      render: (row) => formatDisplayDate(row.movedAt),
    },
    {
      key: "item",
      title: t("pages.inventory.columns.item"),
      share: 2,
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
      width: "7rem",
      align: "right",
      render: (row) =>
        formatInventoryQtyWithUnit(row.quantity, row.item?.unit ?? "pcs"),
    },
    {
      key: "unitCost",
      title: t("pages.inventory.columns.unitCost"),
      width: "8rem",
      align: "right",
      render: (row) =>
        row.unitCost > 0 ? formatContractPrice(row.unitCost) : "—",
    },
    {
      key: "totalCost",
      title: t("pages.inventory.columns.writeOffValue"),
      width: "9rem",
      align: "right",
      render: (row) =>
        row.totalCost > 0 ? formatContractPrice(row.totalCost) : "—",
    },
    {
      key: "reason",
      title: t("pages.inventory.columns.writeOffReason"),
      share: 2,
      render: (row) => (
        <span className="text-sm text-text">{row.reason}</span>
      ),
    },
    {
      key: "createdBy",
      title: t("pages.inventory.columns.writtenOffBy"),
      width: "9rem",
      render: (row) => formatUserDisplayLabel(row.createdBy) ?? "—",
    },
    ...(canReverse
      ? [
          {
            key: "actions",
            title: t("pages.inventory.columns.actions"),
            width: "8rem",
            align: "right" as const,
            render: (row: InventoryWriteOffRow) => (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={() => onReverse(row)}
              >
                <Undo2 className="h-3.5 w-3.5" />
                {t("pages.inventory.reverseWriteOff")}
              </Button>
            ),
          } satisfies DataTableColumn<InventoryWriteOffRow>,
        ]
      : []),
  ];

  function renderCategoryTable(
    title: string,
    rows: InventoryWriteOffRow[]
  ) {
    if (rows.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">
          {title}
        </p>
        <DataTable
          columns={writeOffColumns}
          data={rows}
          getRowKey={(row) => row.id}
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
              : t("pages.inventory.emptyWriteOffs")
          }
          description={
            trimmedSearch
              ? t("pages.inventory.emptySearchDesc")
              : t("pages.inventory.emptyWriteOffsDesc")
          }
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-8">
      {categorized.equipment.length > 0
        ? renderCategoryTable(
            t("pages.inventory.overview.categoryEquipment"),
            categorized.equipment
          )
        : null}
      {categorized.chemical.length > 0
        ? renderCategoryTable(
            t("pages.inventory.overview.categoryChemicals"),
            categorized.chemical
          )
        : null}
      {categorized.consumable.length > 0
        ? renderCategoryTable(
            t("pages.inventory.overview.categoryConsumables"),
            categorized.consumable
          )
        : null}
      {categorized.other.length > 0
        ? renderCategoryTable(
            t("pages.inventory.overview.categoryOthers"),
            categorized.other
          )
        : null}
    </div>
  );
}
