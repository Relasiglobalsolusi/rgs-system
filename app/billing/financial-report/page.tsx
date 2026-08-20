import {
  getFinancialReportClients,
  getFinancialReportCompanyTotals,
  listFinancialReportScopeClients,
} from "@/app/billing/financial-report/actions";
import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import FinancialReportClientDirectory from "@/components/billing/FinancialReportClientDirectory";
import FinancialReportCompanyOverview from "@/components/billing/FinancialReportCompanyOverview";
import FinancialReportFilters from "@/components/billing/FinancialReportFilters";
import { financialReportQueryString, parseFinancialReportSelection } from "@/lib/financial-report-query";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";

type SearchParams = Promise<{
  year?: string;
  month?: string;
}>;

export default async function FinancialReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = createTranslator(await getServerLocale());
  const params = await searchParams;
  const selection = parseFinancialReportSelection(params);
  const queryString = financialReportQueryString(selection);
  const [clients, company, scopeClients] = await Promise.all([
    getFinancialReportClients(selection),
    getFinancialReportCompanyTotals(selection),
    listFinancialReportScopeClients(),
  ]);

  return (
    <AppShell
      titleKey="pages.financialReport.title"
      descriptionKey="pages.financialReport.description"
    >
      <BillingBreadcrumbs
        items={[{ label: t("pages.financialReport.title") }]}
      />
      <FinancialReportFilters
        selection={selection}
        clients={scopeClients}
        scopeClientId={null}
      />
      <FinancialReportCompanyOverview company={company} />
      <FinancialReportClientDirectory
        clients={clients}
        queryString={queryString}
      />
    </AppShell>
  );
}
