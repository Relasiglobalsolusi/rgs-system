import { notFound, redirect } from "next/navigation";

import {
  getAttendanceMonthData,
  getAttendanceProjectContext,
} from "@/app/attendance/actions";
import {
  defaultReportPeriod,
  isReportPeriodInBounds,
} from "@/lib/report-period-bounds";
import { formatMonthLabel } from "@/lib/monthly-report";
import { getServerLocale } from "@/lib/i18n/locale";
import { requireModule } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import AttendanceBreadcrumbs from "@/components/attendance/AttendanceBreadcrumbs";
import AttendanceMonthFeed from "@/components/attendance/AttendanceMonthFeed";

type Props = {
  params: Promise<{ clientId: string; projectId: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function AttendanceProjectPage({
  params,
  searchParams,
}: Props) {
  await requireModule("attendance");
  const { clientId, projectId } = await params;
  const query = await searchParams;
  const locale = await getServerLocale();

  const context = await getAttendanceProjectContext(clientId, projectId);
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

  // Default to current Jakarta month — no separate picker step required.
  if (!hasPeriod) {
    const def = defaultReportPeriod(context.bounds);
    redirect(
      `/attendance/${clientId}/${projectId}?year=${def.year}&month=${def.month}`
    );
  }

  const year = yearRaw;
  const month = monthRaw;

  if (!isReportPeriodInBounds(year, month, context.bounds)) {
    notFound();
  }

  const data = await getAttendanceMonthData(clientId, projectId, year, month);
  if (!data) notFound();

  const periodLabel = formatMonthLabel(year, month, locale);

  return (
    <AppShell
      title={context.projectName}
      description={`${context.clientName} · ${periodLabel}`}
    >
      <AttendanceBreadcrumbs
        items={[
          { labelKey: "pages.attendance.title", href: "/attendance" },
          { label: context.clientName, href: `/attendance/${clientId}` },
          { label: context.projectName },
        ]}
      />
      <AttendanceMonthFeed
        data={data}
        clientId={clientId}
        projectId={projectId}
        year={year}
        month={month}
        bounds={context.bounds}
        periodLabel={periodLabel}
      />
    </AppShell>
  );
}
