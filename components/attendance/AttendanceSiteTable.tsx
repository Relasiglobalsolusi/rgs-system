"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MapPin, Users } from "lucide-react";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { localizeProjectStatus } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";

export type AttendanceSiteRow = {
  id: string;
  name: string;
  location: string | null;
  status: string;
  staffCount: number;
  presentCount: number;
  lateCount: number;
};

type Props = {
  data: AttendanceSiteRow[];
};

export default function AttendanceSiteTable({ data }: Props) {
  const { t, locale } = useT();

  const columns = useMemo<DataTableColumn<AttendanceSiteRow>[]>(
    () => [
      {
        key: "name",
        title: t("pages.attendance.columns.project"),
        render: (row) => (
          <div className="min-w-0">
            <Link
              href={`/projects/${row.id}`}
              className="font-medium text-cyan-400 hover:text-cyan-300"
            >
              {row.name}
            </Link>
            {row.location && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-subtle">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{row.location}</span>
              </p>
            )}
          </div>
        ),
      },
      {
        key: "staff",
        title: t("pages.projects.detail.staff"),
        width: "8rem",
        className: "min-w-[8rem] whitespace-nowrap",
        render: (row) => (
          <span className="inline-flex items-center gap-1.5 text-muted">
            <Users className="h-3.5 w-3.5 text-subtle" />
            {row.staffCount}
          </span>
        ),
      },
      {
        key: "present",
        title: t("pages.dashboard.staffPresentToday"),
        width: "8rem",
        className: "min-w-[8rem] whitespace-nowrap",
        render: (row) => (
          <div className="text-sm">
            <p className="text-emerald-400">
              {row.presentCount}/{row.staffCount}
            </p>
            {row.lateCount > 0 && (
              <p className="text-xs text-amber-400">
                {t("pages.billing.lateCount", { count: row.lateCount })}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "status",
        title: t("pages.attendance.columns.status"),
        width: "10rem",
        className:
          "min-w-[10rem] overflow-visible whitespace-nowrap text-center",
        render: (row) => (
          <StatusBadge
            status={row.status === "IN_PROGRESS" ? "active" : "pending"}
          >
            {localizeProjectStatus(row.status, locale)}
          </StatusBadge>
        ),
      },
    ],
    [locale, t]
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      emptyMessage={t("pages.attendance.emptyTitle")}
    />
  );
}
