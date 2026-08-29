"use client";

import {
  Banknote,
  Building2,
  HeartPulse,
  Landmark,
  Package,
  Scale,
  Shield,
  ShieldPlus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import type {
  FinancialReportClientRow,
  FinancialReportCompanyTotals,
} from "@/app/billing/financial-report/actions";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DirectoryStatGrid from "@/components/ui/DirectoryStatGrid";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

type Props = {
  company: FinancialReportCompanyTotals;
  queryString?: string;
  clients?: FinancialReportClientRow[];
};

export default function FinancialReportCompanyOverview({
  company,
  queryString = "",
  clients = [],
}: Props) {
  const { t } = useT();
  const pair = company.period;
  const detail = (metric: string) =>
    `/billing/financial-report/detail?metric=${metric}${
      queryString ? `&${queryString}` : ""
    }`;

  const directory = {
    clients: clients.length,
    contractValue: clients.reduce((sum, row) => sum + row.totalContractValue, 0),
    profit: clients.reduce((sum, row) => sum + row.profit, 0),
  };

  return (
    <div className="mb-6 space-y-2">
      <p className="text-sm text-subtle">{t("pages.financialReport.rangeHint")}</p>
      <DirectoryStatGrid gapClassName="gap-2">
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.financialReport.netPosition")}
          value={formatContractPrice(company.netPosition)}
          subtitle={t("pages.financialReport.netPositionHint")}
          icon={<Scale size={16} />}
          accent={company.netPosition < 0 ? "danger" : "success"}
          href={detail("netPosition")}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.financialReport.moneyIn")}
          value={formatContractPrice(pair.moneyIn)}
          subtitle={t("pages.financialReport.companyMoneyInHint")}
          icon={<Wallet size={16} />}
          accent="success"
          href={detail("moneyIn")}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.financialReport.moneyOut")}
          value={formatContractPrice(pair.moneyOut)}
          subtitle={t("pages.financialReport.companyMoneyOutHint")}
          icon={<TrendingDown size={16} />}
          accent="warning"
          href={detail("moneyOut")}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.financialReport.clientsStillOwe")}
          value={formatContractPrice(company.clientsOwe.unpaid)}
          subtitle={t("pages.financialReport.accountsReceivableHint", {
            overdue: formatContractPrice(company.clientsOwe.overdue),
          })}
          icon={<Banknote size={16} />}
          accent={company.clientsOwe.overdue > 0 ? "warning" : "muted"}
          href={detail("ar")}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.financialReport.weStillOweVendors")}
          value={formatContractPrice(company.vendorsOwe.unpaid)}
          subtitle={t("pages.financialReport.accountsPayableHint", {
            overdue: formatContractPrice(company.vendorsOwe.overdue),
          })}
          icon={<Landmark size={16} />}
          accent={company.vendorsOwe.overdue > 0 ? "warning" : "muted"}
          href={detail("ap")}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.financialReport.bpjsKesehatan")}
          value={formatContractPrice(company.bpjsPayable.kesehatan.companyTotal)}
          subtitle={t("pages.financialReport.bpjsEmployeeCount", {
            count: company.bpjsPayable.kesehatan.employeeCount,
          })}
          icon={<HeartPulse size={16} />}
          accent="warning"
          href={detail("bpjsKesehatan")}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.financialReport.bpjsKetenagakerjaan")}
          value={formatContractPrice(
            company.bpjsPayable.ketenagakerjaan.companyTotal
          )}
          subtitle={t("pages.financialReport.bpjsEmployeeCount", {
            count: company.bpjsPayable.ketenagakerjaan.employeeCount,
          })}
          icon={<ShieldPlus size={16} />}
          accent="warning"
          href={detail("bpjsKetenagakerjaan")}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.financialReport.loanInterestDueThisPeriod")}
          value={formatContractPrice(company.loanInterestDue)}
          subtitle={t("pages.financialReport.loanInterestDueThisPeriodHint")}
          icon={<Landmark size={16} />}
          accent={company.loanInterestDue > 0 ? "warning" : "muted"}
          href={detail("loanInterestDue")}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.financialReport.stockInWarehouse")}
          value={formatContractPrice(company.warehouseStockValue)}
          subtitle={t("pages.financialReport.stockInWarehouseHint")}
          icon={<Package size={16} />}
          accent="info"
          href={detail("warehouse")}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.financialReport.depositsHeld")}
          value={formatContractPrice(company.deposits.held)}
          subtitle={t("pages.financialReport.depositsHeldHint")}
          icon={<Shield size={16} />}
          accent="info"
          href={detail("deposits")}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.financialReport.totalClients")}
          value={directory.clients}
          subtitle={t("pages.financialReport.withProjects")}
          icon={<Building2 size={16} />}
          accent="primary"
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.financialReport.totalContractValue")}
          value={formatContractPrice(directory.contractValue)}
          subtitle={t("pages.financialReport.acrossClients")}
          icon={<Wallet size={16} />}
          accent="info"
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.financialReport.totalProfit")}
          value={formatContractPrice(directory.profit)}
          subtitle={t("pages.financialReport.profitHint")}
          icon={<TrendingUp size={16} />}
          accent={directory.profit < 0 ? "danger" : "success"}
        />
      </DirectoryStatGrid>
    </div>
  );
}
