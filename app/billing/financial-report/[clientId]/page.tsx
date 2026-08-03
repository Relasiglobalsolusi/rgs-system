import { notFound } from "next/navigation";
import {
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { getFinancialReportClientProjects } from "@/app/billing/financial-report/actions";
import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import FinancialReportProjectDirectory from "@/components/billing/FinancialReportProjectDirectory";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { formatContractPrice } from "@/lib/project-billing";

export default async function FinancialReportClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const t = createTranslator(await getServerLocale());
  const data = await getFinancialReportClientProjects(clientId);

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
            href: "/billing/financial-report",
          },
          { label: data.clientName },
        ]}
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DirectoryStatCard
          title={t("pages.financialReport.totalContractValue")}
          value={formatContractPrice(data.totalContractValue)}
          subtitle={t("pages.financialReport.contractValueHint")}
          icon={<Wallet size={18} />}
          accent="info"
        />
        <DirectoryStatCard
          title={t("pages.financialReport.totalSpending")}
          value={formatContractPrice(data.totalSpending)}
          subtitle={t("pages.financialReport.spendingHint")}
          icon={<Package size={18} />}
          accent="warning"
        />
        <DirectoryStatCard
          title={t("pages.financialReport.profit")}
          value={formatContractPrice(data.profit)}
          subtitle={t("pages.financialReport.contractMinusSpending")}
          icon={<TrendingUp size={18} />}
          accent={data.profit < 0 ? "danger" : "success"}
        />
      </div>

      <FinancialReportProjectDirectory
        clientId={clientId}
        projects={data.projects}
      />
    </AppShell>
  );
}
