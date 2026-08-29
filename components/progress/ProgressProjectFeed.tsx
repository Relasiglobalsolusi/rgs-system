"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Pencil } from "lucide-react";

import type { ProgressEarlyCheckOutRow } from "@/app/progress/actions";
import ProgressDialog, {
  type EditableProgressReport,
} from "@/components/progress/ProgressDialog";
import ProgressEarlyCheckoutBanner from "@/components/progress/ProgressEarlyCheckoutBanner";
import ProgressPhotoCarousel from "@/components/progress/ProgressPhotoCarousel";
import ProgressProjectExports from "@/components/progress/ProgressProjectExports";
import {
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { yearMonthFromDateInput } from "@/lib/closed-report-period";
import { formatDisplayDate, formatDisplayTime } from "@/lib/format-date";
import { formatDateInput, parseDateInput } from "@/lib/invoice-period";
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { todayDateInput } from "@/lib/project-contract";
import {
  clampReportPeriod,
  listAllowedMonths,
  listAllowedYears,
  type ReportPeriodBounds,
} from "@/lib/report-period-bounds";
import { cn } from "@/lib/utils";

export type FeedReport = {
  id: string;
  notes: string | null;
  stageLabel: string | null;
  reportDate: Date | string;
  createdAt: Date | string;
  employeeId: string;
  projectId: string;
  project: { id: string; name: string };
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNo: string;
    category: { name: string } | null;
  };
  photos: { id: string; url: string }[];
};

export type FeedEmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
};

export type ProgressFeedViewMode = "day" | "month";

type Props = {
  project: { id: string; name: string };
  reports: FeedReport[];
  employees: FeedEmployeeOption[];
  selectedEmployeeId?: string;
  /** YYYY-MM-DD (Asia/Jakarta). Defaults to today on the server. */
  selectedDate: string;
  viewMode?: ProgressFeedViewMode;
  selectedYear?: number;
  selectedMonth?: number;
  /** Project start through current month — viewing only, not downloads. */
  viewBounds?: ReportPeriodBounds | null;
  backHref: string;
  currentEmployeeId?: string | null;
  canManage?: boolean;
  canEdit?: boolean;
  exportClientId?: string | null;
  earlyCheckouts?: {
    day: ProgressEarlyCheckOutRow[];
    month: ProgressEarlyCheckOutRow[];
  };
};

function toDateInput(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return formatDateInput(date);
}

function padMonth(month: number): string {
  return String(month).padStart(2, "0");
}

const feedFieldClass =
  "box-border h-11 min-h-11 max-h-11 w-full rounded-xl border border-border bg-elevated px-4 py-0 text-sm leading-none shadow-none";

const feedDateInputClass = cn(
  employeeInputClass,
  feedFieldClass,
  "min-w-0 max-w-none [field-sizing:fixed] [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit]:leading-none"
);

const feedSelectTriggerClass = cn(
  employeeSelectTriggerClass,
  feedFieldClass,
  "flex items-center data-[size=default]:h-11 data-[size=default]:min-h-11 data-[size=default]:max-h-11 data-[size=default]:py-0"
);

