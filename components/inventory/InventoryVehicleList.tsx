"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import type { InventoryOverviewAssetRow } from "@/components/inventory/inventory-types";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { matchesDirectorySearch } from "@/components/ui/DirectorySearchInput";
import { formatDisplayDate } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

type Props = {
  vehicles: InventoryOverviewAssetRow[];
  searchQuery: string;
};

export default function InventoryVehicleList({ vehicles, searchQuery }: Props) {
  const { t } = useT();
  const router = useRouter();
  const trimmedSearch = searchQuery.trim();

  const visible = useMemo(
    () =>
      vehicles.filter((row) =>
        matchesDirectorySearch(
          searchQuery,
          row.assetCode,
          row.item?.name,
          row.item?.sku,
          row.vehicleYear != null ? String(row.vehicleYear) : "",
          row.project?.name
        )
      ),
    [searchQuery, vehicles]
  );

  const columns: DataTableColumn<InventoryOverviewAssetRow>[] = [
    {
      key: "assetCode",
      title: t("pages.inventory.columns.plate"),
      width: "9rem",
      render: (row) => (
        <span className="font-mono text-sm font-medium text-text">
          {row.assetCode}
        </span>
      ),
    },
    {
      key: "item",
      title: t("pages.inventory.columns.item"),
      share: 2,
      render: (row) => row.item?.name ?? "—",
    },
    {
      key: "vehicleYear",
      title: t("pages.inventory.columns.vehicleYear"),
      width: "7rem",
      render: (row) =>
        row.vehicleYear != null ? String(row.vehicleYear) : "—",
    },
    {
      key: "createdAt",
      title: t("pages.inventory.columns.dateBought"),
      width: "8rem",
      render: (row) => formatDisplayDate(row.createdAt),
    },
    {
      key: "unitCost",
      title: t("pages.inventory.columns.unitCost"),
      width: "8rem",
      align: "right",
      render: (row) =>
        row.unitCost != null ? formatContractPrice(row.unitCost) : "—",
    },
  ];

  if (visible.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          title={
            trimmedSearch
              ? t("pages.inventory.emptySearch", { query: trimmedSearch })
              : t("pages.inventory.emptyVehicles")
          }
          description={
            trimmedSearch
              ? t("pages.inventory.emptySearchDesc")
              : t("pages.inventory.emptyVehiclesDesc")
          }
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        {t("pages.inventory.vehicles.clickHint")}
      </p>
      <DataTable
        columns={columns}
        data={visible}
        getRowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/inventory/vehicles/${row.id}`)}
      />
    </div>
  );
}
