"use client";

import { useMemo, useState, useTransition } from "react";
import { FileSpreadsheet, Package } from "lucide-react";
import { toast } from "sonner";

import {
  deactivateInventoryItem,
  reactivateInventoryItem,
} from "@/app/inventory/actions";
import {
  confirmBulkImportInventoryItems,
  previewBulkImportInventoryItems,
} from "@/app/inventory/import-actions";
import BulkImportDialog from "@/components/bulk-import/BulkImportDialog";
import InventoryItemDialog from "@/components/inventory/InventoryItemDialog";
import InventoryItemEditDialog from "@/components/inventory/InventoryItemEditDialog";
import type { InventoryCatalogItem } from "@/components/inventory/inventory-types";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  ACTIONS_DUAL_CHIP_COLUMN_WIDTH,
  trashActionChipClassName,
} from "@/components/ui/trash-action-buttons";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";
import { showRejectionFromError } from "@/components/ui/rejection-notice";

type Props = {
  canManage: boolean;
  items: InventoryCatalogItem[];
};

export default function ItemCatalogDirectory({ canManage, items }: Props) {
  const { t } = useT();
  const [searchQuery, setSearchQuery] = useState("");
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryCatalogItem | null>(null);
  const [pending, startTransition] = useTransition();

  const activeItems = useMemo(
    () => items.filter((item) => item.active),
    [items]
  );
  const inactiveItems = useMemo(
    () => items.filter((item) => !item.active),
    [items]
  );

  const trimmedSearch = searchQuery.trim();

  const visibleItems = useMemo(
    () =>
      items.filter((item) =>
        matchesDirectorySearch(
          searchQuery,
          item.name,
          item.sku,
          item.itemType,
          item.description
        )
      ),
    [items, searchQuery]
  );

  function toggleItemActive(item: InventoryCatalogItem) {
    const formData = new FormData();
    formData.set("id", item.id);
    startTransition(async () => {
      try {
        if (item.active) {
          await deactivateInventoryItem(formData);
          toast.success(t("pages.itemCatalog.itemDeactivated"));
        } else {
          await reactivateInventoryItem(formData);
          toast.success(t("pages.itemCatalog.itemReactivated"));
        }
      } catch (error) {
        showRejectionFromError(
          error,
          item.active
            ? t("pages.itemCatalog.deactivateItemFailed")
            : t("pages.itemCatalog.reactivateItemFailed")
        );
      }
    });
  }

  const columns: DataTableColumn<InventoryCatalogItem>[] = [
    {
      key: "sku",
      title: t("pages.itemCatalog.columns.sku"),
      width: "7rem",
      render: (row) => (
        <span className="font-mono text-sm text-muted">{row.sku}</span>
      ),
    },
    {
      key: "name",
      title: t("pages.itemCatalog.columns.item"),
      share: 2,
      render: (row) => (
        <div>
          <p className="font-medium text-text">{row.name}</p>
          {row.description ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-subtle">
              {row.description}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "itemType",
      title: t("pages.itemCatalog.columns.itemType"),
      width: "8rem",
    },
    {
      key: "active",
      title: t("pages.itemCatalog.columns.status"),
      width: "7rem",
      align: "center",
      render: (row) => (
        <StatusBadge status={row.active ? "active" : "inactive"} compact>
          {row.active
            ? t("pages.itemCatalog.status.active")
            : t("pages.itemCatalog.status.inactive")}
        </StatusBadge>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            title: t("pages.itemCatalog.columns.actions"),
            width: ACTIONS_DUAL_CHIP_COLUMN_WIDTH,
            align: "center" as const,
            className: "min-w-[20rem] overflow-visible whitespace-nowrap",
            render: (row: InventoryCatalogItem) => (
              <div className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap">
                <Button
                  type="button"
                  size="badge"
                  variant="outline"
                  className={trashActionChipClassName}
                  disabled={pending}
                  onClick={() => setEditItem(row)}
                >
                  {t("common.actions.edit")}
                </Button>
                <Button
                  type="button"
                  size="badge"
                  variant={row.active ? "outline" : "successBadge"}
                  className={trashActionChipClassName}
                  disabled={pending}
                  onClick={() => toggleItemActive(row)}
                >
                  {row.active
                    ? t("pages.itemCatalog.deactivate")
                    : t("common.actions.restore")}
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DirectoryStatCard
          title={t("pages.itemCatalog.stats.activeTitle")}
          value={activeItems.length}
          subtitle={t("pages.itemCatalog.stats.activeSubtitle", {
            inactive: String(inactiveItems.length),
          })}
          icon={<Package size={18} />}
          accent="info"
          selected
        />
        <DirectoryStatCard
          title={t("pages.itemCatalog.stats.totalTitle")}
          value={items.length}
          subtitle={t("pages.itemCatalog.stats.totalSubtitle")}
          icon={<Package size={18} />}
          accent="success"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DirectorySearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("pages.itemCatalog.searchPlaceholder")}
          className="min-w-[12rem] w-auto max-w-none flex-1"
        />
        {canManage ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <DirectoryAddButton
              label={t("pages.itemCatalog.addItem")}
              onClick={() => setCreateItemOpen(true)}
            />
            <DirectoryAddButton
              label={t("common.actions.addBulk")}
              variant="infoBadge"
              icon={<FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />}
              onClick={() => setBulkImportOpen(true)}
            />
          </div>
        ) : null}
      </div>

      {visibleItems.length === 0 ? (
        <SectionCard>
          <EmptyState
            title={
              trimmedSearch
                ? t("pages.itemCatalog.emptySearch", { query: trimmedSearch })
                : t("pages.itemCatalog.emptyItems")
            }
            description={
              trimmedSearch
                ? t("pages.itemCatalog.emptySearchDesc")
                : t("pages.itemCatalog.emptyItemsDesc")
            }
          />
        </SectionCard>
      ) : (
        <DataTable
          columns={columns}
          data={visibleItems}
          getRowKey={(row) => row.id}
        />
      )}

      {canManage ? (
        <>
          <InventoryItemDialog
            open={createItemOpen}
            onOpenChange={setCreateItemOpen}
            showTrigger={false}
          />
          <BulkImportDialog
            open={bulkImportOpen}
            onOpenChange={setBulkImportOpen}
            entityLabel="inventoryItem"
            templateUrl="/api/inventory/bulk-template"
            onPreview={previewBulkImportInventoryItems}
            onConfirm={confirmBulkImportInventoryItems}
          />
          <InventoryItemEditDialog
            item={editItem}
            open={editItem != null}
            onOpenChange={(next) => {
              if (!next) setEditItem(null);
            }}
          />
        </>
      ) : null}
    </>
  );
}