function monthFirstDate(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${padMonth(month)}-01`;
}

function monthRangeLabel(year: number, month: number): string {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return `${formatDisplayDate(start, { timeZone: "UTC" })} – ${formatDisplayDate(end, { timeZone: "UTC" })}`;
}

function groupReportsByDate(reports: FeedReport[]): {
  dateKey: string;
  reports: FeedReport[];
}[] {
  const groups: { dateKey: string; reports: FeedReport[] }[] = [];
  const indexByDate = new Map<string, number>();
  for (const report of reports) {
    const dateKey = toDateInput(report.reportDate);
    const existing = indexByDate.get(dateKey);
    if (existing === undefined) {
      indexByDate.set(dateKey, groups.length);
      groups.push({ dateKey, reports: [report] });
    } else {
      groups[existing]!.reports.push(report);
    }
  }
  return groups;
}

function FeedReportCard({
  report,
  canEditCard,
  onEdit,
  onPhotoClick,
}: {
  report: FeedReport;
  canEditCard: boolean;
  onEdit: (report: FeedReport) => void;
  onPhotoClick: (src: string) => void;
}) {
  const { t, locale } = useT();
  const name = `${report.employee.firstName} ${report.employee.lastName}`;
  const dateLabel = formatDisplayDate(report.reportDate, {
    timeZone: "UTC",
  });
  const meta = [
    report.employee.employeeNo,
    report.employee.category
      ? localizeDepartmentLabel(null, report.employee.category.name, locale)
      : null,
    report.stageLabel,
    `${dateLabel} · ${formatDisplayTime(report.createdAt)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="flex gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="h-24 w-36 shrink-0 overflow-hidden rounded-xl bg-inset">
        {report.photos.length > 0 ? (
          <ProgressPhotoCarousel
            photos={report.photos}
            alt={t("pages.progress.progressPhoto")}
            onPhotoClick={onPhotoClick}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center gap-2 text-muted">
            <Camera className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-text">{name}</p>
            <p className="mt-0.5 truncate text-xs text-subtle">{meta}</p>
          </div>
          {canEditCard ? (
            <Button
              type="button"
              size="badge"
              variant="secondary"
              className="shrink-0 gap-1"
              onClick={() => onEdit(report)}
            >
              <Pencil className="h-3.5 w-3.5" />
              {t("common.actions.edit")}
            </Button>
          ) : null}
        </div>
        {report.notes ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
            {report.notes}
          </p>
        ) : (
          <p className="mt-2 text-sm text-subtle">
            {t("pages.progress.noNotes")}
          </p>
        )}
        <p className="mt-1 text-xs text-subtle">
          {t(
            report.photos.length === 1
              ? "pages.progress.photoCountOne"
              : "pages.progress.photoCountOther",
            { count: report.photos.length }
          )}
        </p>
      </div>
    </article>
  );
}

export default function ProgressProjectFeed({
  project,
  reports,
  employees,
  selectedEmployeeId,
  selectedDate,
  viewMode = "day",
  selectedYear,
  selectedMonth,
  viewBounds = null,
  backHref,
  currentEmployeeId = null,
  canEdit = true,
  exportClientId = null,
  earlyCheckouts,
}: Props) {
  const { t, bcp47 } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dateValue, setDateValue] = useState(selectedDate);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [editReport, setEditReport] = useState<EditableProgressReport | null>(
    null
  );

  const year =
    selectedYear ??
    yearMonthFromDateInput(selectedDate)?.year ??
    viewBounds?.max.year ??
    new Date().getUTCFullYear();
  const month =
    selectedMonth ??
    yearMonthFromDateInput(selectedDate)?.month ??
    viewBounds?.max.month ??
    1;

  useEffect(() => {
    setDateValue(selectedDate);
  }, [selectedDate]);

  const employeeItems = useMemo(
    () => [
      { value: "all", label: t("pages.progress.filterAllEmployees") },
      ...employees.map((employee) => ({
        value: employee.id,
        label: `${employee.firstName} ${employee.lastName}`,
      })),
    ],
    [employees, t]
  );

  const yearOptions = viewBounds ? listAllowedYears(viewBounds) : [];
  const monthOptions = viewBounds
    ? listAllowedMonths(year, viewBounds)
    : [];

  const monthGroups = useMemo(
    () => (viewMode === "month" ? groupReportsByDate(reports) : []),
    [reports, viewMode]
  );

  function mayEdit(report: FeedReport): boolean {
    if (!canEdit) return false;
    if (!(currentEmployeeId && report.employeeId === currentEmployeeId)) {
      return false;
    }
    // Author-only + same Jakarta calendar day as reportDate.
    return toDateInput(report.reportDate) === todayDateInput();
  }

  function pushFeedQuery(next: {
    date?: string;
    employeeId?: string;
    view?: ProgressFeedViewMode;
    year?: number;
    month?: number;
  }) {
    const params = new URLSearchParams();
    params.set("projectId", project.id);
    const view = next.view ?? viewMode;
    params.set("view", view);
    const date = next.date ?? selectedDate;
    if (date) params.set("date", date);
    const nextYear = next.year ?? year;
    const nextMonth = next.month ?? month;
    if (view === "month") {
      params.set("year", String(nextYear));
      params.set("month", String(nextMonth));
    }
    const employeeId =
      next.employeeId !== undefined ? next.employeeId : selectedEmployeeId;
    if (employeeId) params.set("employeeId", employeeId);
    startTransition(() => {
      router.push(`/progress?${params.toString()}`);
    });
  }

  function onEmployeeFilter(value: string | null) {
    const next = value && value !== "all" ? value : "";
    pushFeedQuery({ employeeId: next });
  }

  function onDateChange(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    try {
      if (formatDateInput(parseDateInput(value)) !== value) return;
    } catch {
      return;
    }
    setDateValue(value);
    pushFeedQuery({ view: "day", date: value });
  }

  function onViewMode(next: ProgressFeedViewMode) {
    if (next === viewMode) return;
    if (next === "month") {
      const fromDate = yearMonthFromDateInput(selectedDate);
      const clamped = viewBounds
        ? clampReportPeriod(
            fromDate?.year ?? viewBounds.max.year,
            fromDate?.month ?? viewBounds.max.month,
            viewBounds
          )
        : { year, month };
      pushFeedQuery({
        view: "month",
        year: clamped.year,
        month: clamped.month,
        date: monthFirstDate(clamped.year, clamped.month),
      });
      return;
    }
    pushFeedQuery({ view: "day" });
  }

  function onMonthYearChange(nextYear: number, nextMonth: number) {
    if (!viewBounds) return;
    const clamped = clampReportPeriod(nextYear, nextMonth, viewBounds);
    pushFeedQuery({
      view: "month",
      year: clamped.year,
      month: clamped.month,
      date: monthFirstDate(clamped.year, clamped.month),
    });
  }

  function openEdit(report: FeedReport) {
    setEditReport({
      id: report.id,
      projectId: report.projectId,
      projectName: report.project.name,
      stageLabel: report.stageLabel,
      notes: report.notes,
      reportDate: toDateInput(report.reportDate),
      photos: report.photos,
    });
  }

  const periodLabel =
    viewMode === "month"
      ? t("pages.progress.reportsForMonth", {
          range: monthRangeLabel(year, month),
        })
      : t("pages.progress.reportsForDate", {
          date: formatDisplayDate(parseDateInput(selectedDate), {
            timeZone: "UTC",
          }),
        });

  return (
    <div className="w-full space-y-5">
      <div className="min-w-0">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-cyan-400 transition hover:text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("pages.progress.backToProjects")}
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-text">{project.name}</h2>
        <p className="mt-1 text-xs text-subtle">
          {periodLabel}
          {" · "}
          {t(
            reports.length === 1
              ? "pages.progress.feedReportCountOne"
              : "pages.progress.feedReportCountOther",
            { count: reports.length }
          )}
        </p>
      </div>
      <div
        className={cn(
          "min-w-0 space-y-4",
          pending && "pointer-events-none opacity-70"
        )}
      >
          <div className="space-y-2">
          <p className="text-sm font-medium text-text">
            {t("pages.progress.viewMode")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="badge"
              variant={viewMode === "day" ? "default" : "secondary"}
              onClick={() => onViewMode("day")}
            >
              {t("pages.progress.attendanceModeDay")}
            </Button>
            <Button
              type="button"
              size="badge"
              variant={viewMode === "month" ? "default" : "secondary"}
              onClick={() => onViewMode("month")}
            >
              {t("pages.progress.attendanceModeMonth")}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "grid grid-cols-1 items-start gap-4",
            employees.length > 0 && "sm:grid-cols-2"
          )}
        >
          {viewMode === "month" && viewBounds ? (
            <div className="min-w-0 w-full space-y-2">
              <p className="text-sm font-medium text-text">
                {t("pages.progress.filterByMonth")}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select
                  value={String(month)}
                  onValueChange={(value) => {
                    if (value != null) {
                      onMonthYearChange(year, Number(value));
                    }
                  }}
                >
                  <SelectTrigger className={feedSelectTriggerClass}>
                    <SelectValue>
                      {(value) =>
                        value
                          ? t(`pages.reports.months.${value}`)
                          : t("common.labels.month")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {t(`pages.reports.months.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(year)}
                  onValueChange={(value) => {
                    if (value != null) {
                      onMonthYearChange(Number(value), month);
                    }
                  }}
                >
                  <SelectTrigger className={feedSelectTriggerClass}>
                    <SelectValue>
                      {(value) => value ?? t("common.labels.year")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-subtle">
                {t("pages.progress.filterByMonthHint")}
              </p>
            </div>
          ) : (
            <div className="min-w-0 w-full space-y-2">
              <label
                htmlFor="progress-feed-date"
                className="text-sm font-medium text-text"
              >
                {t("pages.progress.filterByDate")}
              </label>
              <Input
                id="progress-feed-date"
                type="date"
                lang={bcp47}
                value={dateValue}
                onChange={(event) => onDateChange(event.target.value)}
                className={feedDateInputClass}
              />
              <p className="text-xs text-subtle">
                {t("pages.progress.filterByDateHint")}
              </p>
            </div>
          )}
          {employees.length > 0 ? (
            <div className="min-w-0 w-full space-y-2">
              <label className="text-sm font-medium text-text">
                {t("pages.progress.filterByEmployee")}
              </label>
              <Select
                value={selectedEmployeeId || "all"}
                onValueChange={onEmployeeFilter}
                items={employeeItems}
              >
                <SelectTrigger className={feedSelectTriggerClass}>
                  <SelectValue placeholder={t("pages.progress.filterAllEmployees")}>
                    {(value) => {
                      if (!value || value === "all") {
                        return t("pages.progress.filterAllEmployees");
                      }
                      const employee = employees.find((e) => e.id === value);
                      return employee
                        ? `${employee.firstName} ${employee.lastName}`
                        : String(value);
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("pages.progress.filterAllEmployees")}
                  </SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.firstName} {employee.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <ProgressProjectExports
          projectId={project.id}
          clientId={exportClientId}
          viewMode={viewMode}
          selectedDate={selectedDate}
          year={year}
          month={month}
        />
      </div>

      {earlyCheckouts ? (
        <ProgressEarlyCheckoutBanner
          selectedDate={selectedDate}
          viewMode={viewMode}
          dayRows={earlyCheckouts.day}
          monthRows={earlyCheckouts.month}
        />
      ) : null}

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-subtle">
          {t(
            viewMode === "month"
              ? "pages.progress.emptyForMonth"
              : "pages.progress.emptyForDate"
          )}
        </div>
      ) : viewMode === "month" ? (
        <div className="space-y-5">
          {monthGroups.map((group) => (
            <section key={group.dateKey} className="space-y-3">
              <h3 className="text-sm font-semibold text-text">
                {formatDisplayDate(parseDateInput(group.dateKey), {
                  timeZone: "UTC",
                })}{" "}
                <span className="font-medium text-subtle">
                  ({group.reports.length})
                </span>
              </h3>
              <div className="space-y-3">
                {group.reports.map((report) => (
                  <FeedReportCard
                    key={report.id}
                    report={report}
                    canEditCard={mayEdit(report)}
                    onEdit={openEdit}
                    onPhotoClick={setLightboxSrc}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <FeedReportCard
              key={report.id}
              report={report}
              canEditCard={mayEdit(report)}
              onEdit={openEdit}
              onPhotoClick={setLightboxSrc}
            />
          ))}
        </div>
      )}

      <ProgressDialog
        projects={[]}
        hideTrigger
        editReport={editReport}
        open={editReport != null}
        onOpenChange={(open) => {
          if (!open) setEditReport(null);
        }}
      />

      <ImageLightbox
        open={lightboxSrc != null}
        onOpenChange={(open) => {
          if (!open) setLightboxSrc(null);
        }}
        src={lightboxSrc}
        alt={t("pages.progress.progressPhoto")}
      />
    </div>
  );
}
