"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

import { updateEquipmentAssetDetails } from "@/app/inventory/actions";
import type {
  InventoryCatalogItem,
  InventoryOverviewAssetRow,
} from "@/components/inventory/inventory-types";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import {
  equipmentRetirementKind,
  isEquipmentSurplusRetireNote,
} from "@/lib/equipment-asset";
import { isBelowMinStock, formatInventoryQtyWithUnit } from "@/lib/inventory";
import { useT } from "@/lib/i18n/use-t";
import { formatDisplayDate } from "@/lib/format-date";
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
  canManage = false,
}: Props) {
  const { t } = useT();
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(
    null
  );
  const [includeSold, setIncludeSold] = useState(false);
  const [includeWrittenOff, setIncludeWrittenOff] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editSerial, setEditSerial] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const trimmedSearch = searchQuery.trim();

  const equipmentOwnedByItem = useMemo(() => {
    const map = new Map<
      string,
      { warehouse: number; onProject: number; ownedValue: number }
    >();
    for (const asset of equipmentAssets) {
      const itemId = asset.item?.id;
      if (!itemId) continue;
      if (asset.status === "RETIRED") continue;
      const entry = map.get(itemId) ?? {
        warehouse: 0,
        onProject: 0,
        ownedValue: 0,
      };
      if (asset.status === "AVAILABLE") entry.warehouse += 1;
      else if (asset.status === "ON_PROJECT") entry.onProject += 1;
      entry.ownedValue += asset.unitCost ?? 0;
      map.set(itemId, entry);
    }
    return map;
  }, [equipmentAssets]);

  const selectedEquipment = useMemo(
    () => items.find((item) => item.id === selectedEquipmentId) ?? null,
    [items, selectedEquipmentId]
  );

  const selectedAssets = useMemo(() => {
    if (!selectedEquipmentId) return [];
    return equipmentAssets.filter((asset) => {
      if (asset.item?.id !== selectedEquipmentId) return false;
      if (asset.status !== "RETIRED") return true;
      const kind = equipmentRetirementKind(asset);
      if (kind === "sold") return includeSold;
      if (kind === "writtenOff") return includeWrittenOff;
      return false;
    });
  }, [
    equipmentAssets,
    includeSold,
    includeWrittenOff,
    selectedEquipmentId,
  ]);

  const selectedLocationSummary = useMemo(() => {
    const warehouse = selectedAssets.filter((a) => a.status === "AVAILABLE")
      .length;
    const onProject = selectedAssets.filter((a) => a.status === "ON_PROJECT")
      .length;
    const sold = selectedAssets.filter(
      (a) => equipmentRetirementKind(a) === "sold"
    ).length;
    const writtenOff = selectedAssets.filter(
      (a) => equipmentRetirementKind(a) === "writtenOff"
    ).length;
    return {
      warehouse,
      onProject,
      sold,
      writtenOff,
      owned: warehouse + onProject,
    };
  }, [selectedAssets]);

  function startEdit(asset: InventoryOverviewAssetRow) {
    setEditingAssetId(asset.id);
    setEditSerial(asset.serialNo ?? "");
    setEditNotes(asset.notes ?? "");
  }

  function cancelEdit() {
    setEditingAssetId(null);
    setEditSerial("");
    setEditNotes("");
  }

  function saveEdit(assetId: string) {
    const formData = new FormData();
    formData.set("id", assetId);
    formData.set("serialNo", editSerial);
    formData.set("notes", editNotes);
    startTransition(async () => {
      try {
        await updateEquipmentAssetDetails(formData);
        toast.success(t("pages.inventory.assetUpdated"));
        cancelEdit();
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.inventory.updateAssetFailed")
        );
      }
    });
  }

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
      width: "8rem",
      align: "right",
      render: (row) => {
        const warehouse = equipmentOwnedByItem.get(row.id)?.warehouse ?? 0;
        const low = isBelowMinStock(warehouse, row.minStock);
        return (
          <span className={low ? "font-semibold text-warning" : undefined}>
            {formatInventoryQtyWithUnit(warehouse, row.unit)}
            {low ? (
              <AlertTriangle className="ml-1 inline h-3.5 w-3.5 align-text-bottom" />
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
        const owned = (counts?.warehouse ?? 0) + (counts?.onProject ?? 0);
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

  const locationColumns: DataTableColumn<InventoryOverviewAssetRow>[] = [
    {
      key: "assetCode",
      title: t("pages.inventory.overview.assetCode"),
      width: "9rem",
      render: (row) => (
        <span className="font-mono text-sm text-muted">{row.assetCode}</span>
      ),
    },
    {
      key: "status",
      title: t("pages.inventory.columns.status"),
      width: "8rem",
      render: (row) => {
        if (row.status === "AVAILABLE") {
          return (
            <span className="inline-flex w-fit items-center rounded-full bg-card-tint-emerald px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
              {t("pages.inventory.overview.locationWarehouse")}
            </span>
          );
        }
        if (row.status === "ON_PROJECT") {
          return (
            <span className="inline-flex w-fit items-center rounded-full bg-card-tint-amber px-2.5 py-0.5 text-xs font-medium text-warning ring-1 ring-inset ring-warning/20">
              {t("pages.inventory.overview.locationOnProject")}
            </span>
          );
        }
        const retiredKind = equipmentRetirementKind(row);
        if (retiredKind === "sold") {
          return (
            <span className="inline-flex w-fit items-center rounded-full bg-card-tint-sky px-2.5 py-0.5 text-xs font-medium text-sky-300 ring-1 ring-inset ring-sky-400/20">
              {t("pages.inventory.overview.sold")}
            </span>
          );
        }
        return (
          <span className="inline-flex w-fit items-center rounded-full bg-strip px-2.5 py-0.5 text-xs font-medium text-muted ring-1 ring-inset ring-border">
            {t("pages.inventory.overview.writtenOff")}
          </span>
        );
      },
    },
    {
      key: "serialNo",
      title: t("pages.inventory.overview.serialNo"),
      width: "9rem",
      render: (row) =>
        editingAssetId === row.id ? (
          <input
            value={editSerial}
            onChange={(e) => setEditSerial(e.target.value)}
            className="w-full rounded-md border border-border bg-elevated px-2 py-1 text-sm text-text"
            disabled={pending}
          />
        ) : (
          <span className="text-sm text-text">{row.serialNo || "—"}</span>
        ),
    },
    {
      key: "unitCost",
      title: t("pages.inventory.overview.acquisitionCost"),
      width: "8rem",
      align: "right",
      render: (row) =>
        row.unitCost != null ? formatContractPrice(row.unitCost) : "—",
    },
    {
      key: "assignedAt",
      title: t("pages.inventory.overview.assignedAt"),
      width: "8rem",
      render: (row) =>
        row.status === "ON_PROJECT" && row.assignedAt
          ? formatDisplayDate(row.assignedAt)
          : "—",
    },
    {
      key: "project",
      title: t("pages.inventory.columns.project"),
      share: 1.5,
      render: (row) =>
        row.project ? (
          <Link
            href={`/projects/${row.project.id}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {row.project.name}
          </Link>
        ) : (
          <span className="text-sm text-subtle">—</span>
        ),
    },
    {
      key: "notes",
      title: t("pages.inventory.overview.notes"),
      share: 1.5,
      render: (row) =>
        editingAssetId === row.id ? (
          <input
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            className="w-full rounded-md border border-border bg-elevated px-2 py-1 text-sm text-text"
            disabled={pending}
          />
        ) : (
          <span className="line-clamp-2 text-sm text-text">
            {isEquipmentSurplusRetireNote(row.notes)
              ? t("pages.inventory.overview.systemCleanupDuplicateUnit")
              : row.notes || "—"}
          </span>
        ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            title: t("pages.inventory.columns.actions"),
            width: "9rem",
            align: "right" as const,
            render: (row: InventoryOverviewAssetRow) =>
              editingAssetId === row.id ? (
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={cancelEdit}
                  >
                    {t("common.actions.cancel")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() => saveEdit(row.id)}
                  >
                    {t("common.actions.save")}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending || row.status === "RETIRED"}
                  onClick={() => startEdit(row)}
                >
                  {t("common.actions.edit")}
                </Button>
              ),
          } satisfies DataTableColumn<InventoryOverviewAssetRow>,
        ]
      : []),
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
        onRowClick={(row) => {
          setSelectedEquipmentId((prev) => (prev === row.id ? null : row.id));
          cancelEdit();
        }}
        isRowSelected={(row) => row.id === selectedEquipmentId}
      />

      {selectedEquipment ? (
        <div className="space-y-2 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">
                {t("pages.inventory.stock.equipmentLocations")}
              </p>
              <p className="mt-1 text-sm font-medium text-text">
                {selectedEquipment.name}
                <span className="ml-2 font-mono text-xs text-muted">
                  {selectedEquipment.sku}
                </span>
              </p>
              {selectedAssets.length > 0 ? (
                <p className="mt-1 text-xs text-muted">
                  {includeSold || includeWrittenOff
                    ? t("pages.inventory.stock.equipmentLocationSummaryDisposed", {
                        warehouse: String(selectedLocationSummary.warehouse),
                        onProject: String(selectedLocationSummary.onProject),
                        owned: String(selectedLocationSummary.owned),
                        sold: String(selectedLocationSummary.sold),
                        writtenOff: String(selectedLocationSummary.writtenOff),
                      })
                    : t("pages.inventory.stock.equipmentLocationSummary", {
                        warehouse: String(selectedLocationSummary.warehouse),
                        onProject: String(selectedLocationSummary.onProject),
                        owned: String(selectedLocationSummary.owned),
                      })}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={includeSold}
                  onChange={(e) => setIncludeSold(e.target.checked)}
                  className="rounded border-border"
                />
                {t("pages.inventory.overview.showSold")}
              </label>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={includeWrittenOff}
                  onChange={(e) => setIncludeWrittenOff(e.target.checked)}
                  className="rounded border-border"
                />
                {t("pages.inventory.overview.showWrittenOff")}
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setSelectedEquipmentId(null);
                  cancelEdit();
                }}
              >
                <X className="h-3.5 w-3.5" />
                {t("pages.inventory.stock.closeLocations")}
              </Button>
            </div>
          </div>

          {selectedAssets.length === 0 ? (
            <EmptyState
              title={t("pages.inventory.overview.emptyAssets")}
              description=""
            />
          ) : (
            <DataTable
              columns={locationColumns}
              data={selectedAssets}
              getRowKey={(row) => row.id}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
