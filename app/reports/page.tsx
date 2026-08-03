import { redirect } from "next/navigation";

import { getReportClients } from "@/app/reports/actions";
import { requireModule } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import ReportBreadcrumbs from "@/components/reports/ReportBreadcrumbs";
import ReportClientDirectory from "@/components/reports/ReportClientDirectory";

export default async function ReportsPage() {
  const session = await requireModule("reports");
  const clients = await getReportClients();

  if (session.user.clientId && clients.length === 1) {
    redirect(`/reports/${clients[0]!.id}`);
  }

  const isClientPortal = Boolean(session.user.clientId);

  return (
    <AppShell
      titleKey="pages.reports.title"
      descriptionKey={
        isClientPortal
          ? "pages.reports.descriptionClient"
          : "pages.reports.descriptionAdmin"
      }
    >
      <ReportBreadcrumbs items={[{ labelKey: "pages.reports.title" }]} />
      <ReportClientDirectory clients={clients} />
    </AppShell>
  );
}
