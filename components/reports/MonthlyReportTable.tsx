"use client";

import type { ProjectMonthlyReport } from "@/lib/monthly-report";
import { formatDisplayDate } from "@/lib/format-date";
import {
  localizeSubCategoryChipLines,
  localizeSubCategoryShort,
} from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";

type Props = {
  projects: ProjectMonthlyReport[];
  periodLabel: string;
  companyName: string;
};

function Metric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wider text-subtle">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-text print:text-black">
        {value}
      </p>
    </div>
  );
}

export default function MonthlyReportTable({
  projects,
  periodLabel,
  companyName,
}: Props) {
  const { t, locale } = useT();

  if (projects.length === 0) {
    return (
      <EmptyState
        title={t("pages.reports.noReports")}
        description={t("pages.reports.noReports")}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="mb-6 hidden print:block">
        <div className="flex items-start justify-between gap-6 border-b-2 border-[#40c0b0] pb-4">
          <div className="flex min-w-0 items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/rgs-logo.png"
              alt="Relasi Global Solusi"
              className="h-14 w-auto object-contain"
            />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-black">
                {t("pages.reports.title")} — {periodLabel}
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                {formatDisplayDate(new Date())}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right text-xs leading-relaxed text-gray-700">
            <p className="font-semibold text-black">
              PT. Relasi Global Solusi
            </p>
            <p>{companyName}</p>
            <p>Jl. Daan Mogot KM 14.5 Ruko Point 8, Blok F6</p>
            <p>RT 002 | RW 014, Jakarta Barat 11750</p>
            <p>+62 21 2295 2228</p>
            <p>contact@rgs.co.id</p>
          </div>
        </div>
      </div>

      {projects.map((project) => {
        const chipLines = localizeSubCategoryChipLines(
          project.subCategory,
          locale
        );
        const shortLabel = localizeSubCategoryShort(
          project.subCategory,
          locale
        );

        return (
          <SectionCard
            key={project.projectId}
            className="print:break-inside-avoid"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4 print:border-gray-300">
              <div className="min-w-0 space-y-1">
                <h3 className="text-lg font-semibold text-text print:text-black">
                  {project.projectName}
                </h3>
                <p className="text-sm text-subtle print:text-gray-600">
                  {[project.clientName, project.location]
                    .filter(Boolean)
                    .join(" · ") || t("pages.reports.noClientLocation")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 no-print">
                {chipLines ? (
                  <StatusBadge status="info" lines={chipLines} />
                ) : shortLabel !== "-" ? (
                  <StatusBadge status="info" compact>
                    {shortLabel}
                  </StatusBadge>
                ) : null}
                <StatusBadge
                  status="success"
                  lines={[
                    String(project.reportCount),
                    t("pages.reports.columns.reports"),
                  ]}
                />
              </div>
              <p className="hidden text-sm text-gray-600 print:block">
                {shortLabel !== "-" ? `${shortLabel} · ` : ""}
                {t(
                  project.reportCount === 1
                    ? "pages.reports.progressReportCountOne"
                    : "pages.reports.progressReportCountOther",
                  { count: project.reportCount }
                )}
              </p>
            </div>

            <div className="grid gap-4 border-b border-border py-4 sm:grid-cols-3 print:border-gray-200">
              <Metric
                label={t("pages.reports.daysWithProgress")}
                value={project.daysWithProgress}
              />
              <Metric
                label={t("pages.reports.totalEntries")}
                value={project.totalProgressEntries}
              />
              <Metric
                label={t("pages.reports.staffInvolved")}
                value={project.staff.length}
              />
            </div>

            <div className="py-4">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-subtle">
                {t("pages.reports.activitySummary")}
              </p>
              <p className="text-sm leading-relaxed text-muted print:text-gray-700">
                {project.activitySummary ||
                  t("pages.reports.noProgressThisMonth")}
              </p>
            </div>

            {project.staff.length > 0 ? (
              <div className="overflow-x-auto border-t border-border pt-4 print:border-gray-200">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-subtle print:border-gray-300">
                      <th className="pb-3 pr-4 font-medium">
                        {t("pages.reports.columns.staff")}
                      </th>
                      <th className="pb-3 pr-4 font-medium">
                        {t("pages.reports.columns.employeeNo")}
                      </th>
                      <th className="pb-3 pr-4 font-medium">
                        {t("pages.reports.columns.progress")}
                      </th>
                      <th className="pb-3 font-medium">
                        {t("pages.reports.columns.attendance")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.staff.map((member) => (
                      <tr
                        key={member.employeeId}
                        className="border-b border-border last:border-b-0 print:border-gray-200"
                      >
                        <td className="py-3 pr-4 font-medium text-text print:text-black">
                          {member.name}
                        </td>
                        <td className="py-3 pr-4 text-subtle print:text-gray-600">
                          {member.employeeNo}
                        </td>
                        <td className="py-3 pr-4 tabular-nums text-muted print:text-gray-700">
                          {member.progressDays}
                        </td>
                        <td className="py-3 tabular-nums text-muted print:text-gray-700">
                          {member.attendanceDays}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </SectionCard>
        );
      })}
    </div>
  );
}
