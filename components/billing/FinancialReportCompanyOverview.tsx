"use client";

import {
  Banknote,
  Landmark,
  Package,
  Scale,
  Shield,
  TrendingDown,
  Wallet,
} from "lucide-react";

import type { FinancialReportCompanyTotals } from "@/app/billing/financial-report/actions";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

type Props = {
  company: FinancialReportCompanyTotals;
  queryString?: string;
};

export default function FinancialReportCompanyOverview({
  company,
  queryString = "",
}: Props) {
  const { t } = useT();
  const pair = company.period;
  const detail = (metric: string) =>
    `/billing/financial-report/detail?metric=${metric}${
      queryString ? `&${queryString}` : ""
    }`;

  return (
    <div className="mb-8 space-y-5">
      <p className="text-sm text-subtle">{t("pages.financialReport.rangeHint")}</p>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DirectoryStatCard
            featured
            title={t("pages.financialReport.netPosition")}
            value={formatContractPrice(company.netPosition)}
            subtitle={t("pages.financialReport.netPositionHint")}
            icon={<Scale size={20} />}
            accent={company.netPosition < 0 ? "danger" : "success"}
            href={detail("netPosition")}
          />
          <DirectoryStatCard
            featured
            title={t("pages.financialReport.moneyIn")}
            value={formatContractPrice(pair.moneyIn)}
            subtitle={t("pages.financialReport.companyMoneyInHint")}
            icon={<Wallet size={20} />}
            accent="success"
            href={detail("moneyIn")}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DirectoryStatCard
            title={t("pages.financialReport.moneyOut")}
            value={formatContractPrice(pair.moneyOut)}
            subtitle={t("pages.financialReport.companyMoneyOutHint")}
            icon={<TrendingDown size={18} />}
            accent="warning"
            href={detail("moneyOut")}
          />
          <DirectoryStatCard
            title={t("pages.financialReport.clientsStillOwe")}
            value={formatContractPrice(company.clientsOwe.unpaid)}
            subtitle={t("pages.financialReport.accountsReceivableHint", {
              overdue: formatContractPrice(company.clientsOwe.overdue),
            })}
            icon={<Banknote size={18} />}
            accent={company.clientsOwe.overdue > 0 ? "warning" : "muted"}
            href={detail("ar")}
          />
          <DirectoryStatCard
            title={t("pages.financialReport.weStillOweVendors")}
            value={formatContractPrice(company.vendorsOwe.unpaid)}
            subtitle={t("pages.financialReport.accountsPayableHint", {
              overdue: formatContractPrice(company.vendorsOwe.overdue),
            })}
            icon={<Landmark size={18} />}
            accent={company.vendorsOwe.overdue > 0 ? "warning" : "muted"}
            href={detail("ap")}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DirectoryStatCard
            title={t("pages.financialReport.stockInWarehouse")}
            value={formatContractPrice(company.warehouseStockValue)}
            subtitle={t("pages.financialReport.stockInWarehouseHint")}
            icon={<Package size={18} />}
            accent="info"
            href={detail("warehouse")}
          />
          <DirectoryStatCard
            title={t("pages.financialReport.depositsHeld")}
            value={formatContractPrice(company.deposits.held)}
            subtitle={t("pages.financialReport.depositsHeldHint")}
            icon={<Shield size={18} />}
            accent="info"
            href={detail("deposits")}
          />
        </div>
      </div>
      {company.receiptsByBank.length > 0 ? (
        <div className="rounded-2xl border border-border bg-elevated p-4">
          <h2 className="text-sm font-semibold text-text">
            {t("pages.financialReport.receiptsByBank")}
          </h2>
          <p className="mt-1 text-sm text-subtle">
            {t("pages.financialReport.receiptsByBankHint")}
          </p>
          <ul className="mt-3 divide-y divide-border">
            {company.receiptsByBank.map((row) => (
              <li
                key={row.id ?? "unassigned"}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="font-medium text-text">
                  {row.id
                    ? row.label
                    : t("pages.financialReport.filterBankUnassigned")}
                </span>
                <span className="tabular-nums text-text">
                  {formatContractPrice(row.moneyIn)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
