"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CircleDollarSign,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { searchInventorySoldOffs } from "@/app/inventory/actions";
import SalesPeriodControl from "@/components/billing/SalesPeriodControl";
import SalesReportDownloadButton from "@/components/billing/SalesReportDownloadButton";
import InventoryReverseSoldOffDialog from "@/components/inventory/InventoryReverseSoldOffDialog";
import InventorySoldOffDialog from "@/components/inventory/InventorySoldOffDialog";
import InventorySoldOffTables from "@/components/inventory/InventorySoldOffTables";
import type {
  InventoryCatalogItem,
  InventoryOverviewAssetRow,
  InventorySoldOffRow,
} from "@/components/inventory/inventory-types";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import DirectorySearchInput from "@/components/ui/DirectorySearchInput";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DirectoryStatGrid from "@/components/ui/DirectoryStatGrid";
import { useT } from "@/lib/i18n/use-t";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import { formatContractPrice } from "@/lib/project-billing";

export type SalesWorkspaceTotals = {
  count: number;
  sales: number;
  profit: number;
  cost: number;
  vat: number;
  yearSales: number;
  yearProfit: number;
};

type Props = {
  year: number;
  month: number | null;
  day?: number | null;
  soldOffs: InventorySoldOffRow[];
  items: InventoryCatalogItem[];
  equipmentAssets: InventoryOverviewAssetRow[];
  totals: SalesWorkspaceTotals;
  canManage: boolean;
  bankAccounts?: CompanyBankAccountOption[];
};

export default function SalesWorkspace({
  year,
  month,
  day = null,
  soldOffs,
  items,
  equipmentAssets,
  totals,
  canManage,
  bankAccounts = [],
}: Props) {
  const { t } = useT();
  const [searchQuery, setSearchQuery] = useState("");
  const [saleOpen, setSaleOpen] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<InventorySoldOffRow | null>(
    null
  );
  const [searchedSales, setSearchedSales] = useState<
    InventorySoldOffRow[] | null
  >(null);
  const [searchPending, startSearchTransition] = useTransition();
  const trimmedSearch = searchQuery.trim();

  useEffect(() => {
    if (!trimmedSearch) {
      setSearchedSales(null);
      return;
    }
    const handle = window.setTimeout(() => {
      startSearchTransition(async () => {
        try {
          const rows = await searchInventorySoldOffs(trimmedSearch);
          setSearchedSales(rows);
        } catch {
          setSearchedSales([]);
        }
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [trimmedSearch]);

  const visibleSales = useMemo(
    () => searchedSales ?? soldOffs,
    [searchedSales, soldOffs]
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <SalesPeriodControl
          year={year}
          month={month}
          day={day}
          action={
            <SalesReportDownloadButton year={year} month={month} day={day} />
          }
        />
        {canManage ? (
          <DirectoryAddButton
            label={t("pages.sales.addSale")}
            onClick={() => setSaleOpen(true)}
          />
        ) : null}
      </div>

      <DirectoryStatGrid className="mb-5">
        <DirectoryStatCard
          compact
          title={t("pages.sales.totalSales")}
          value={formatContractPrice(totals.sales)}
          subtitle={t("pages.sales.thisYear", {
            amount: formatContractPrice(totals.yearSales),
          })}
          icon={<CircleDollarSign size={18} />}
          accent="primary"
        />
        <DirectoryStatCard
          compact
          title={t("pages.sales.totalProfit")}
          value={formatContractPrice(totals.profit)}
          subtitle={t("pages.sales.thisYear", {
            amount: formatContractPrice(totals.yearProfit),
          })}
          icon={<TrendingUp size={18} />}
          accent={totals.profit < 0 ? "danger" : "success"}
        />
        <DirectoryStatCard
          compact
          title={t("pages.sales.totalCost")}
          value={formatContractPrice(totals.cost)}
          subtitle={
            totals.count === 1
              ? t("pages.sales.saleCountOne")
              : t("pages.sales.saleCount", { count: String(totals.count) })
          }
          icon={<Wallet size={18} />}
          accent="muted"
        />
        <DirectoryStatCard
          compact
          title={t("pages.sales.vatCollected")}
          value={formatContractPrice(totals.vat)}
          icon={<Receipt size={18} />}
          accent="info"
        />
      </DirectoryStatGrid>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DirectorySearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("pages.sales.searchPlaceholder")}
          className="min-w-0 w-full max-w-none sm:min-w-[12rem] sm:flex-1"
        />
      </div>

      {trimmedSearch && searchPending ? (
        <p className="mb-3 text-xs text-muted">
          {t("pages.inventory.searchingSoldOffs")}
        </p>
      ) : null}

      <InventorySoldOffTables
        soldOffs={visibleSales}
        searchQuery={searchQuery}
        canReverse={canManage}
        canAttach={canManage}
        onReverse={setReverseTarget}
      />

      {canManage ? (
        <InventorySoldOffDialog
          open={saleOpen}
          onOpenChange={setSaleOpen}
          items={items}
          equipmentAssets={equipmentAssets}
          bankAccounts={bankAccounts}
        />
      ) : null}

      {canManage ? (
        <InventoryReverseSoldOffDialog
          target={reverseTarget}
          onOpenChange={(open) => {
            if (!open) setReverseTarget(null);
          }}
        />
      ) : null}
    </>
  );
}
