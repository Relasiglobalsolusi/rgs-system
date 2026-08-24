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
import {
  FinancialKpiBoard,
  FinancialKpiCell,
  FinancialKpiRow,
} from "@/components/billing/FinancialKpiBoard";
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
    <div className="mb-6 space-y-3">
      <p className="text-sm text-subtle">{t("pages.financialReport.rangeHint")}</p>
      <FinancialKpiBoard>
        <FinancialKpiRow>
        <FinancialKpiCell
          title={t("pages.financialReport.netPosition")}
          value={formatContractPrice(company.netPosition)}
          hint={t("pages.financialReport.netPositionHint")}
          icon={<Scale size={14} />}
          accent={company.netPosition < 0 ? "danger" : "success"}
          href={detail("netPosition")}
        />
        <FinancialKpiCell
          title={t("pages.financialReport.moneyIn")}
          value={formatContractPrice(pair.moneyIn)}
          hint={t("pages.financialReport.companyMoneyInHint")}
          icon={<Wallet size={14} />}
          accent="success"
          href={detail("moneyIn")}
        />
        <FinancialKpiCell
          title={t("pages.financialReport.moneyOut")}
          value={formatContractPrice(pair.moneyOut)}
          hint={t("pages.financialReport.companyMoneyOutHint")}
          icon={<TrendingDown size={14} />}
          accent="warning"
          href={detail("moneyOut")}
        />
        <FinancialKpiCell
          title={t("pages.financialReport.clientsStillOwe")}
          value={formatContractPrice(company.clientsOwe.unpaid)}
          hint={t("pages.financialReport.accountsReceivableHint", {
            overdue: formatContractPrice(company.clientsOwe.overdue),
          })}
          icon={<Banknote size={14} />}
          accent={company.clientsOwe.overdue > 0 ? "warning" : "muted"}
          href={detail("ar")}
        />
        <FinancialKpiCell
          title={t("pages.financialReport.weStillOweVendors")}
          value={formatContractPrice(company.vendorsOwe.unpaid)}
          hint={t("pages.financialReport.accountsPayableHint", {
            overdue: formatContractPrice(company.vendorsOwe.overdue),
          })}
          icon={<Landmark size={14} />}
          accent={company.vendorsOwe.overdue > 0 ? "warning" : "muted"}
          href={detail("ap")}
        />
        <FinancialKpiCell
          title={t("pages.financialReport.bpjsKesehatan")}
          value={formatContractPrice(company.bpjsPayable.kesehatan.companyTotal)}
          hint={t("pages.financialReport.bpjsEmployeeCount", {
            count: company.bpjsPayable.kesehatan.employeeCount,
          })}
          icon={<HeartPulse size={14} />}
          accent="warning"
          href={detail("bpjsKesehatan")}
        />
        <FinancialKpiCell
          title={t("pages.financialReport.bpjsKetenagakerjaan")}
          value={formatContractPrice(
            company.bpjsPayable.ketenagakerjaan.companyTotal
          )}
          hint={t("pages.financialReport.bpjsEmployeeCount", {
            count: company.bpjsPayable.ketenagakerjaan.employeeCount,
          })}
          icon={<ShieldPlus size={14} />}
          accent="warning"
          href={detail("bpjsKetenagakerjaan")}
        />
        <FinancialKpiCell
          title={t("pages.financialReport.loanInterestDueThisPeriod")}
          value={formatContractPrice(company.loanInterestDue)}
          hint={t("pages.financialReport.loanInterestDueThisPeriodHint")}
          icon={<Landmark size={14} />}
          accent={company.loanInterestDue > 0 ? "warning" : "muted"}
          href={detail("loanInterestDue")}
        />
        <FinancialKpiCell
          title={t("pages.financialReport.stockInWarehouse")}
          value={formatContractPrice(company.warehouseStockValue)}
          hint={t("pages.financialReport.stockInWarehouseHint")}
          icon={<Package size={14} />}
          accent="info"
          href={detail("warehouse")}
        />
        <FinancialKpiCell
          title={t("pages.financialReport.depositsHeld")}
          value={formatContractPrice(company.deposits.held)}
          hint={t("pages.financialReport.depositsHeldHint")}
          icon={<Shield size={14} />}
          accent="info"
          href={detail("deposits")}
        />
        </FinancialKpiRow>
        <FinancialKpiRow
          className="mt-px"
          columnsClassName="grid-cols-1 sm:grid-cols-3"
        >
          <FinancialKpiCell
            title={t("pages.financialReport.totalClients")}
            value={directory.clients}
            hint={t("pages.financialReport.withProjects")}
            icon={<Building2 size={14} />}
            accent="primary"
          />
          <FinancialKpiCell
            title={t("pages.financialReport.totalContractValue")}
            value={formatContractPrice(directory.contractValue)}
            hint={t("pages.financialReport.acrossClients")}
            icon={<Wallet size={14} />}
            accent="info"
          />
          <FinancialKpiCell
            title={t("pages.financialReport.totalProfit")}
            value={formatContractPrice(directory.profit)}
            hint={t("pages.financialReport.profitHint")}
            icon={<TrendingUp size={14} />}
            accent={directory.profit < 0 ? "danger" : "success"}
          />
        </FinancialKpiRow>
      </FinancialKpiBoard>
    </div>
  );
}
