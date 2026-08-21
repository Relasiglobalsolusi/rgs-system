"use client";

import { useEffect, useMemo, useState } from "react";

import {
  inventoryItemTypeCategory,
  type InventoryItemTypeCategory,
} from "@/components/inventory/inventory-category";
import { inventoryUnitLabel } from "@/components/inventory/InventoryUnitSelect";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type MaterialRequestCatalogItem = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  /** Requesters never see the warehouse quantity — only whether it can be picked. */
  available: boolean;
  itemType: string;
};

export function isMaterialRequestItemAvailable(
  item: Pick<MaterialRequestCatalogItem, "available">
) {
  return item.available;
}

/** Picker order: Consumables → Chemicals → Equipment → Vehicles → Spare Parts → Other. */
const MATERIAL_REQUEST_TYPE_ORDER: InventoryItemTypeCategory[] = [
  "consumable",
  "chemical",
  "equipment",
  "vehicle",
  "sparePart",
  "other",
];

const TYPE_LABEL_KEY: Record<
  InventoryItemTypeCategory,
  | "pages.materialRequests.itemTypes.consumable"
  | "pages.materialRequests.itemTypes.chemical"
  | "pages.materialRequests.itemTypes.equipment"
  | "pages.materialRequests.itemTypes.vehicle"
  | "pages.materialRequests.itemTypes.sparePart"
  | "pages.materialRequests.itemTypes.other"
> = {
  consumable: "pages.materialRequests.itemTypes.consumable",
  chemical: "pages.materialRequests.itemTypes.chemical",
  equipment: "pages.materialRequests.itemTypes.equipment",
  vehicle: "pages.materialRequests.itemTypes.vehicle",
  sparePart: "pages.materialRequests.itemTypes.sparePart",
  other: "pages.materialRequests.itemTypes.other",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MaterialRequestCatalogItem[];
  selectedItemId?: string;
  onSelect: (item: MaterialRequestCatalogItem) => void;
};

export default function MaterialRequestItemPicker({
  open,
  onOpenChange,
  items,
  selectedItemId,
  onSelect,
}: Props) {
  const { t } = useT();
  const [itemType, setItemType] = useState<InventoryItemTypeCategory | null>(
    null
  );
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setSearch("");
    const selected = items.find((item) => item.id === selectedItemId);
    setItemType(
      selected ? inventoryItemTypeCategory(selected.itemType) : null
    );
  }, [open, selectedItemId, items]);

  const typedItems = useMemo(() => {
    if (!itemType) return [];
    return items.filter(
      (item) => inventoryItemTypeCategory(item.itemType) === itemType
    );
  }, [itemType, items]);

  const filteredItems = useMemo(
    () =>
      typedItems.filter((item) =>
        matchesDirectorySearch(search, item.name, item.sku)
      ),
    [search, typedItems]
  );

  const typeRows = useMemo(
    () =>
      MATERIAL_REQUEST_TYPE_ORDER.map((type) => ({
        id: type,
        label: t(TYPE_LABEL_KEY[type]),
      })),
    [t]
  );

  const columns: DataTableColumn<MaterialRequestCatalogItem>[] = [
    {
      key: "name",
      title: t("pages.materialRequests.columns.item"),
      share: 2,
      render: (row) => {
        const available = isMaterialRequestItemAvailable(row);
        return (
          <div>
            <p className={cn("font-medium", available ? "text-text" : "text-muted")}>
              {row.name}
            </p>
            <p className="text-xs text-subtle">
              {inventoryUnitLabel(t, row.unit)}
            </p>
            {available ? null : (
              <p className="mt-1 text-xs font-semibold text-danger">
                {t("pages.materialRequests.outOfStock")}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "sku",
      title: t("pages.materialRequests.columns.sku"),
      width: "8rem",
      render: (row) => row.sku,
    },
    {
      key: "availability",
      title: t("pages.materialRequests.columns.availability"),
      width: "10rem",
      render: (row) =>
        isMaterialRequestItemAvailable(row) ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="font-medium text-danger">
            {t("pages.materialRequests.itemNotAvailable")}
          </span>
        ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,44rem)] w-full flex-col gap-4 overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("pages.materialRequests.selectItemTitle")}</DialogTitle>
          <DialogDescription>
            {t("pages.materialRequests.selectItemDesc")}
          </DialogDescription>
        </DialogHeader>

        {itemType ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div>
              <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                {t("pages.materialRequests.itemTypeLabel")}
              </p>
              <div className="flex flex-wrap gap-2">
                {MATERIAL_REQUEST_TYPE_ORDER.map((type) => (
                  <DirectoryFilterTab
                    key={type}
                    size="sm"
                    active={itemType === type}
                    onClick={() => {
                      setItemType(type);
                      setSearch("");
                    }}
                  >
                    {t(TYPE_LABEL_KEY[type])}
                  </DirectoryFilterTab>
                ))}
              </div>
            </div>

            <DirectorySearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("pages.materialRequests.searchItemsPlaceholder")}
              className="max-w-none"
            />

            <div className="min-h-0 flex-1 overflow-y-auto">
              <DataTable
                columns={columns}
                data={filteredItems}
                getRowKey={(row) => row.id}
                onRowClick={(row) => {
                  if (!isMaterialRequestItemAvailable(row)) return;
                  onSelect(row);
                }}
                isRowDisabled={(row) => !isMaterialRequestItemAvailable(row)}
                isRowSelected={(row) => row.id === selectedItemId}
                emptyMessage={
                  search.trim()
                    ? t("pages.materialRequests.noItemsMatchSearch")
                    : t("pages.materialRequests.noItemsForType")
                }
              />
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">
              {t("pages.materialRequests.itemTypeLabel")}
            </p>
            <p className="mb-3 text-xs text-subtle">
              {t("pages.materialRequests.itemTypeHint")}
            </p>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-elevated/60 text-left text-[0.6875rem] uppercase tracking-[0.12em] text-subtle">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">
                      {t("pages.materialRequests.itemTypeLabel")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {typeRows.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="p-0">
                        <button
                          type="button"
                          onClick={() => setItemType(row.id)}
                          className={cn(
                            "flex w-full px-3 py-3 text-left font-medium text-text transition",
                            "hover:bg-card-hover"
                          )}
                        >
                          {row.label}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
