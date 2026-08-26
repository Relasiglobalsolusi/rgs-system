"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Boxes,
  Car,
  Factory,
  FolderKanban,
  ShoppingCart,
  Trash2,
  Wrench,
} from "lucide-react";

import { searchInventoryPurchases } from "@/app/inventory/actions";
import InventoryAssetList from "@/components/inventory/InventoryAssetList";
import InventoryVehicleList from "@/components/inventory/InventoryVehicleList";
import InventoryProjectIssues from "@/components/inventory/InventoryProjectIssues";
import InventoryReverseWriteOffDialog from "@/components/inventory/InventoryReverseWriteOffDialog";
import InventoryStockTables from "@/components/inventory/InventoryStockTables";
import InventoryWriteOffDialog from "@/components/inventory/InventoryWriteOffDialog";
import InventoryWriteOffTables from "@/components/inventory/InventoryWriteOffTables";
import { isCodedIdentityItemType, isEquipmentItemType } from "@/lib/equipment-asset";
import { isVehicleItemType } from "@/lib/inventory-sku";
import type {
  InventoryCatalogItem,
  InventoryFactoryReturnRow,
  InventoryIssueRow,
  InventoryOverviewAssetRow,
  InventoryPurchaseRow,
  InventoryTab,
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
import StatusBadge from "@/components/ui/StatusBadge";
import {
  isBelowMinStock,
  stockValueOnHand,
  formatInventoryQtyWithUnit,
} from "@/lib/inventory";
import {
  localizeInventoryItemType,
  localizeKnownKey,
} from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { formatDisplayDate } from "@/lib/format-date";
import { formatContractPrice } from "@/lib/project-billing";

type Props = {
  canManage: boolean;
  /** OM+ / Director / HO admin — write off stock (issues only via MR → TO). */
  canAssignToProject: boolean;
  canReturnToFactory: boolean;
  items: InventoryCatalogItem[];
  purchases: InventoryPurchaseRow[];
  issues: InventoryIssueRow[];
  writeOffs: InventoryWriteOffRow[];
  factoryReturns: InventoryFactoryReturnRow[];
  equipmentAssets: InventoryOverviewAssetRow[];
};

export default function InventoryWorkspace({
  canManage,
  canAssignToProject,
  canReturnToFactory,
  items,
  purchases,
  issues,
  writeOffs,
  factoryReturns,
  equipmentAssets,
}: Props) {
  const { t, locale } = useT();
  const [tab, setTab] = useState<InventoryTab>("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [reverseWriteOffTarget, setReverseWriteOffTarget] =
    useState<InventoryWriteOffRow | null>(null);
  const [searchedPurchases, setSearchedPurchases] = useState<
    InventoryPurchaseRow[] | null
  >(null);
  const [searchPending, startSearchTransition] = useTransition();

  const activeItems = useMemo(
    () => items.filter((item) => item.active),
    [items]
  );
  /** Chemical / Consumable / Spare Part / Other — Equipment on Asset List, vehicles on Vehicles. */
  const nonEquipmentItems = useMemo(
    () =>
      activeItems.filter((item) => !isCodedIdentityItemType(item.itemType)),
    [activeItems]
  );
  const equipmentCatalogItems = useMemo(
    () => activeItems.filter((item) => isEquipmentItemType(item.itemType)),
    [activeItems]
  );
  const vehicleAssets = useMemo(
    () =>
      equipmentAssets.filter((asset) =>
        isVehicleItemType(asset.item?.itemType)
      ),
    [equipmentAssets]
  );
  const equipmentOnlyAssets = useMemo(
    () =>
      equipmentAssets.filter((asset) =>
        isEquipmentItemType(asset.item?.itemType ?? "")
      ),
    [equipmentAssets]
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

  /** Warehouse = uncoded new + returned coded. Owned adds off-hand custody. */
  const equipmentOwnedByItem = useMemo(() => {
    const map = new Map<
      string,
      { warehouse: number; onProject: number; ownedValue: number }
    >();
    for (const item of equipmentCatalogItems) {
      map.set(item.id, {
        warehouse: item.currentStock,
        onProject: 0,
        ownedValue: 0,
      });
    }
    for (const asset of equipmentAssets) {
      const itemId = asset.item?.id;
      if (!itemId) continue;
      const entry = map.get(itemId) ?? {
        warehouse: 0,
        onProject: 0,
        ownedValue: 0,
      };
      if (asset.status === "ON_PROJECT" || asset.status === "IN_TRANSIT") {
        entry.onProject += 1;
      }
      if (asset.status !== "RETIRED") {
        entry.ownedValue += asset.unitCost ?? 0;
      }
      map.set(itemId, entry);
    }
    for (const item of equipmentCatalogItems) {
      const entry = map.get(item.id);
      if (!entry) continue;
      const available = equipmentAssets.filter(
        (asset) => asset.item?.id === item.id && asset.status === "AVAILABLE"
      ).length;
      const uncoded = Math.max(0, item.currentStock - available);
      const unitCost = item.lastUnitCost ?? item.avgUnitCost ?? 0;
      entry.ownedValue += uncoded * unitCost;
    }
    return map;
  }, [equipmentAssets, equipmentCatalogItems]);

  const equipmentStats = useMemo(() => {
    let warehouse = 0;
    let owned = 0;
    let ownedValue = 0;
    for (const item of equipmentCatalogItems) {
      const counts = equipmentOwnedByItem.get(item.id);
      const itemWarehouse = counts?.warehouse ?? item.currentStock;
      const atFactory = equipmentAssets.filter(
        (asset) => asset.item?.id === item.id && asset.status === "AT_FACTORY"
      ).length;
      const itemOwned = itemWarehouse + (counts?.onProject ?? 0) + atFactory;
      warehouse += itemWarehouse;
      owned += itemOwned;
      ownedValue += counts?.ownedValue ?? 0;
    }
    return { warehouse, owned, ownedValue };
  }, [equipmentAssets, equipmentCatalogItems, equipmentOwnedByItem]);

  const hangingFactoryReturns = factoryReturns.filter(
    (row) => row.status === "WAITING"
  ).length;

  const vehicleStats = useMemo(() => {
    const live = vehicleAssets.filter((asset) => asset.status !== "RETIRED");
    return {
      count: live.length,
      value: live.reduce((sum, asset) => sum + (asset.unitCost ?? 0), 0),
    };
  }, [vehicleAssets]);

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

  const visiblePurchases = useMemo(() => {
    const source = searchedPurchases ?? purchases;
    return source.filter(
      (row) => row.item?.id != null && row.vendor?.id != null
    );
  }, [purchases, searchedPurchases]);

  const visibleStock = useMemo(
    () =>
      nonEquipmentItems
        .filter((item) => item?.id != null)
        .filter((item) =>
          matchesDirectorySearch(
            searchQuery,
            item?.name,
            item?.sku,
            item?.itemType,
            localizeInventoryItemType(item?.itemType, locale)
          )
        ),
    [nonEquipmentItems, searchQuery, locale]
  );

  const visibleEquipment = useMemo(() => {
    if (!trimmedSearch) return equipmentCatalogItems;
    return equipmentCatalogItems.filter((item) => {
      if (
        matchesDirectorySearch(
          searchQuery,
          item.name,
          item.sku,
          item.itemType,
          localizeInventoryItemType(item.itemType, locale)
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
    locale,
    searchQuery,
    trimmedSearch,
  ]);

  function selectTab(next: InventoryTab) {
    setTab(next);
    setSearchQuery("");
    setSearchedPurchases(null);
  }

  const searchPlaceholder =
    tab === "purchases"
      ? t("pages.inventory.searchPurchasesPlaceholder")
      : tab === "vehicles"
        ? t("pages.inventory.searchVehiclesPlaceholder")
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
      <div className="mb-5 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
            title={t("pages.inventory.tabs.vehicles")}
            value={formatContractPrice(vehicleStats.value)}
            subtitle={t("pages.inventory.stats.vehiclesSubtitle", {
              count: String(vehicleStats.count),
            })}
            icon={<Car size={18} />}
            accent="info"
            selected={tab === "vehicles"}
            onClick={() => selectTab("vehicles")}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            title={t("pages.inventory.tabs.factoryReturns")}
            value={hangingFactoryReturns}
            subtitle={t("pages.inventory.stats.factoryReturnsSubtitle")}
            icon={<Factory size={18} />}
            accent="warning"
            selected={tab === "factoryReturns"}
            onClick={() => selectTab("factoryReturns")}
          />
        </div>
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
            {tab === "writeOffs" && canAssignToProject ? (
              <DirectoryAddButton
                label={t("pages.inventory.addWriteOff")}
                onClick={() => setWriteOffOpen(true)}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {tab === "purchases" ? (
        <p className="mb-3 text-sm text-subtle">
          {t("pages.inventory.stockReceiptsViaExpenses")}
        </p>
      ) : null}

      {tab === "purchases" && trimmedSearch && searchPending ? (
        <p className="mb-3 text-xs text-muted">
          {t("pages.inventory.searchingPurchases")}
        </p>
      ) : null}
      {tab === "assetList" ? (
        <InventoryAssetList
          items={visibleEquipment}
          equipmentAssets={equipmentOnlyAssets}
          searchQuery={searchQuery}
          canManage={canManage}
        />
      ) : tab === "vehicles" ? (
        <InventoryVehicleList
          vehicles={vehicleAssets}
          searchQuery={searchQuery}
        />
      ) : tab === "stock" ? (
        <InventoryStockTables items={visibleStock} searchQuery={searchQuery} />
      ) : tab === "issues" ? (
        <div className="space-y-4">
          <InventoryProjectIssues issues={issues} searchQuery={searchQuery} />
        </div>
      ) : tab === "writeOffs" ? (
        <InventoryWriteOffTables
          writeOffs={writeOffs}
          searchQuery={searchQuery}
          canReverse={canAssignToProject}
          onReverse={setReverseWriteOffTarget}
        />
      ) : tab === "factoryReturns" ? (
        <FactoryReturnsTable
          rows={factoryReturns}
          searchQuery={searchQuery}
          canReturnToFactory={canReturnToFactory}
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
          {canAssignToProject ? (
            <>
              <InventoryWriteOffDialog
                open={writeOffOpen}
                onOpenChange={setWriteOffOpen}
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

function FactoryReturnsTable({
  rows,
  searchQuery,
  canReturnToFactory,
}: {
  rows: InventoryFactoryReturnRow[];
  searchQuery: string;
  canReturnToFactory: boolean;
}) {
  const { t, locale } = useT();
  const visible = rows.filter((row) =>
    matchesDirectorySearch(
      searchQuery,
      row.item.name,
      row.item.sku,
      row.assetCode,
      row.reason,
      row.vendorName
    )
  );
  const columns: DataTableColumn<InventoryFactoryReturnRow>[] = [
    {
      key: "sentAt",
      title: t("pages.inventory.factoryReturn.sentAt"),
      width: "8rem",
      render: (row) => formatDisplayDate(row.sentAt),
    },
    {
      key: "item",
      title: t("pages.inventory.columns.item"),
      share: 1.6,
      render: (row) => (
        <Link
          href={`/inventory/equipment/${row.item.id}`}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {row.item.name}
        </Link>
      ),
    },
    {
      key: "unit",
      title: t("pages.inventory.factoryReturn.unit"),
      width: "9rem",
      render: (row) =>
        row.assetCode ||
        t("pages.inventory.factoryReturn.newNoCode", {
          qty: String(row.quantity),
        }),
    },
    {
      key: "status",
      title: t("pages.inventory.columns.status"),
      width: "10rem",
      cellAlign: "center",
      className: "min-w-[10rem] overflow-visible",
      render: (row) => (
        <StatusBadge
          status={
            row.status === "WAITING"
              ? "warning"
              : row.status === "REFUNDED"
                ? "inactive"
                : "success"
          }
          compact
        >
          {localizeKnownKey(
            `pages.inventory.factoryReturn.statuses.${row.status}`,
            locale
          )}
        </StatusBadge>
      ),
    },
    {
      key: "refund",
      title: t("pages.inventory.factoryReturn.refundAmount"),
      width: "8rem",
      align: "right",
      render: (row) =>
        row.refundAmount != null ? formatContractPrice(row.refundAmount) : "—",
    },
    {
      key: "reason",
      title: t("pages.inventory.factoryReturn.reason"),
      share: 1.4,
      render: (row) => row.reason,
    },
  ];

  if (visible.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          title={t("pages.inventory.factoryReturn.empty")}
          description={
            canReturnToFactory
              ? t("pages.inventory.factoryReturn.emptyDescDirector")
              : t("pages.inventory.factoryReturn.emptyDesc")
          }
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {t("pages.inventory.factoryReturn.listHint")}
      </p>
      <DataTable
        columns={columns}
        data={visible}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
