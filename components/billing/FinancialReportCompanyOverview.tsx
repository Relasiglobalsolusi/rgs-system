"use client";

import {
  Banknote,
  HeartPulse,
  Landmark,
  Package,
  Scale,
  Shield,
  ShieldPlus,
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
            title={t("pages.financialReport.bpjsKesehatan")}
            value={formatContractPrice(company.bpjsPayable.kesehatan.companyTotal)}
            subtitle={t("pages.financialReport.bpjsEmployeeCount", {
              count: company.bpjsPayable.kesehatan.employeeCount,
            })}
            icon={<HeartPulse size={18} />}
            accent="warning"
            href={detail("bpjsKesehatan")}
          />
          <DirectoryStatCard
            title={t("pages.financialReport.bpjsKetenagakerjaan")}
            value={formatContractPrice(
              company.bpjsPayable.ketenagakerjaan.companyTotal
            )}
            subtitle={t("pages.financialReport.bpjsEmployeeCount", {
              count: company.bpjsPayable.ketenagakerjaan.employeeCount,
            })}
            icon={<ShieldPlus size={18} />}
            accent="warning"
            href={detail("bpjsKetenagakerjaan")}
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
    </div>
  );
}
