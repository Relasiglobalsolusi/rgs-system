"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  FolderKanban,
  ShoppingCart,
  Trash2,
} from "lucide-react";

import InventoryIssueDialog from "@/components/inventory/InventoryIssueDialog";
import InventoryPurchaseDialog from "@/components/inventory/InventoryPurchaseDialog";
import InventoryWriteOffDialog from "@/components/inventory/InventoryWriteOffDialog";
import type {
  InventoryCatalogItem,
  InventoryIssueRow,
  InventoryProjectOption,
  InventoryPurchaseRow,
  InventoryTab,
  InventoryVendorOption,
  InventoryWriteOffRow,
} from "@/components/inventory/inventory-types";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { stockValueOnHand } from "@/lib/inventory";
import { formatDisplayDate } from "@/lib/format-date";
import { formatContractPrice } from "@/lib/project-billing";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  canManage: boolean;
  /** OM+ / Director / HO admin — issue stock to projects and write off stock. */
  canAssignToProject: boolean;
  items: InventoryCatalogItem[];
  purchases: InventoryPurchaseRow[];
  issues: InventoryIssueRow[];
  writeOffs: InventoryWriteOffRow[];
  vendors: InventoryVendorOption[];
  projects: InventoryProjectOption[];
};

export default function InventoryWorkspace({
  canManage,
  canAssignToProject,
  items,
  purchases,
  issues,
  writeOffs,
  vendors,
  projects,
}: Props) {
  const { t } = useT();
  const [tab, setTab] = useState<InventoryTab>("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);

  const activeItems = useMemo(
    () => items.filter((item) => item.active),
    [items]
  );
  /** Fixed low-stock threshold: warn whenever on-hand stock drops below 5 units. */
  const LOW_STOCK_THRESHOLD = 5;
  const lowStockCount = useMemo(
    () =>
      activeItems.filter((item) => item.currentStock < LOW_STOCK_THRESHOLD).length,
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

  const visibleWriteOffs = useMemo(
    () =>
      writeOffs.filter((row) =>
        matchesDirectorySearch(
          searchQuery,
          row.item.name,
          row.item.sku,
          row.reason,
          row.createdBy?.username
        )
      ),
    [writeOffs, searchQuery]
  );

  const visibleStock = useMemo(
    () =>
      activeItems.filter((item) =>
        matchesDirectorySearch(
          searchQuery,
          item.name,
          item.sku,
          item.itemType
        )
      ),
    [activeItems, searchQuery]
  );

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
          <p className="font-medium text-text">{row.item.name}</p>
          <p className="text-xs text-subtle">{row.item.sku}</p>
        </div>
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
      render: (row) => (row.unitCost > 0 ? formatContractPrice(row.unitCost) : "—"),
    },
    {
      key: "totalCost",
      title: t("pages.inventory.columns.writeOffValue"),
      width: "9rem",
      align: "right",
      render: (row) => (row.totalCost > 0 ? formatContractPrice(row.totalCost) : "—"),
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
      render: (row) => row.createdBy?.username ?? "—",
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
        const low = row.currentStock < LOW_STOCK_THRESHOLD;
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
    writeOffs: {
      title: trimmedSearch
        ? t("pages.inventory.emptySearch", { query: trimmedSearch })
        : t("pages.inventory.emptyWriteOffs"),
      description: trimmedSearch
        ? t("pages.inventory.emptySearchDesc")
        : t("pages.inventory.emptyWriteOffsDesc"),
      rows: visibleWriteOffs,
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
          title={t("pages.inventory.tabs.writeOffs")}
          value={writeOffs.length}
          subtitle={t("pages.inventory.stats.writeOffsSubtitle")}
          icon={<Trash2 size={18} />}
          accent="danger"
          selected={tab === "writeOffs"}
          onClick={() => {
            setTab("writeOffs");
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
            {tab === "purchases" ? (
              <DirectoryAddButton
                label={t("pages.inventory.addPurchase")}
                onClick={() => setPurchaseOpen(true)}
              />
            ) : null}
            {tab === "issues" && canAssignToProject ? (
              <DirectoryAddButton
                label={t("pages.inventory.addIssue")}
                onClick={() => setIssueOpen(true)}
              />
            ) : null}
            {tab === "writeOffs" && canAssignToProject ? (
              <DirectoryAddButton
                label={t("pages.inventory.addWriteOff")}
                onClick={() => setWriteOffOpen(true)}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {empty.rows.length === 0 ? (
        <SectionCard>
          <EmptyState title={empty.title} description={empty.description} />
        </SectionCard>
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
      ) : tab === "writeOffs" ? (
        <DataTable
          columns={writeOffColumns}
          data={visibleWriteOffs}
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
          <InventoryPurchaseDialog
            open={purchaseOpen}
            onOpenChange={setPurchaseOpen}
            items={items}
            vendors={vendors}
          />
          {canAssignToProject ? (
            <>
              <InventoryIssueDialog
                open={issueOpen}
                onOpenChange={setIssueOpen}
                items={items}
                projects={projects}
              />
              <InventoryWriteOffDialog
                open={writeOffOpen}
                onOpenChange={setWriteOffOpen}
                items={items}
              />
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
