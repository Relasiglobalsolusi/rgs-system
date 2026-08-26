import { redirect } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import VatReportPanel from "@/components/billing/VatReportPanel";
import { parseFinancePeriod } from "@/lib/finance-period";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { requireFinanceChild } from "@/lib/session";
import { loadVatTaxWorkspace } from "@/lib/vat-ledger";

type SearchParams = Promise<{
  year?: string;
  month?: string;
  view?: string;
}>;

export default async function TaxInvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFinanceChild("taxInvoices");
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  if (session.user.clientId) {
    redirect("/billing");
  }
  if (session.user.vendorId) {
    redirect("/billing/purchase-invoices?view=tax");
  }

  const params = await searchParams;
  const { year, month } = parseFinancePeriod(params);
  const view =
    params.view === "input"
      ? "input"
      : params.view === "income"
        ? "income"
        : params.view === "other"
          ? "other"
          : "output";

  const workspace = await loadVatTaxWorkspace({
    companyId: session.user.companyId,
    year,
    month,
    t,
  });

  return (
    <AppShell titleKey="pages.billing.taxInvoice">
      <BillingBreadcrumbs items={[{ label: t("pages.billing.taxInvoice") }]} />
      <VatReportPanel
        year={year}
        month={month}
        view={view}
        outputTotal={workspace.outputTotal}
        inputTotal={workspace.inputTotal}
        net={workspace.net}
        creditBroughtForward={workspace.creditBroughtForward}
        outputRows={workspace.outputRows}
        inputRows={workspace.inputRows}
        outputPending={workspace.outputPending}
        inputPending={workspace.inputPending}
        incomeRows={workspace.incomeRows}
        incomeImportTotal={workspace.incomeImportTotal}
        incomeInstallmentTotal={workspace.incomeInstallmentTotal}
        otherRows={workspace.otherRows}
        otherRemittanceTotal={workspace.otherRemittanceTotal}
        otherExpenseTotal={workspace.otherExpenseTotal}
        basePath="/billing/tax-invoices"
        hideOutputLink
      />
    </AppShell>
  );
}
