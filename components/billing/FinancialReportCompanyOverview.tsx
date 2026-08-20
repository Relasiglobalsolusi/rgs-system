"use client";

import {
  Banknote,
  Building2,
  Landmark,
  Package,
  Scale,
  Shield,
  TrendingDown,
  TrendingUp,
  Undo2,
  Wallet,
} from "lucide-react";

import type { FinancialReportCompanyTotals } from "@/app/billing/financial-report/actions";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

type Props = {
  company: FinancialReportCompanyTotals;
};

export default function FinancialReportCompanyOverview({ company }: Props) {
  const { t } = useT();
  const pair = company.period;

  return (
    <div className="mb-8 space-y-5">
      <p className="text-sm text-subtle">{t("pages.financialReport.rangeHint")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DirectoryStatCard
          title={t("pages.financialReport.periodNet")}
          value={formatContractPrice(pair.net)}
          subtitle={t("pages.financialReport.periodNetHint")}
          icon={<TrendingUp size={18} />}
          accent={pair.net < 0 ? "danger" : "success"}
        />
        <DirectoryStatCard
          title={t("pages.financialReport.netPosition")}
          value={formatContractPrice(company.netPosition)}
          subtitle={t("pages.financialReport.netPositionHint")}
          icon={<Scale size={18} />}
          accent={company.netPosition < 0 ? "danger" : "success"}
        />
        <DirectoryStatCard
          title={t("pages.financialReport.moneyIn")}
          value={formatContractPrice(pair.moneyIn)}
          subtitle={t("pages.financialReport.companyMoneyInHint")}
          icon={<Wallet size={18} />}
          accent="success"
        />
        <DirectoryStatCard
          title={t("pages.financialReport.moneyOut")}
          value={formatContractPrice(pair.moneyOut)}
          subtitle={t("pages.financialReport.companyMoneyOutHint")}
          icon={<TrendingDown size={18} />}
          accent="warning"
        />
        <DirectoryStatCard
          title={t("pages.financialReport.clientsStillOwe")}
          value={formatContractPrice(company.clientsOwe.unpaid)}
          subtitle={t("pages.financialReport.accountsReceivableHint", {
            overdue: formatContractPrice(company.clientsOwe.overdue),
          })}
          icon={<Banknote size={18} />}
          accent={company.clientsOwe.overdue > 0 ? "warning" : "muted"}
        />
        <DirectoryStatCard
          title={t("pages.financialReport.weStillOweVendors")}
          value={formatContractPrice(company.vendorsOwe.unpaid)}
          subtitle={t("pages.financialReport.accountsPayableHint", {
            overdue: formatContractPrice(company.vendorsOwe.overdue),
          })}
          icon={<Landmark size={18} />}
          accent={company.vendorsOwe.overdue > 0 ? "warning" : "muted"}
        />
        <DirectoryStatCard
          title={t("pages.financialReport.stockInWarehouse")}
          value={formatContractPrice(company.warehouseStockValue)}
          subtitle={t("pages.financialReport.stockInWarehouseHint")}
          icon={<Package size={18} />}
          accent="info"
        />
        <DirectoryStatCard
          title={t("pages.financialReport.headOfficeOverhead")}
          value={formatContractPrice(company.overhead.total)}
          subtitle={t("pages.financialReport.headOfficeOverheadPeriodHint")}
          icon={<Building2 size={18} />}
          accent="muted"
        />
        <DirectoryStatCard
          title={t("pages.financialReport.depositsHeld")}
          value={formatContractPrice(company.deposits.held)}
          subtitle={t("pages.financialReport.depositsHeldHint")}
          icon={<Shield size={18} />}
          accent="info"
        />
        <DirectoryStatCard
          title={t("pages.financialReport.depositsReturned")}
          value={formatContractPrice(company.deposits.returned)}
          subtitle={t("pages.financialReport.depositsReturnedHint")}
          icon={<Undo2 size={18} />}
          accent="warning"
        />
        <DirectoryStatCard
          title={t("pages.financialReport.depositsKept")}
          value={formatContractPrice(company.deposits.kept)}
          subtitle={t("pages.financialReport.depositsKeptHint")}
          icon={<Landmark size={18} />}
          accent="success"
        />
      </div>
    </div>
  );
}
