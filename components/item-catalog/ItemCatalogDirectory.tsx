"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  Boxes,
  Car,
  Cog,
  FileSpreadsheet,
  FlaskConical,
  ListPlus,
  Package,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { deleteInventoryItem } from "@/app/inventory/actions";
import {
  confirmBulkImportInventoryItems,
  previewBulkImportInventoryItems,
} from "@/app/inventory/import-actions";
import BulkImportDialog from "@/components/bulk-import/BulkImportDialog";
import InventoryItemDialog from "@/components/inventory/InventoryItemDialog";
import ItemCatalogBulkCreateDialog from "@/components/item-catalog/ItemCatalogBulkCreateDialog";
import InventoryItemEditDialog from "@/components/inventory/InventoryItemEditDialog";
import {
  INVENTORY_CATEGORY_DISPLAY_ORDER,
  INVENTORY_CATEGORY_TITLE_KEY,
  inventoryItemTypeCategory,
  partitionItemsByInventoryItemType,
  type InventoryItemTypeCategory,
} from "@/components/inventory/inventory-category";
import type { InventoryCatalogItem } from "@/components/inventory/inventory-types";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DirectoryStatGrid from "@/components/ui/DirectoryStatGrid";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  ACTIONS_SINGLE_CHIP_COLUMN_WIDTH,
  trashActionChipClassName,
} from "@/components/ui/trash-action-buttons";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { localizeInventoryItemType } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { showRejectionFromError } from "@/components/ui/rejection-notice";

type Props = {
  canManage: boolean;
  items: InventoryCatalogItem[];
};

