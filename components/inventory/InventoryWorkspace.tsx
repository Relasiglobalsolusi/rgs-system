"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Boxes,
  CircleDollarSign,
  FolderKanban,
  ShoppingCart,
  Trash2,
  Wrench,
} from "lucide-react";

import {
  searchInventoryPurchases,
  searchInventorySoldOffs,
} from "@/app/inventory/actions";
import InventoryAssetList from "@/components/inventory/InventoryAssetList";
import InventoryProjectIssues from "@/components/inventory/InventoryProjectIssues";
import InventoryPurchaseDialog from "@/components/inventory/InventoryPurchaseDialog";
import InventoryReverseWriteOffDialog from "@/components/inventory/InventoryReverseWriteOffDialog";
import InventorySoldOffDialog from "@/components/inventory/InventorySoldOffDialog";
import InventorySoldOffTables from "@/components/inventory/InventorySoldOffTables";
import InventoryStockTables from "@/components/inventory/InventoryStockTables";
import InventoryWriteOffDialog from "@/components/inventory/InventoryWriteOffDialog";
import InventoryWriteOffTables from "@/components/inventory/InventoryWriteOffTables";
import { matchInventoryItemType } from "@/components/inventory/inventory-category";
import type {
  InventoryCatalogItem,
  InventoryIssueRow,
  InventoryOverviewAssetRow,
  InventoryPurchaseRow,
  InventorySoldOffRow,
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
import {
  isBelowMinStock,
  stockValueOnHand,
  formatInventoryQtyWithUnit,
} from "@/lib/inventory";
import { useT } from "@/lib/i18n/use-t";
import { formatDisplayDate } from "@/lib/format-date";
import { formatContractPrice } from "@/lib/project-billing";

type Props = {
  canManage: boolean;
  /** OM+ / Director / HO admin — write off / sell stock (issues only via MR → TO). */
  canAssignToProject: boolean;
  items: InventoryCatalogItem[];
  purchases: InventoryPurchaseRow[];
  issues: InventoryIssueRow[];
  writeOffs: InventoryWriteOffRow[];
  soldOffs: InventorySoldOffRow[];
  vendors: InventoryVendorOption[];
  equipmentAssets: InventoryOverviewAssetRow[];
};

export default function InventoryWorkspace({
  canManage,
  canAssignToProject,
  items,
  purchases,
  issues,
  writeOffs,
  soldOffs,
  vendors,
  equipmentAssets,
}: Props) {
  const { t } = useT();
  const [tab, setTab] = useState<InventoryTab>("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [soldOffOpen, setSoldOffOpen] = useState(false);
  const [reverseWriteOffTarget, setReverseWriteOffTarget] =
    useState<InventoryWriteOffRow | null>(null);
  const [searchedPurchases, setSearchedPurchases] = useState<
    InventoryPurchaseRow[] | null
  >(null);
  const [searchedSoldOffs, setSearchedSoldOffs] = useState<
    InventorySoldOffRow[] | null
  >(null);
  const [searchPending, startSearchTransition] = useTransition();

  const activeItems = useMemo(
    () => items.filter((item) => item.active),
    [items]
  );
  /** Chemical / Consumable / Other — Equipment lives on Asset List. */
  const nonEquipmentItems = useMemo(
    () =>
      activeItems.filter(
        (item) => !matchInventoryItemType(item.itemType, "equipment")
      ),
    [activeItems]
  );
  const equipmentCatalogItems = useMemo(
    () =>
      activeItems.filter((item) =>
        matchInventoryItemType(item.itemType, "equipment")
      ),
    [activeItems]
  );

  const lowStockCount = useMemo(
    () =>
      nonEquipmentItems.filter((item) =>
        isBelowMinStock(item.currentStock, item.minStock)
      ).length,
    [nonEquipmentItems]
  );
  const totalStockValue = useMemo(
    () =>
      nonEquipmentItems.reduce(
        (sum, item) =>
          sum + stockValueOnHand(item.currentStock, item.avgUnitCost),
        0
      ),
    [nonEquipmentItems]
  );

  /** Owned equipment units by catalog item (AVAILABLE + ON_PROJECT; excludes RETIRED). */
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

  const equipmentStats = useMemo(() => {
    let warehouse = 0;
    let owned = 0;
    let ownedValue = 0;
    for (const item of equipmentCatalogItems) {
      const counts = equipmentOwnedByItem.get(item.id);
      const itemWarehouse = counts?.warehouse ?? 0;
      const itemOwned = itemWarehouse + (counts?.onProject ?? 0);
      warehouse += itemWarehouse;
      owned += itemOwned;
      ownedValue += counts?.ownedValue ?? 0;
    }
    return { warehouse, owned, ownedValue };
  }, [equipmentCatalogItems, equipmentOwnedByItem]);

  const trimmedSearch = searchQuery.trim();

  useEffect(() => {
    if (tab !== "purchases") {
      setSearchedPurchases(null);
      return;
    }
    if (!trimmedSearch) {
      setSearchedPurchases(null);
      return;
    }

    const handle = window.setTimeout(() => {
      startSearchTransition(async () => {
        try {
          const rows = await searchInventoryPurchases(trimmedSearch);
          setSearchedPurchases(rows);
        } catch {
          setSearchedPurchases([]);
        }
      });
    }, 300);

    return () => window.clearTimeout(handle);
  }, [tab, trimmedSearch]);

  useEffect(() => {
    if (tab !== "soldOff") {
      setSearchedSoldOffs(null);
      return;
    }
    if (!trimmedSearch) {
      setSearchedSoldOffs(null);
      return;
    }

    const handle = window.setTimeout(() => {
      startSearchTransition(async () => {
        try {
          const rows = await searchInventorySoldOffs(trimmedSearch);
          setSearchedSoldOffs(rows);
        } catch {
          setSearchedSoldOffs([]);
        }
      });
    }, 300);

    return () => window.clearTimeout(handle);
  }, [tab, trimmedSearch]);

  const visiblePurchases = useMemo(() => {
    const source = searchedPurchases ?? purchases;
    return source.filter(
      (row) => row.item?.id != null && row.vendor?.id != null
    );
  }, [purchases, searchedPurchases]);

  const visibleSoldOffs = useMemo(
    () => searchedSoldOffs ?? soldOffs,
    [searchedSoldOffs, soldOffs]
  );

  const visibleStock = useMemo(
    () =>
      nonEquipmentItems
        .filter((item) => item?.id != null)
        .filter((item) =>
          matchesDirectorySearch(
            searchQuery,
            item?.name,
            item?.sku,
            item?.itemType
          )
        ),
    [nonEquipmentItems, searchQuery]
  );

  const visibleEquipment = useMemo(() => {
    if (!trimmedSearch) return equipmentCatalogItems;
    return equipmentCatalogItems.filter((item) => {
      if (
        matchesDirectorySearch(
          searchQuery,
          item.name,
          item.sku,
          item.itemType
        )
      ) {
        return true;
      }
      return equipmentAssets.some(
        (asset) =>
          asset.item?.id === item.id &&
          matchesDirectorySearch(
            searchQuery,
            asset.assetCode,
            asset.serialNo,
            asset.notes,
            asset.project?.name
          )
      );
    });
  }, [
    equipmentAssets,
    equipmentCatalogItems,
    searchQuery,
    trimmedSearch,
  ]);

  function selectTab(next: InventoryTab) {
    setTab(next);
    setSearchQuery("");
    setSearchedPurchases(null);
    setSearchedSoldOffs(null);
  }

  const searchPlaceholder =
    tab === "purchases"
      ? t("pages.inventory.searchPurchasesPlaceholder")
      : tab === "soldOff"
        ? t("pages.inventory.searchSoldOffsPlaceholder")
        : t("pages.inventory.searchPlaceholder");

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
          <p className="font-medium text-text">{row.item?.name ?? "—"}</p>
          <p className="text-xs text-subtle">{row.item?.sku ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "vendor",
      title: t("pages.inventory.columns.vendor"),
      share: 1.5,
      render: (row) => row.vendor?.name ?? "—",
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

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <DirectoryStatCard
          compact
          title={t("pages.inventory.tabs.stock")}
          value={formatContractPrice(totalStockValue)}
          subtitle={t("pages.inventory.stats.stockSubtitle", {
            low: String(lowStockCount),
          })}
          icon={<Boxes size={18} />}
          accent={lowStockCount > 0 ? "danger" : "info"}
          selected={tab === "stock"}
          onClick={() => selectTab("stock")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.inventory.tabs.assetList")}
          value={formatContractPrice(equipmentStats.ownedValue)}
          subtitle={t("pages.inventory.stats.assetListSubtitle", {
            warehouse: String(equipmentStats.warehouse),
            owned: String(equipmentStats.owned),
          })}
          icon={<Wrench size={18} />}
          accent="muted"
          selected={tab === "assetList"}
          onClick={() => selectTab("assetList")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.inventory.tabs.issues")}
          value={issues.length}
          subtitle={t("pages.inventory.stats.issuesSubtitle")}
          icon={<FolderKanban size={18} />}
          accent="warning"
          selected={tab === "issues"}
          onClick={() => selectTab("issues")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.inventory.tabs.purchases")}
          value={purchases.length}
          subtitle={t("pages.inventory.stats.purchasesSubtitle")}
          icon={<ShoppingCart size={18} />}
          accent="success"
          selected={tab === "purchases"}
          onClick={() => selectTab("purchases")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.inventory.tabs.writeOffs")}
          value={writeOffs.length}
          subtitle={t("pages.inventory.stats.writeOffsSubtitle")}
          icon={<Trash2 size={18} />}
          accent="danger"
          selected={tab === "writeOffs"}
          onClick={() => selectTab("writeOffs")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.inventory.tabs.soldOff")}
          value={soldOffs.length}
          subtitle={t("pages.inventory.stats.soldOffSubtitle")}
          icon={<CircleDollarSign size={18} />}
          accent="primary"
          selected={tab === "soldOff"}
          onClick={() => selectTab("soldOff")}
        />
      </div>

      <p className="mb-4 text-sm text-muted">
        {t("pages.inventory.costingNote")}
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DirectorySearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={searchPlaceholder}
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
            {tab === "writeOffs" && canAssignToProject ? (
              <DirectoryAddButton
                label={t("pages.inventory.addWriteOff")}
                onClick={() => setWriteOffOpen(true)}
              />
            ) : null}
            {tab === "soldOff" && canAssignToProject ? (
              <DirectoryAddButton
                label={t("pages.inventory.addSoldOff")}
                onClick={() => setSoldOffOpen(true)}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {tab === "purchases" && trimmedSearch && searchPending ? (
        <p className="mb-3 text-xs text-muted">
          {t("pages.inventory.searchingPurchases")}
        </p>
      ) : null}
      {tab === "soldOff" && trimmedSearch && searchPending ? (
        <p className="mb-3 text-xs text-muted">
          {t("pages.inventory.searchingSoldOffs")}
        </p>
      ) : null}

      {tab === "assetList" ? (
        <InventoryAssetList
          items={visibleEquipment}
          equipmentAssets={equipmentAssets}
          searchQuery={searchQuery}
          canManage={canManage}
        />
      ) : tab === "stock" ? (
        <InventoryStockTables items={visibleStock} searchQuery={searchQuery} />
      ) : tab === "issues" ? (
        <InventoryProjectIssues issues={issues} searchQuery={searchQuery} />
      ) : tab === "writeOffs" ? (
        <InventoryWriteOffTables
          writeOffs={writeOffs}
          searchQuery={searchQuery}
          canReverse={canAssignToProject}
          onReverse={setReverseWriteOffTarget}
        />
      ) : tab === "soldOff" ? (
        <InventorySoldOffTables
          soldOffs={visibleSoldOffs}
          searchQuery={searchQuery}
        />
      ) : visiblePurchases.length === 0 ? (
        <SectionCard>
          <EmptyState
            title={
              trimmedSearch
                ? t("pages.inventory.emptySearch", { query: trimmedSearch })
                : t("pages.inventory.emptyPurchases")
            }
            description={
              trimmedSearch
                ? t("pages.inventory.emptySearchDesc")
                : t("pages.inventory.emptyPurchasesDesc")
            }
          />
        </SectionCard>
      ) : (
        <DataTable
          columns={purchaseColumns}
          data={visiblePurchases}
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
              <InventoryWriteOffDialog
                open={writeOffOpen}
                onOpenChange={setWriteOffOpen}
                items={items}
              />
              <InventorySoldOffDialog
                open={soldOffOpen}
                onOpenChange={setSoldOffOpen}
                items={items}
                equipmentAssets={equipmentAssets}
              />
              <InventoryReverseWriteOffDialog
                target={reverseWriteOffTarget}
                onOpenChange={(open) => {
                  if (!open) setReverseWriteOffTarget(null);
                }}
              />
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
