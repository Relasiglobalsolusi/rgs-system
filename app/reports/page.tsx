import { Suspense } from "react";
import { getMonthlyReport } from "@/app/reports/actions";
import { getServerLocale } from "@/lib/i18n/locale";
import { formatMonthLabel } from "@/lib/monthly-report";
import { canLockReports } from "@/lib/project-access";
import { isProjectSubCategory } from "@/lib/project-subcategory";
import { requireModule, toPermissionUser } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import ReportControls from "@/components/reports/ReportControls";
import MonthlyReportFilters from "@/components/reports/MonthlyReportFilters";
import MonthlyReportTable from "@/components/reports/MonthlyReportTable";
import ReportsPageHeader from "@/components/reports/ReportsPageHeader";

type Props = {
  searchParams: Promise<{
    year?: string;
    month?: string;
    subCategory?: string;
    q?: string;
  }>;
};

export default async function ReportsPage({ searchParams }: Props) {
  const session = await requireModule("reports");
  const params = await searchParams;

  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;
  const subCategory =
    params.subCategory && isProjectSubCategory(params.subCategory)
      ? params.subCategory
      : undefined;
  const q = params.q?.trim() || undefined;

  const [report, locale] = await Promise.all([
    getMonthlyReport(year, month, { subCategory, q }),
    getServerLocale(),
  ]);

  const periodLabel = formatMonthLabel(year, month, locale);
  const hasFilters = Boolean(subCategory || q);
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
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <ReportsPageHeader
          periodLabel={periodLabel}
          projectCount={report.projects.length}
          hasFilters={hasFilters}
        />
        <Suspense>
          <ReportControls
            year={year}
            month={month}
            canLock={canLockReports(toPermissionUser(session))}
            locked={report.locked}
            subCategory={subCategory}
            q={q}
          />
        </Suspense>
      </div>

      <MonthlyReportFilters
        year={year}
        month={month}
        subCategory={subCategory}
        q={q ?? ""}
      />

      <MonthlyReportTable
        projects={report.projects}
        periodLabel={periodLabel}
        companyName={session.user.companyName}
      />
    </AppShell>
  );
}
