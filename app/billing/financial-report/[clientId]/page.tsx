import { notFound } from "next/navigation";
import {
  Banknote,
  Landmark,
  Package,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";

import {
  getFinancialReportClientProjects,
  listFinancialReportBankAccounts,
  listFinancialReportScopeClients,
} from "@/app/billing/financial-report/actions";
import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import FinancialReportFilters from "@/components/billing/FinancialReportFilters";
import FinancialReportProjectDirectory from "@/components/billing/FinancialReportProjectDirectory";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import {
  financialReportHref,
  financialReportQueryString,
  parseFinancialReportSelection,
} from "@/lib/financial-report-query";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { formatContractPrice } from "@/lib/project-billing";

type SearchParams = Promise<{
  year?: string;
  month?: string;
  bank?: string;
}>;

export default async function FinancialReportClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: SearchParams;
}) {
  const { clientId } = await params;
  const selection = parseFinancialReportSelection(await searchParams);
  const queryString = financialReportQueryString(selection);
  const t = createTranslator(await getServerLocale());
  const [data, scopeClients, bankAccounts] = await Promise.all([
    getFinancialReportClientProjects(clientId, selection),
    listFinancialReportScopeClients(),
    listFinancialReportBankAccounts(),
  ]);

  if (!data) notFound();

  return (
    <AppShell
      title={data.clientName}
      descriptionKey="pages.financialReport.clientProjectsDesc"
    >
      <BillingBreadcrumbs
        items={[
          {
            labelKey: "pages.financialReport.title",
            href: financialReportHref("/billing/financial-report", selection),
          },
          { label: data.clientName },
        ]}
      />
      <FinancialReportFilters
        selection={selection}
        clients={scopeClients}
        scopeClientId={clientId}
        bankAccounts={bankAccounts}
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DirectoryStatCard
          title={t("pages.financialReport.totalContractValue")}
          value={formatContractPrice(data.totalContractValue)}
          subtitle={t("pages.financialReport.contractValueHint")}
          icon={<Wallet size={18} />}
          accent="info"
        />
        <DirectoryStatCard
          title={t("pages.financialReport.moneyOut")}
          value={formatContractPrice(data.totalSpending)}
          subtitle={t("pages.financialReport.spendingHint")}
          icon={<Package size={18} />}
          accent="warning"
        />
        <DirectoryStatCard
          title={t("pages.financialReport.profit")}
          value={formatContractPrice(data.profit)}
          subtitle={t("pages.financialReport.profitHint")}
          icon={<TrendingUp size={18} />}
          accent={data.profit < 0 ? "danger" : "success"}
        />
        <DirectoryStatCard
          title={t("pages.financialReport.netPosition")}
          value={formatContractPrice(data.netPosition)}
          subtitle={t("pages.financialReport.netPositionHint")}
          icon={<Scale size={18} />}
          accent={data.netPosition < 0 ? "danger" : "success"}
        />
        <DirectoryStatCard
          title={t("pages.financialReport.clientsStillOwe")}
          value={formatContractPrice(data.clientsOwe.unpaid)}
          subtitle={t("pages.financialReport.accountsReceivableHint", {
            overdue: formatContractPrice(data.clientsOwe.overdue),
          })}
          icon={<Banknote size={18} />}
          accent={data.clientsOwe.overdue > 0 ? "warning" : "muted"}
        />
        <DirectoryStatCard
          title={t("pages.financialReport.weStillOweVendors")}
          value={formatContractPrice(data.vendorsOwe.unpaid)}
          subtitle={t("pages.financialReport.accountsPayableHint", {
            overdue: formatContractPrice(data.vendorsOwe.overdue),
          })}
          icon={<Landmark size={18} />}
          accent={data.vendorsOwe.overdue > 0 ? "warning" : "muted"}
        />
      </div>

      <FinancialReportProjectDirectory
        clientId={clientId}
        projects={data.projects}
        queryString={queryString}
      />
    </AppShell>
  );
}
