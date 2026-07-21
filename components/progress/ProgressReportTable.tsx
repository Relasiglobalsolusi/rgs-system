"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { toast } from "sonner";

import { reorderProgressReports } from "@/app/progress/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFormClass,
} from "@/components/employees/employee-dialog-ui";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import ImageLightbox from "@/components/ui/ImageLightbox";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatDisplayTime } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";

export type ProgressReportTableRow = {
  id: string;
  notes: string | null;
  stageLabel: string | null;
  createdAt: Date | string;
  project: { name: string };
  employee: {
    firstName: string;
    lastName: string;
    category: { name: string } | null;
  };
  photos: { id: string; url: string }[];
};

type Props = {
  reports: ProgressReportTableRow[];
  canReorder?: boolean;
};

export default function ProgressReportTable({
  reports,
  canReorder = false,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [viewReport, setViewReport] = useState<ProgressReportTableRow | null>(
    null
  );
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  function handleReorder(orderedIds: string[]) {
    if (!canReorder) return;
    startTransition(async () => {
      try {
        await reorderProgressReports(orderedIds);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("pages.progress.reorderFailed")
        );
        router.refresh();
      }
    });
  }

  const columns = useMemo(() => {
    const cols: DataTableColumn<ProgressReportTableRow>[] = [
      {
        key: "project",
        title: t("pages.progress.columns.project"),
        width: "12rem",
        share: 2,
        className: "min-w-[12rem]",
        render: (report) => (
          <div className="min-w-0">
            <p className="font-semibold text-text">{report.project.name}</p>
            {report.stageLabel ? (
              <p className="mt-0.5 text-sm text-subtle">
                {t("pages.progress.serviceAreaWithValue", {
                  area: report.stageLabel,
                })}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        key: "employee",
        title: t("pages.progress.columns.submittedBy"),
        width: "10rem",
        className: "min-w-[10rem]",
        render: (report) => {
          const name = `${report.employee.firstName} ${report.employee.lastName}`;
          const category = report.employee.category?.name;
          return (
            <div className="min-w-0">
              <p className="text-text">{name}</p>
              {category ? (
                <p className="mt-0.5 text-sm text-subtle">{category}</p>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "photos",
        title: t("pages.progress.columns.photos"),
        width: "6rem",
        align: "center",
        className: "min-w-[6rem] whitespace-nowrap",
        render: (report) => (
          <div className="flex items-center justify-center gap-2">
            {report.photos.length > 0 ? (
              <div className="relative h-9 w-9 overflow-hidden rounded-md border border-border bg-inset">
                <Image
                  src={report.photos[0].url}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <Camera className="h-4 w-4 text-muted" />
            )}
            <span className="tabular-nums text-muted">
              {report.photos.length}
            </span>
          </div>
        ),
      },
      {
        key: "time",
        title: t("pages.progress.columns.time"),
        width: "6rem",
        className: "min-w-[6rem] whitespace-nowrap",
        render: (report) => (
          <span className="text-subtle">
            {formatDisplayTime(report.createdAt)}
          </span>
        ),
      },
      {
        key: "status",
        title: t("common.labels.status"),
        width: "10rem",
        className: "min-w-[10rem] overflow-visible whitespace-nowrap text-center",
        render: () => (
          <StatusBadge status="success" compact>
            {t("pages.progress.submitted")}
          </StatusBadge>
        ),
      },
      {
        key: "actions",
        title: t("common.labels.actions"),
        width: "7rem",
        align: "center",
        className: "min-w-[7rem] whitespace-nowrap",
        render: (report) => (
          <div className="flex items-center justify-center whitespace-nowrap">
            <Button
              type="button"
              size="badge"
              variant="infoBadge"
              onClick={(event) => {
                event.stopPropagation();
                setViewReport(report);
              }}
            >
              {t("common.actions.view")}
            </Button>
          </div>
        ),
      },
    ];
    return cols;
  }, [t]);

  const employeeLabel = viewReport
    ? [
        `${viewReport.employee.firstName} ${viewReport.employee.lastName}`,
        viewReport.employee.category?.name,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const submittedLabel = viewReport
    ? `${formatDisplayTime(viewReport.createdAt)} · ${t(
        viewReport.photos.length === 1
          ? "pages.progress.photoCountOne"
          : "pages.progress.photoCountOther",
        { count: viewReport.photos.length }
      )}`
    : "";

  if (reports.length === 0) {
    return null;
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={reports}
        getRowKey={(report) => report.id}
        onRowClick={setViewReport}
        reorderable={canReorder}
        onReorder={canReorder ? handleReorder : undefined}
        emptyMessage={t("pages.progress.emptyForDate")}
      />

      <Dialog
        open={viewReport != null}
        onOpenChange={(open) => {
          if (!open) setViewReport(null);
        }}
      >
        {viewReport ? (
          <EmployeeDialogShell
            icon={Camera}
            title={viewReport.project.name}
            description={`${employeeLabel} · ${submittedLabel}`}
            maxWidth="lg"
            footer={
              <EmployeePrimaryButton
                type="button"
                onClick={() => setViewReport(null)}
              >
                {t("common.actions.close")}
              </EmployeePrimaryButton>
            }
          >
            <div className={employeeDialogFormClass}>
              {viewReport.stageLabel ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {t("pages.progress.serviceArea")}
                  </p>
                  <p className="mt-1 text-sm text-text">{viewReport.stageLabel}</p>
                </div>
              ) : null}

              {viewReport.notes ? (
                <p className="text-sm leading-6 text-muted">
                  {viewReport.notes}
                </p>
              ) : (
                <p className="text-sm text-subtle">
                  {t("pages.progress.noNotes")}
                </p>
              )}

              {viewReport.photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {viewReport.photos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setLightboxSrc(photo.url)}
                      className="relative aspect-square overflow-hidden rounded-xl border border-border bg-inset transition hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <Image
                        src={photo.url}
                        alt={t("pages.progress.progressPhoto")}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-muted">
                  <Camera size={18} />
                  {t("pages.progress.noPhotos")}
                </div>
              )}
            </div>
          </EmployeeDialogShell>
        ) : null}
      </Dialog>

      <ImageLightbox
        open={lightboxSrc != null}
        onOpenChange={(open) => {
          if (!open) setLightboxSrc(null);
        }}
        src={lightboxSrc}
        alt={t("pages.progress.progressPhoto")}
      />
    </>
  );
}
