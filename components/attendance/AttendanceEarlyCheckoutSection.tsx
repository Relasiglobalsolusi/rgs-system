"use client";

import Link from "next/link";
import { Clock } from "lucide-react";

import type { EarlyCheckOutRow } from "@/app/attendance/actions";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { formatDisplayDate, formatDisplayTime } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";

export function AttendanceEarlyCheckoutCard({
  count,
  selected,
  href,
  selectedHref,
}: {
  count: number;
  selected?: boolean;
  href?: string;
  selectedHref?: string;
}) {
  const { t } = useT();
  return (
    <Link
      href={
        selected
          ? selectedHref ?? "/attendance"
          : href ?? "/attendance?view=checked-out-before-shift-end"
      }
      className="block"
    >
      <DirectoryStatCard
        title={t("pages.attendance.checkedOutBeforeShiftEnd")}
        value={count}
        subtitle={t("pages.attendance.checkedOutBeforeShiftEndCardHint")}
        icon={<Clock size={18} />}
        accent={count > 0 ? "warning" : "muted"}
        selected={selected}
        compact
      />
    </Link>
  );
}

export default function AttendanceEarlyCheckoutSection({
  rows,
}: {
  rows: EarlyCheckOutRow[];
}) {
  const { t, locale } = useT();

  const columns: DataTableColumn<EarlyCheckOutRow>[] = [
    {
      key: "employee",
      title: t("pages.attendance.columns.employee"),
      width: "14rem",
      share: 2,
      className: "min-w-[14rem]",
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-text">{row.employeeName}</p>
          <p className="text-sm text-subtle">{row.employeeNo}</p>
        </div>
      ),
    },
    {
      key: "site",
      title: t("pages.attendance.columns.project"),
      width: "14rem",
      share: 2,
      className: "min-w-[14rem]",
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-text">{row.projectName}</p>
          <p className="text-sm text-subtle">{row.clientName}</p>
        </div>
      ),
    },
    {
      key: "date",
      title: t("pages.attendance.columns.date"),
      width: "10rem",
      className: "min-w-[10rem] whitespace-nowrap",
      render: (row) =>
        formatDisplayDate(row.date, { timeZone: "UTC" }, locale),
    },
    {
      key: "shiftEnd",
      title: t("pages.attendance.columns.shiftEnd"),
      width: "8rem",
      className: "min-w-[8rem] whitespace-nowrap",
      render: (row) => row.shiftEnd ?? "—",
    },
    {
      key: "checkOut",
      title: t("pages.attendance.columns.checkOut"),
      width: "8rem",
      className: "min-w-[8rem] whitespace-nowrap",
      render: (row) => formatDisplayTime(row.checkOut),
    },
    {
      key: "report",
      title: t("pages.attendance.columns.report"),
      width: "10rem",
      className: "min-w-[10rem]",
      render: (row) =>
        row.reportRecorded
          ? t("pages.attendance.reportRecorded")
          : "—",
    },
  ];

  return (
    <SectionCard>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text">
          {t("pages.attendance.checkedOutBeforeShiftEnd")}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {t("pages.attendance.checkedOutBeforeShiftEndDesc")}
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title={t("pages.attendance.checkedOutBeforeShiftEndEmpty")}
          description={t("pages.attendance.checkedOutBeforeShiftEndEmptyDesc")}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          getRowKey={(row) => row.id}
          emptyMessage={t("pages.attendance.checkedOutBeforeShiftEndEmpty")}
        />
      )}
    </SectionCard>
  );
}
