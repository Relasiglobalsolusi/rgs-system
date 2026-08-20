"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";

import type { AttendanceMonthData, AttendanceDayGroup, AttendanceMonthRow } from "@/app/attendance/actions";
import type { ReportPeriodBounds } from "@/lib/report-period-bounds";
import AttendanceMonthPeriodControl from "@/components/attendance/AttendanceMonthPeriodControl";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import ImageLightbox from "@/components/ui/ImageLightbox";
import SectionCard from "@/components/ui/SectionCard";
import { formatDistanceMeters } from "@/lib/geo";
import { formatDisplayTime } from "@/lib/format-date";
import { formatHoursWorked } from "@/lib/shift-pay";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  data: AttendanceMonthData;
  clientId: string;
  projectId: string;
  year: number;
  month: number;
  bounds: ReportPeriodBounds;
  periodLabel: string;
};

export default function AttendanceMonthFeed({
  data,
  clientId,
  projectId,
  year,
  month,
  bounds,
  periodLabel,
}: Props) {
  const { t } = useT();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const todayGroup = useMemo(
    () => data.groups.find((g) => g.isToday) ?? null,
    [data.groups]
  );

  const totalCheckIns = useMemo(
    () => data.groups.reduce((sum, g) => sum + g.rows.filter((r) => r.checkIn).length, 0),
    [data.groups]
  );

  const columns: DataTableColumn<AttendanceMonthRow>[] = useMemo(
    () => [
      {
        key: "employee",
        title: t("pages.attendance.columns.employee"),
        render: (row) => (
          <div className="min-w-0">
            <p className="font-medium text-text">
              {row.employee.firstName} {row.employee.lastName}
            </p>
            <p className="text-sm text-subtle">{row.employee.employeeNo}</p>
          </div>
        ),
      },
      {
        key: "photo",
        title: t("pages.progress.columns.photos"),
        width: "5rem",
        align: "center",
        className: "min-w-[5rem] whitespace-nowrap",
        render: (row: AttendanceMonthRow) =>
          row.checkInPhotoUrl ? (
            <button
              type="button"
              onClick={() => setLightboxSrc(row.checkInPhotoUrl)}
              className="relative mx-auto block h-9 w-9 overflow-hidden rounded-md border border-border bg-inset transition hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={t("common.actions.view")}
            >
              <Image
                src={row.checkInPhotoUrl}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
            </button>
          ) : (
            <span className="inline-flex justify-center text-subtle">
              <Camera className="h-4 w-4" />
            </span>
          ),
      },
      {
        key: "shift",
        title: t("common.labels.period"),
        width: "8rem",
        className: "min-w-[8rem] whitespace-nowrap",
        render: (row) => (
          <span className="text-subtle">{row.shiftLabel}</span>
        ),
      },
      {
        key: "checkIn",
        title: t("pages.attendance.columns.checkIn"),
        width: "8rem",
        className: "min-w-[8rem] whitespace-nowrap",
        render: (row) => (
          <div>
            <span
              className={
                row.isLate === true ? "text-amber-400" : "text-emerald-400"
              }
            >
              {row.checkIn ? formatDisplayTime(row.checkIn) : "-"}
            </span>
            {row.isLate === true && (
              <p className="text-xs text-amber-500">
                {t("pages.projects.late")}
              </p>
            )}
            {row.checkInDistanceMeters != null && (
              <p className="text-xs text-subtle">
                {formatDistanceMeters(row.checkInDistanceMeters)}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "checkOut",
        title: t("pages.attendance.columns.checkOut"),
        width: "8rem",
        className: "min-w-[8rem] whitespace-nowrap",
        render: (row) => (
          <div>
            <span className="text-orange-400">
              {row.checkOut ? formatDisplayTime(row.checkOut) : "-"}
            </span>
            {row.isEarly === true && (
              <p className="text-xs text-amber-500">
                {t("pages.attendance.checkedOutBeforeShiftEnd")}
              </p>
            )}
            {row.underAssignedHours && row.hoursWorked != null && (
              <p className="text-xs text-amber-500">
                {t("pages.attendance.underAssignedHours", {
                  hours: formatHoursWorked(row.hoursWorked),
                  required: String(row.requiredHours ?? 9),
                })}
              </p>
            )}
            {row.checkOutDistanceMeters != null && (
              <p className="text-xs text-subtle">
                {formatDistanceMeters(row.checkOutDistanceMeters)}
              </p>
            )}
          </div>
        ),
      },
    ],
    [t]
  );

  return (
    <div className="space-y-6">
      <AttendanceMonthPeriodControl
        clientId={clientId}
        projectId={projectId}
        year={year}
        month={month}
        bounds={bounds}
      />

      {/* Today strip — shown only when today falls in the selected month */}
      {todayGroup && (
        <SectionCard className="border-primary/30 bg-primary/5">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
              {t("pages.attendance.todayBadge")}
            </span>
            <span className="text-sm font-medium text-text">
              {todayGroup.dateLabel}
            </span>
            <span className="text-xs text-subtle">
              {t(
                todayGroup.rows.filter((r) => r.checkIn).length === 1
                  ? "pages.attendance.checkInCountOne"
                  : "pages.attendance.checkInCountOther",
                { count: todayGroup.rows.filter((r) => r.checkIn).length }
              )}
            </span>
          </div>
          {todayGroup.rows.length > 0 ? (
            <DataTable
              columns={columns}
              data={todayGroup.rows}
              emptyMessage={t("pages.attendance.emptyTitle")}
            />
          ) : (
            <p className="text-sm text-muted">{t("pages.attendance.noCheckInToday")}</p>
          )}
        </SectionCard>
      )}

      {/* Month summary subtitle */}
      <div>
        <h2 className="text-base font-semibold text-text">
          {t("pages.attendance.attendanceForMonth", { period: periodLabel })}
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          {t(
            totalCheckIns === 1
              ? "pages.attendance.checkInsInMonth"
              : "pages.attendance.checkInsInMonthOther",
            { count: totalCheckIns }
          )}
        </p>
      </div>

      {data.groups.length === 0 ? (
        <EmptyState
          titleKey="pages.attendance.emptyTitle"
          descriptionKey="pages.attendance.noRecordsInMonth"
        />
      ) : (
        <div className="space-y-4">
          {data.groups.map((group) => (
            <DayGroupCard
              key={group.dateKey}
              group={group}
              columns={columns}
              emptyMessage={t("pages.attendance.emptyTitle")}
              todayBadge={t("pages.attendance.todayBadge")}
            />
          ))}
        </div>
      )}

      <ImageLightbox
        open={lightboxSrc != null}
        onOpenChange={(open) => {
          if (!open) setLightboxSrc(null);
        }}
        src={lightboxSrc}
        alt={t("pages.cico.checkIn")}
      />
    </div>
  );
}

function DayGroupCard({
  group,
  columns,
  emptyMessage,
  todayBadge,
}: {
  group: AttendanceDayGroup;
  columns: DataTableColumn<AttendanceMonthRow>[];
  emptyMessage: string;
  todayBadge: string;
}) {
  return (
    <SectionCard
      className={cn(
        group.isToday && "border-primary/40 ring-1 ring-primary/20"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-text">{group.dateLabel}</h3>
        {group.isToday && (
          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            {todayBadge}
          </span>
        )}
      </div>
      <DataTable
        columns={columns}
        data={group.rows}
        emptyMessage={emptyMessage}
      />
    </SectionCard>
  );
}