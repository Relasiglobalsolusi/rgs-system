import {
  getFinancialReportClients,
  getFinancialReportCompanyTotals,
  listFinancialReportBankAccounts,
  listFinancialReportScopeClients,
} from "@/app/billing/financial-report/actions";
import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import FinancialReportClientDirectory from "@/components/billing/FinancialReportClientDirectory";
import FinancialReportCompanyOverview from "@/components/billing/FinancialReportCompanyOverview";
import FinancialReportFilters from "@/components/billing/FinancialReportFilters";
import { directoryToolbarDownloadClass } from "@/components/ui/DirectoryFilterSelect";
import {
  financialReportQueryString,
  parseFinancialReportSelection,
} from "@/lib/financial-report-query";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { requireFinanceChild } from "@/lib/session";

type SearchParams = Promise<{
  year?: string;
  month?: string;
  bank?: string;
}>;

export default async function FinancialReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireFinanceChild("financialReport");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const params = await searchParams;
  const selection = parseFinancialReportSelection(params);
  const queryString = financialReportQueryString(selection);
  const [clients, company, scopeClients, bankAccounts] = await Promise.all([
    getFinancialReportClients(selection),
    getFinancialReportCompanyTotals(selection),
    listFinancialReportScopeClients(),
    listFinancialReportBankAccounts(),
  ]);

  return (
    <AppShell
      titleKey="pages.financialReport.title"
    >
      <BillingBreadcrumbs
        items={[{ label: t("pages.financialReport.title") }]}
      />
      <FinancialReportFilters
        selection={selection}
        clients={scopeClients}
        scopeClientId={null}
        bankAccounts={bankAccounts}
        action={
          <a
            href={`/api/billing/financial-report?year=${selection.year}${
              selection.month != null ? `&month=${selection.month}` : ""
            }${selection.bank ? `&bank=${selection.bank}` : ""}`}
            className={directoryToolbarDownloadClass}
          >
            {t("pages.financialReport.downloadReport")}
          </a>
        }
      />
      <FinancialReportCompanyOverview
        company={company}
        queryString={queryString}
        clients={clients}
      />
      <FinancialReportClientDirectory
        clients={clients}
        queryString={queryString}
      />
    </AppShell>
  );
}
