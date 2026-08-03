import { notFound } from "next/navigation";

import {
  getProjectMonthlyDayFeedForUser,
  getReportProjectContext,
} from "@/app/reports/actions";
import { formatMonthLabel } from "@/lib/monthly-report";
import { isReportPeriodInBounds } from "@/lib/report-period-bounds";
import { getServerLocale } from "@/lib/i18n/locale";
import { requireModule } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import ProjectMonthlyDayFeed from "@/components/reports/ProjectMonthlyDayFeed";
import ReportBreadcrumbs from "@/components/reports/ReportBreadcrumbs";
import ReportMonthPicker from "@/components/reports/ReportMonthPicker";

type Props = {
  params: Promise<{ clientId: string; projectId: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function ReportsProjectPage({ params, searchParams }: Props) {
  await requireModule("reports");
  const { clientId, projectId } = await params;
  const query = await searchParams;
  const locale = await getServerLocale();

  const context = await getReportProjectContext(clientId, projectId);
  if (!context) notFound();

  const yearRaw = Number(query.year);
  const monthRaw = Number(query.month);
  const hasPeriod =
    Number.isFinite(yearRaw) &&
    Number.isFinite(monthRaw) &&
    monthRaw >= 1 &&
    monthRaw <= 12 &&
    yearRaw >= 2000 &&
    yearRaw <= 2100;

  if (!hasPeriod) {
    return (
      <AppShell
        title={context.projectName}
        descriptionKey="pages.reports.selectPeriodDesc"
      >
        <ReportMonthPicker
          clientId={clientId}
          projectId={projectId}
          bounds={context.bounds}
        />
      </AppShell>
    );
  }

  const year = yearRaw;
  const month = monthRaw;

  if (!isReportPeriodInBounds(year, month, context.bounds)) {
    notFound();
  }

  const feed = await getProjectMonthlyDayFeedForUser(
    clientId,
    projectId,
    year,
    month
  );

  if (!feed) notFound();

  const periodLabel = formatMonthLabel(year, month, locale);

  return (
    <AppShell
      title={feed.projectName}
      description={`${feed.clientName} · ${periodLabel}`}
    >
      <ReportBreadcrumbs
        items={[
          { labelKey: "pages.reports.title", href: "/reports" },
          { label: feed.clientName, href: `/reports/${clientId}` },
          { label: feed.projectName },
        ]}
      />

      <ProjectMonthlyDayFeed
        feed={feed}
        periodLabel={periodLabel}
        clientId={clientId}
        projectId={projectId}
        year={year}
        month={month}
      />
    </AppShell>
  );
}