export default function ItemCatalogDirectory({ canManage, items }: Props) {
  const { t, locale } = useT();
  const confirm = useConfirm();
  const [searchQuery, setSearchQuery] = useState("");
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
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
          localizeInventoryItemType(item.itemType, locale),
          item.description
        )
      ),
    [items, searchQuery, locale]
  );

  const categorized = useMemo(
    () => partitionItemsByInventoryItemType(visibleItems),
    [visibleItems]
  );
  const categorizedAll = useMemo(
    () => partitionItemsByInventoryItemType(items),
    [items]
  );

  const categoryMeta: Record<
    InventoryItemTypeCategory,
    {
      accent: "primary" | "success" | "warning" | "danger" | "info" | "muted";
      status: "success" | "warning" | "danger" | "info" | "inactive" | "pending";
      icon: ReactNode;
    }
  > = {
    equipment: {
      accent: "success",
      status: "success",
      icon: <Wrench size={18} />,
    },
    vehicle: {
      accent: "info",
      status: "info",
      icon: <Car size={18} />,
    },
    sparePart: {
      accent: "warning",
      status: "warning",
      icon: <Cog size={18} />,
    },
    chemical: {
      accent: "danger",
      status: "danger",
      icon: <FlaskConical size={18} />,
    },
    consumable: {
      accent: "primary",
      status: "pending",
      icon: <Package size={18} />,
    },
    other: {
      accent: "muted",
      status: "inactive",
      icon: <Boxes size={18} />,
    },
  };

  async function deleteItem(item: InventoryCatalogItem) {
    const confirmed = await confirm({
      title: t("pages.itemCatalog.delete"),
      description: t("pages.itemCatalog.deleteConfirm", { name: item.name }),
      confirmLabel: t("common.actions.delete"),
      tone: "danger",
    });
    if (!confirmed) return;
    const formData = new FormData();
    formData.set("id", item.id);
    startTransition(async () => {
      try {
        await deleteInventoryItem(formData);
        toast.success(t("pages.itemCatalog.itemDeleted"));
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.itemCatalog.deleteItemFailed")
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
      width: "10rem",
      cellAlign: "center",
      className: "min-w-[10rem] overflow-visible",
      render: (row) => {
        const category = inventoryItemTypeCategory(row.itemType);
        return (
          <StatusBadge status={categoryMeta[category].status} compact>
            {localizeInventoryItemType(row.itemType, locale)}
          </StatusBadge>
        );
      },
    },
    {
      key: "status",
      title: t("pages.itemCatalog.columns.status"),
      width: "8rem",
      cellAlign: "center",
      className: "min-w-[8rem] overflow-visible",
      render: (row) => (
        <StatusBadge status={row.active ? "success" : "inactive"} compact>
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
            width: ACTIONS_SINGLE_CHIP_COLUMN_WIDTH,
            cellAlign: "center" as const,
            className: "min-w-[12.5rem] overflow-visible",
            render: (row: InventoryCatalogItem) => (
              <div className="flex flex-col items-center justify-center gap-2">
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
                  variant="outline"
                  className={trashActionChipClassName}
                  disabled={pending}
                  onClick={() => deleteItem(row)}
                >
                  {t("pages.itemCatalog.delete")}
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <DirectoryStatGrid className="mb-5">
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.itemCatalog.stats.activeTitle")}
          value={activeItems.length}
          subtitle={t("pages.itemCatalog.stats.activeSubtitle", {
            inactive: String(inactiveItems.length),
          })}
          icon={<Package size={18} />}
          accent="success"
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.itemCatalog.stats.inactiveTitle")}
          value={inactiveItems.length}
          subtitle={t("pages.itemCatalog.stats.inactiveSubtitle")}
          icon={<Boxes size={18} />}
          accent={inactiveItems.length > 0 ? "warning" : "muted"}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.itemCatalog.stats.totalTitle")}
          value={items.length}
          subtitle={t("pages.itemCatalog.stats.totalSubtitle")}
          icon={<Package size={18} />}
          accent="info"
        />
      </DirectoryStatGrid>
      <DirectoryStatGrid className="mb-5">
        {INVENTORY_CATEGORY_DISPLAY_ORDER.map((key) => (
          <DirectoryStatCard
            key={key}
            compact
            tinted
            title={t(INVENTORY_CATEGORY_TITLE_KEY[key])}
            value={categorizedAll[key].length}
            accent={categoryMeta[key].accent}
            icon={categoryMeta[key].icon}
          />
        ))}
      </DirectoryStatGrid>

      <p className="mb-3 text-sm text-subtle">
        {t("pages.itemCatalog.deleteHint")}
      </p>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <DirectorySearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("pages.itemCatalog.searchPlaceholder")}
          className="min-w-0 w-full max-w-none sm:max-w-xs sm:flex-1"
        />
        {canManage ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
            <DirectoryAddButton
              label={t("pages.itemCatalog.addItem")}
              onClick={() => setCreateItemOpen(true)}
            />
            <DirectoryAddButton
              label={t("common.actions.addBulk")}
              variant="infoBadge"
              icon={<ListPlus className="h-3.5 w-3.5 shrink-0" />}
              onClick={() => setBulkCreateOpen(true)}
            />
            <DirectoryAddButton
              label={t("pages.itemCatalog.importExcel")}
              variant="infoBadge"
              icon={<FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />}
              onClick={() => setExcelImportOpen(true)}
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
        <div className="space-y-8">
          {INVENTORY_CATEGORY_DISPLAY_ORDER.map((key) =>
            categorized[key].length > 0 ? (
              <div key={key} className="space-y-2">
                <p className="text-sm font-semibold text-text">
                  {t(INVENTORY_CATEGORY_TITLE_KEY[key])}{" "}
                  <span className="font-medium text-subtle">
                    ({categorized[key].length})
                  </span>
                </p>
                <DataTable
                  columns={columns}
                  data={categorized[key]}
                  getRowKey={(row) => row.id}
                />
              </div>
            ) : null
          )}
        </div>
      )}

      {canManage ? (
        <>
          <InventoryItemDialog
            open={createItemOpen}
            onOpenChange={setCreateItemOpen}
            showTrigger={false}
          />
          <ItemCatalogBulkCreateDialog
            open={bulkCreateOpen}
            onOpenChange={setBulkCreateOpen}
          />
          <BulkImportDialog
            open={excelImportOpen}
            onOpenChange={setExcelImportOpen}
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
