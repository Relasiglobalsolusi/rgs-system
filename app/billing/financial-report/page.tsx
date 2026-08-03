import { getFinancialReportClients } from "@/app/billing/financial-report/actions";
import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import FinancialReportClientDirectory from "@/components/billing/FinancialReportClientDirectory";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";

export default async function FinancialReportPage() {
  const t = createTranslator(await getServerLocale());
  const clients = await getFinancialReportClients();

  return (
    <AppShell
      titleKey="pages.financialReport.title"
      descriptionKey="pages.financialReport.description"
    >
      <BillingBreadcrumbs
        items={[{ label: t("pages.financialReport.title") }]}
      />
      <FinancialReportClientDirectory clients={clients} />
    </AppShell>
  );
}
