"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { formatDisplayTime } from "@/lib/format-date";
import { formatDistanceMeters } from "@/lib/geo";
import { useT } from "@/lib/i18n/use-t";

export type AttendanceCheckInRow = {
  id: string;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  checkInDistanceMeters: number | null;
  checkOutDistanceMeters: number | null;
  checkInPhotoUrl: string | null;
  note: string | null;
  isLate: boolean | null;
  shiftLabel: string;
  employee: { firstName: string; lastName: string; employeeNo: string };
  project: { name: string } | null;
};

type Props = {
  data: AttendanceCheckInRow[];
};

export default function AttendanceCheckInTable({ data }: Props) {
  const { t } = useT();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const columns: DataTableColumn<AttendanceCheckInRow>[] = useMemo(
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
        key: "project",
        title: t("pages.attendance.columns.project"),
        render: (row) => (
          <span className="text-muted">{row.project?.name ?? "-"}</span>
        ),
      },
      {
        key: "photo",
        title: t("pages.progress.columns.photos"),
        width: "5rem",
        align: "center",
        className: "min-w-[5rem] whitespace-nowrap",
        render: (row) =>
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
    <>
      <DataTable
        columns={columns}
        data={data}
        emptyMessage={t("pages.attendance.emptyTitle")}
      />
      <ImageLightbox
        open={lightboxSrc != null}
        onOpenChange={(open) => {
          if (!open) setLightboxSrc(null);
        }}
        src={lightboxSrc}
        alt={t("pages.cico.checkIn")}
      />
    </>
  );
}
