import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import TaxRatesPanel from "@/components/billing/TaxRatesPanel";
import { getTaxRateTypes } from "@/app/billing/tax-invoices/rates/actions";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { requireFinanceChild } from "@/lib/session";

export default async function TaxRatesPage() {
  const session = await requireFinanceChild("taxInvoices");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  if (session.user.clientId || session.user.vendorId) {
    return null;
  }
  const types = await getTaxRateTypes();

  return (
    <AppShell titleKey="pages.taxRates.title">
      <BillingBreadcrumbs
        items={[
          {
            label: t("pages.billing.taxInvoice"),
            href: "/billing/tax-invoices",
          },
          { label: t("pages.taxRates.title") },
        ]}
      />
      <TaxRatesPanel types={types} />
    </AppShell>
  );
}
