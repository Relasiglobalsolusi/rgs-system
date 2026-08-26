"use client";

import { useEffect, useMemo, useState } from "react";

import {
  inventoryItemTypeCategory,
  type InventoryItemTypeCategory,
} from "@/components/inventory/inventory-category";
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
import { localizeInventoryItemType } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type PurchaseCatalogPickerItem = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  itemType: string;
  lastUnitCost: number | null;
};

const PRODUCT_TYPE_ORDER = [
  "equipment",
  "chemical",
  "consumable",
  "sparePart",
  "other",
] as const satisfies readonly Exclude<InventoryItemTypeCategory, "vehicle">[];

const TYPE_PRESET: Record<(typeof PRODUCT_TYPE_ORDER)[number], string> = {
  equipment: "Equipment",
  chemical: "Chemical",
  consumable: "Consumable",
  sparePart: "Spare Part",
  other: "Other",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PurchaseCatalogPickerItem[];
  selectedItemId?: string;
  vehicleOnly?: boolean;
  onSelect: (item: PurchaseCatalogPickerItem) => void;
};

export default function PurchaseCatalogItemPicker({
  open,
  onOpenChange,
  items,
  selectedItemId,
  vehicleOnly = false,
  onSelect,
}: Props) {
  const { t, locale } = useT();
  const [itemType, setItemType] = useState<InventoryItemTypeCategory | null>(
    vehicleOnly ? "vehicle" : null
  );
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setSearch("");
    if (vehicleOnly) {
      setItemType("vehicle");
      return;
    }
    const selected = items.find((item) => item.id === selectedItemId);
    setItemType(
      selected ? inventoryItemTypeCategory(selected.itemType) : null
    );
  }, [open, selectedItemId, items, vehicleOnly]);

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
      PRODUCT_TYPE_ORDER.map((type) => ({
        id: type,
        label: localizeInventoryItemType(TYPE_PRESET[type], locale),
        count: items.filter(
          (item) => inventoryItemTypeCategory(item.itemType) === type
        ).length,
      })),
    [items, locale]
  );

  const columns: DataTableColumn<PurchaseCatalogPickerItem>[] = [
    {
      key: "name",
      title: t("pages.billing.purchaseSelectItem"),
      share: 2,
      render: (row) => (
        <div>
          <p className="font-medium text-text">{row.name}</p>
          <p className="text-xs text-subtle">{row.sku}</p>
        </div>
      ),
    },
    {
      key: "sku",
      title: t("pages.inventory.columns.sku"),
      width: "8rem",
      render: (row) => row.sku,
    },
  ];

  return (
    <Dialog skipUnsavedGuard open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[60] flex max-h-[min(92vh,44rem)] w-full flex-col gap-4 overflow-hidden sm:max-w-2xl"
        overlayClassName="z-[60]"
      >
        <DialogHeader>
          <DialogTitle>
            {vehicleOnly
              ? t("pages.billing.purchaseVehicleBought")
              : t("pages.billing.purchaseSelectItem")}
          </DialogTitle>
          <DialogDescription>
            {vehicleOnly
              ? t("pages.billing.purchaseSelectVehicleDesc")
              : t("pages.billing.purchaseSelectItemDesc")}
          </DialogDescription>
        </DialogHeader>

        {itemType ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {vehicleOnly ? null : (
              <div>
                <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                  {t("pages.billing.purchaseItemTypeLabel")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_TYPE_ORDER.map((type) => (
                    <DirectoryFilterTab
                      key={type}
                      size="sm"
                      active={itemType === type}
                      onClick={() => {
                        setItemType(type);
                        setSearch("");
                      }}
                    >
                      {localizeInventoryItemType(TYPE_PRESET[type], locale)}
                    </DirectoryFilterTab>
                  ))}
                </div>
              </div>
            )}

            <DirectorySearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("pages.billing.purchaseSearchItemsPlaceholder")}
              className="max-w-none"
            />

            <div className="min-h-0 flex-1 overflow-y-auto">
              <DataTable
                columns={columns}
                data={filteredItems}
                getRowKey={(row) => row.id}
                onRowClick={(row) => onSelect(row)}
                isRowSelected={(row) => row.id === selectedItemId}
                emptyMessage={
                  search.trim()
                    ? t("pages.billing.purchaseNoItemsMatchSearch")
                    : vehicleOnly
                      ? t("pages.billing.purchaseVehicleCatalogEmpty")
                      : t("pages.billing.purchaseNoItemsForType")
                }
              />
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">
              {t("pages.billing.purchaseItemTypeLabel")}
            </p>
            <p className="mb-3 text-xs text-subtle">
              {t("pages.billing.purchaseSelectItemTypeHint")}
            </p>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-elevated/60 text-left text-[0.6875rem] uppercase tracking-[0.12em] text-subtle">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">
                      {t("pages.billing.purchaseItemTypeLabel")}
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold">
                      {t("pages.billing.purchaseItemTypeCount")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {typeRows.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="p-0" colSpan={2}>
                        <button
                          type="button"
                          onClick={() => setItemType(row.id)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-3 py-3 text-left font-medium text-text transition",
                            "hover:bg-card-hover"
                          )}
                        >
                          <span>{row.label}</span>
                          <span className="tabular-nums text-subtle">
                            {row.count}
                          </span>
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
