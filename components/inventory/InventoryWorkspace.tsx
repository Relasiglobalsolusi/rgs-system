"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  Package,
  ShoppingCart,
  FolderKanban,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import {
  deactivateInventoryItem,
  reactivateInventoryItem,
} from "@/app/inventory/actions";
import InventoryAdjustDialog from "@/components/inventory/InventoryAdjustDialog";
import InventoryIssueDialog from "@/components/inventory/InventoryIssueDialog";
import InventoryItemDialog from "@/components/inventory/InventoryItemDialog";
import InventoryItemEditDialog from "@/components/inventory/InventoryItemEditDialog";
import InventoryPurchaseDialog from "@/components/inventory/InventoryPurchaseDialog";
import type {
  InventoryCatalogItem,
  InventoryIssueRow,
  InventoryProjectOption,
  InventoryPurchaseRow,
  InventoryTab,
  InventoryVendorOption,
} from "@/components/inventory/inventory-types";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { stockValueOnHand } from "@/lib/inventory";
import { formatDisplayDate } from "@/lib/format-date";
import { formatContractPrice } from "@/lib/project-billing";
import { useT } from "@/lib/i18n/use-t";
import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";

type Props = {
  canManage: boolean;
  items: InventoryCatalogItem[];
  purchases: InventoryPurchaseRow[];
  issues: InventoryIssueRow[];
  vendors: InventoryVendorOption[];
  projects: InventoryProjectOption[];
};

