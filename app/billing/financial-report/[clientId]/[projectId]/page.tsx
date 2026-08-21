import { notFound } from "next/navigation";

import {
  getFinancialReportProjectDetail,
  listFinancialReportBankAccounts,
  listFinancialReportScopeClients,
} from "@/app/billing/financial-report/actions";
import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import FinancialReportFilters from "@/components/billing/FinancialReportFilters";
import FinancialReportProjectPanel from "@/components/billing/FinancialReportProjectPanel";
import {
  financialReportHref,
  parseFinancialReportSelection,
} from "@/lib/financial-report-query";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";

type SearchParams = Promise<{
  year?: string;
  month?: string;
  bank?: string;
}>;

export default async function FinancialReportProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string; projectId: string }>;
  searchParams: SearchParams;
}) {
  const { clientId, projectId } = await params;
  const selection = parseFinancialReportSelection(await searchParams);
  const t = createTranslator(await getServerLocale());
  const [detail, scopeClients, bankAccounts] = await Promise.all([
    getFinancialReportProjectDetail(clientId, projectId, selection),
    listFinancialReportScopeClients(),
    listFinancialReportBankAccounts(),
  ]);

  if (!detail) notFound();

  return (
    <AppShell
      title={detail.projectName}
      description={t("pages.financialReport.projectDetailDesc", {
        client: detail.clientName,
      })}
    >
      <BillingBreadcrumbs
        items={[
          {
            labelKey: "pages.financialReport.title",
            href: financialReportHref("/billing/financial-report", selection),
          },
          {
            label: detail.clientName,
            href: financialReportHref(
              `/billing/financial-report/${clientId}`,
              selection
            ),
          },
          { label: detail.projectName },
        ]}
      />
      <FinancialReportFilters
        selection={selection}
        clients={scopeClients}
        scopeClientId={clientId}
        projectId={projectId}
        bankAccounts={bankAccounts}
      />

      <FinancialReportProjectPanel detail={detail} />
    </AppShell>
  );
}
