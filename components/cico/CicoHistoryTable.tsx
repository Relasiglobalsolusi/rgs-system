"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { formatDisplayDate, formatDisplayTime } from "@/lib/format-date";
import { formatDistanceMeters } from "@/lib/geo";
import { useT } from "@/lib/i18n/use-t";

export type CicoHistoryRow = {
  id: string;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  checkInDistanceMeters: number | null;
  checkOutDistanceMeters: number | null;
  checkInPhotoUrl: string | null;
  note: string | null;
  project: {
    name: string;
  } | null;
};

type Props = {
  data: CicoHistoryRow[];
};

export default function CicoHistoryTable({ data }: Props) {
  const { t } = useT();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const columns: DataTableColumn<CicoHistoryRow>[] = useMemo(
    () => [
      {
        key: "date",
        title: t("common.labels.date"),
        width: "8rem",
        className: "min-w-[8rem] whitespace-nowrap",
        render: (row) => (
          <span className="text-muted">{formatDisplayDate(row.date)}</span>
        ),
      },
      {
        key: "project",
        title: t("pages.cico.columns.project"),
        render: (row) => (
          <p className="min-w-0 text-muted">{row.project?.name ?? "-"}</p>
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
        key: "checkIn",
        title: t("pages.cico.columns.checkIn"),
        width: "8rem",
        className: "min-w-[8rem] whitespace-nowrap",
        render: (row) => (
          <div>
            <span className="text-emerald-400">
              {row.checkIn ? formatDisplayTime(row.checkIn) : "-"}
            </span>
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
        title: t("pages.cico.columns.checkOut"),
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
        emptyMessage={t("pages.cico.noHistory")}
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