export default function InventoryWorkspace({
  canManage,
  items,
  purchases,
  issues,
  vendors,
  projects,
}: Props) {
  const { t } = useT();
  const [tab, setTab] = useState<InventoryTab>("items");
  const [searchQuery, setSearchQuery] = useState("");
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryCatalogItem | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const activeItems = useMemo(
    () => items.filter((item) => item.active),
    [items]
  );
  const inactiveItems = useMemo(
    () => items.filter((item) => !item.active),
    [items]
  );
  const lowStockCount = useMemo(
    () =>
      activeItems.filter(
        (item) => item.minStock > 0 && item.currentStock <= item.minStock
      ).length,
    [activeItems]
  );
  const totalStockValue = useMemo(
    () =>
      activeItems.reduce(
        (sum, item) =>
          sum + stockValueOnHand(item.currentStock, item.avgUnitCost),
        0
      ),
    [activeItems]
  );

  const trimmedSearch = searchQuery.trim();

  const visibleItems = useMemo(() => {
    const source = tab === "items" ? items : activeItems;
    return source.filter((item) =>
      matchesDirectorySearch(
        searchQuery,
        item.name,
        item.sku,
        item.itemType,
        item.category,
        item.description
      )
    );
  }, [tab, items, activeItems, searchQuery]);

  const visiblePurchases = useMemo(
    () =>
      purchases.filter((row) =>
        matchesDirectorySearch(
          searchQuery,
          row.item.name,
          row.item.sku,
          row.vendor.name,
          row.invoiceNo,
          row.notes
        )
      ),
    [purchases, searchQuery]
  );

  const visibleIssues = useMemo(
    () =>
      issues.filter((row) =>
        matchesDirectorySearch(
          searchQuery,
          row.item.name,
          row.item.sku,
          row.project?.name,
          row.notes
        )
      ),
    [issues, searchQuery]
  );

  const visibleStock = useMemo(
    () =>
      activeItems.filter((item) =>
        matchesDirectorySearch(
          searchQuery,
          item.name,
          item.sku,
          item.itemType,
          item.category
        )
      ),
    [activeItems, searchQuery]
  );

  function toggleItemActive(item: InventoryCatalogItem) {
    const formData = new FormData();
    formData.set("id", item.id);
    startTransition(async () => {
      try {
        if (item.active) {
          await deactivateInventoryItem(formData);
          toast.success(t("pages.inventory.itemDeactivated"));
        } else {
          await reactivateInventoryItem(formData);
          toast.success(t("pages.inventory.itemReactivated"));
        }
      } catch (error) {
        showRejectionFromError(
          error,
          item.active
            ? t("pages.inventory.deactivateItemFailed")
            : t("pages.inventory.reactivateItemFailed")
        );
      }
    });
  }

  const itemColumns: DataTableColumn<InventoryCatalogItem>[] = [
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
      title: t("pages.inventory.columns.itemType"),
      width: "8rem",
    },
    {
      key: "category",
      title: t("pages.inventory.columns.category"),
      width: "8rem",
      render: (row) => row.category || "—",
    },
    {
      key: "active",
      title: t("pages.inventory.columns.status"),
      width: "7rem",
      align: "center",
      render: (row) => (
        <StatusBadge status={row.active ? "active" : "inactive"} compact>
          {row.active
            ? t("pages.inventory.status.active")
            : t("pages.inventory.status.inactive")}
        </StatusBadge>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            title: t("pages.inventory.columns.actions"),
            width: "11rem",
            align: "right" as const,
            render: (row: InventoryCatalogItem) => (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  size="badgeFlex"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setEditItem(row)}
                >
                  {t("common.actions.edit")}
                </Button>
                <Button
                  type="button"
                  size="badgeFlex"
                  variant={row.active ? "outline" : "successBadge"}
                  disabled={pending}
                  onClick={() => toggleItemActive(row)}
                >
                  {row.active
                    ? t("pages.inventory.deactivate")
                    : t("common.actions.restore")}
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const purchaseColumns: DataTableColumn<InventoryPurchaseRow>[] = [
    {
      key: "purchasedAt",
      title: t("pages.inventory.columns.date"),
      width: "8rem",
      render: (row) => formatDisplayDate(row.purchasedAt),
    },
    {
      key: "item",
      title: t("pages.inventory.columns.item"),
      share: 2,
      render: (row) => (
        <div>
          <p className="font-medium text-text">{row.item.name}</p>
          <p className="text-xs text-subtle">{row.item.sku}</p>
        </div>
      ),
    },
    {
      key: "vendor",
      title: t("pages.inventory.columns.vendor"),
      share: 1.5,
      render: (row) => row.vendor.name,
    },
    {
      key: "quantity",
      title: t("pages.inventory.columns.qty"),
      width: "7rem",
      align: "right",
      render: (row) => `${row.quantity} ${row.item.unit}`,
    },
    {
      key: "unitPrice",
      title: t("pages.inventory.columns.unitPrice"),
      width: "8rem",
      align: "right",
      render: (row) => formatContractPrice(row.unitPrice),
    },
    {
      key: "totalPrice",
      title: t("pages.inventory.columns.total"),
      width: "8rem",
      align: "right",
      render: (row) => formatContractPrice(row.totalPrice),
    },
    {
      key: "invoiceNo",
      title: t("pages.inventory.columns.invoice"),
      width: "8rem",
      render: (row) =>
        row.receiptUrl ? (
          <a
            href={row.receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            {row.invoiceNo || t("pages.inventory.viewReceipt")}
          </a>
        ) : (
          row.invoiceNo || "—"
        ),
    },
  ];

  const issueColumns: DataTableColumn<InventoryIssueRow>[] = [
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
          <p className="font-medium text-text">{row.item.name}</p>
          <p className="text-xs text-subtle">{row.item.sku}</p>
        </div>
      ),
    },
    {
      key: "project",
      title: t("pages.inventory.columns.project"),
      share: 2,
      render: (row) =>
        row.project ? (
          <Link
            href={`/projects/${row.project.id}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {row.project.name}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      key: "quantity",
      title: t("pages.inventory.columns.qty"),
      width: "7rem",
      align: "right",
      render: (row) => `${row.quantity} ${row.item.unit}`,
    },
    {
      key: "unitCost",
      title: t("pages.inventory.columns.unitCost"),
      width: "8rem",
      align: "right",
      render: (row) => formatContractPrice(row.unitCost),
    },
    {
      key: "totalCost",
      title: t("pages.inventory.columns.projectCost"),
      width: "8rem",
      align: "right",
      render: (row) => formatContractPrice(row.totalCost),
    },
  ];

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
      render: (row) => row.name,
    },
    {
      key: "currentStock",
      title: t("pages.inventory.columns.onHand"),
      width: "8rem",
      align: "right",
      render: (row) => {
        const low = row.minStock > 0 && row.currentStock <= row.minStock;
        return (
          <span className={low ? "font-semibold text-warning" : undefined}>
            {row.currentStock} {row.unit}
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
        row.minStock > 0 ? `${row.minStock} ${row.unit}` : "—",
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
        formatContractPrice(stockValueOnHand(row.currentStock, row.avgUnitCost)),
    },
  ];

  const emptyByTab: Record<
    InventoryTab,
    { title: string; description: string; rows: unknown[] }
  > = {
    items: {
      title: trimmedSearch
        ? t("pages.inventory.emptySearch", { query: trimmedSearch })
        : t("pages.inventory.emptyItems"),
      description: trimmedSearch
        ? t("pages.inventory.emptySearchDesc")
        : t("pages.inventory.emptyItemsDesc"),
      rows: visibleItems,
    },
    purchases: {
      title: trimmedSearch
        ? t("pages.inventory.emptySearch", { query: trimmedSearch })
        : t("pages.inventory.emptyPurchases"),
      description: trimmedSearch
        ? t("pages.inventory.emptySearchDesc")
        : t("pages.inventory.emptyPurchasesDesc"),
      rows: visiblePurchases,
    },
    issues: {
      title: trimmedSearch
        ? t("pages.inventory.emptySearch", { query: trimmedSearch })
        : t("pages.inventory.emptyIssues"),
      description: trimmedSearch
        ? t("pages.inventory.emptySearchDesc")
        : t("pages.inventory.emptyIssuesDesc"),
      rows: visibleIssues,
    },
    stock: {
      title: trimmedSearch
        ? t("pages.inventory.emptySearch", { query: trimmedSearch })
        : t("pages.inventory.emptyStock"),
      description: trimmedSearch
        ? t("pages.inventory.emptySearchDesc")
        : t("pages.inventory.emptyStockDesc"),
      rows: visibleStock,
    },
  };

  const empty = emptyByTab[tab];

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DirectoryStatCard
          title={t("pages.inventory.tabs.items")}
          value={activeItems.length}
          subtitle={t("pages.inventory.stats.itemsSubtitle", {
            inactive: String(inactiveItems.length),
          })}
          icon={<Package size={18} />}
          accent="info"
          selected={tab === "items"}
          onClick={() => {
            setTab("items");
            setSearchQuery("");
          }}
        />
        <DirectoryStatCard
          title={t("pages.inventory.tabs.purchases")}
          value={purchases.length}
          subtitle={t("pages.inventory.stats.purchasesSubtitle")}
          icon={<ShoppingCart size={18} />}
          accent="success"
          selected={tab === "purchases"}
          onClick={() => {
            setTab("purchases");
            setSearchQuery("");
          }}
        />
        <DirectoryStatCard
          title={t("pages.inventory.tabs.issues")}
          value={issues.length}
          subtitle={t("pages.inventory.stats.issuesSubtitle")}
          icon={<FolderKanban size={18} />}
          accent="warning"
          selected={tab === "issues"}
          onClick={() => {
            setTab("issues");
            setSearchQuery("");
          }}
        />
        <DirectoryStatCard
          title={t("pages.inventory.tabs.stock")}
          value={formatContractPrice(totalStockValue)}
          subtitle={t("pages.inventory.stats.stockSubtitle", {
            low: String(lowStockCount),
          })}
          icon={<Boxes size={18} />}
          accent={lowStockCount > 0 ? "danger" : "info"}
          selected={tab === "stock"}
          onClick={() => {
            setTab("stock");
            setSearchQuery("");
          }}
        />
      </div>

      <p className="mb-4 text-sm text-muted">
        {t("pages.inventory.costingNote")}
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DirectorySearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("pages.inventory.searchPlaceholder")}
          className="min-w-[12rem] w-auto max-w-none flex-1"
        />
        {canManage ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {tab === "items" ? (
              <DirectoryAddButton
                label={t("pages.inventory.addItem")}
                onClick={() => setCreateItemOpen(true)}
              />
            ) : null}
            {tab === "purchases" ? (
              <DirectoryAddButton
                label={t("pages.inventory.addPurchase")}
                onClick={() => setPurchaseOpen(true)}
              />
            ) : null}
            {tab === "issues" ? (
              <DirectoryAddButton
                label={t("pages.inventory.addIssue")}
                onClick={() => setIssueOpen(true)}
              />
            ) : null}
            {tab === "stock" ? (
              <DirectoryAddButton
                label={t("pages.inventory.adjustStock")}
                icon={<SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />}
                onClick={() => setAdjustOpen(true)}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {empty.rows.length === 0 ? (
        <SectionCard>
          <EmptyState title={empty.title} description={empty.description} />
        </SectionCard>
      ) : tab === "items" ? (
        <DataTable
          columns={itemColumns}
          data={visibleItems}
          getRowKey={(row) => row.id}
        />
      ) : tab === "purchases" ? (
        <DataTable
          columns={purchaseColumns}
          data={visiblePurchases}
          getRowKey={(row) => row.id}
        />
      ) : tab === "issues" ? (
        <DataTable
          columns={issueColumns}
          data={visibleIssues}
          getRowKey={(row) => row.id}
        />
      ) : (
        <DataTable
          columns={stockColumns}
          data={visibleStock}
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
          <InventoryItemEditDialog
            item={editItem}
            open={editItem != null}
            onOpenChange={(next) => {
              if (!next) setEditItem(null);
            }}
          />
          <InventoryPurchaseDialog
            open={purchaseOpen}
            onOpenChange={setPurchaseOpen}
            items={items}
            vendors={vendors}
          />
          <InventoryIssueDialog
            open={issueOpen}
            onOpenChange={setIssueOpen}
            items={items}
            projects={projects}
          />
          <InventoryAdjustDialog
            open={adjustOpen}
            onOpenChange={setAdjustOpen}
            items={items}
          />
        </>
      ) : null}
    </>
  );
}
