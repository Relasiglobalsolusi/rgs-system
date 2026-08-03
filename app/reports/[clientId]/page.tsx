import { notFound } from "next/navigation";

import { getReportProjectsForClient } from "@/app/reports/actions";
import { requireModule } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import ReportBreadcrumbs from "@/components/reports/ReportBreadcrumbs";
import ReportProjectDirectory from "@/components/reports/ReportProjectDirectory";

type Props = {
  params: Promise<{ clientId: string }>;
};

export default async function ReportsClientPage({ params }: Props) {
  await requireModule("reports");
  const { clientId } = await params;
  const result = await getReportProjectsForClient(clientId);

  if (!result) notFound();

  return (
    <AppShell
      title={result.clientName}
      descriptionKey="pages.reports.clientProjectsDesc"
    >
      <ReportBreadcrumbs
        items={[
          { labelKey: "pages.reports.title", href: "/reports" },
          { label: result.clientName },
        ]}
      />
      <ReportProjectDirectory
        clientId={clientId}
        clientName={result.clientName}
        projects={result.projects}
      />
    </AppShell>
  );
}
