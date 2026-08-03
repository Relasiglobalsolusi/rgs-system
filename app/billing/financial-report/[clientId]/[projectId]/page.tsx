import { notFound } from "next/navigation";

import { getFinancialReportProjectDetail } from "@/app/billing/financial-report/actions";
import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import FinancialReportProjectPanel from "@/components/billing/FinancialReportProjectPanel";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";

export default async function FinancialReportProjectPage({
  params,
}: {
  params: Promise<{ clientId: string; projectId: string }>;
}) {
  const { clientId, projectId } = await params;
  const t = createTranslator(await getServerLocale());
  const detail = await getFinancialReportProjectDetail(clientId, projectId);

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
            href: "/billing/financial-report",
          },
          {
            label: detail.clientName,
            href: `/billing/financial-report/${clientId}`,
          },
          { label: detail.projectName },
        ]}
      />

      <FinancialReportProjectPanel detail={detail} />
    </AppShell>
  );
}
