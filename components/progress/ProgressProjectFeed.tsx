"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Pencil } from "lucide-react";

import ProgressDialog, {
  type EditableProgressReport,
} from "@/components/progress/ProgressDialog";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDisplayDate, formatDisplayTime } from "@/lib/format-date";
import { formatDateInput } from "@/lib/invoice-period";
import { useT } from "@/lib/i18n/use-t";

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

type Props = {
  project: { id: string; name: string };
  reports: FeedReport[];
  employees: FeedEmployeeOption[];
  selectedEmployeeId?: string;
  backHref: string;
  currentEmployeeId?: string | null;
  canManage?: boolean;
  canEdit?: boolean;
};

function toDateInput(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return formatDateInput(date);
}

export default function ProgressProjectFeed({
  project,
  reports,
  employees,
  selectedEmployeeId,
  backHref,
  currentEmployeeId = null,
  canManage = false,
  canEdit = true,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [editReport, setEditReport] = useState<EditableProgressReport | null>(
    null
  );

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

  function mayEdit(report: FeedReport): boolean {
    if (!canEdit) return false;
    if (canManage) return true;
    return Boolean(currentEmployeeId && report.employeeId === currentEmployeeId);
  }

  function onEmployeeFilter(value: string | null) {
    const next = value && value !== "all" ? value : "";
    const params = new URLSearchParams();
    params.set("projectId", project.id);
    if (next) params.set("employeeId", next);
    router.push(`/progress?${params.toString()}`);
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

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
            {t(
              reports.length === 1
                ? "pages.progress.feedReportCountOne"
                : "pages.progress.feedReportCountOther",
              { count: reports.length }
            )}
          </p>
        </div>
      </div>

      {employees.length > 0 ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-text">
            {t("pages.progress.filterByEmployee")}
          </label>
          <Select
            value={selectedEmployeeId || "all"}
            onValueChange={onEmployeeFilter}
            items={employeeItems}
          >
            <SelectTrigger className="h-11 w-full max-w-sm">
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

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-subtle">
          {t("pages.progress.feedEmpty")}
        </div>
      ) : (
        <div className="space-y-6">
          {reports.map((report) => {
            const name = `${report.employee.firstName} ${report.employee.lastName}`;
            const dateLabel = formatDisplayDate(report.reportDate, {
              timeZone: "UTC",
            });
            return (
              <article
                key={report.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <header className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text">{name}</p>
                    <p className="mt-0.5 text-xs text-subtle">
                      {report.employee.employeeNo}
                      {report.employee.category
                        ? ` · ${report.employee.category.name}`
                        : ""}
                      {" · "}
                      {dateLabel}
                      {" · "}
                      {formatDisplayTime(report.createdAt)}
                    </p>
                  </div>
                  {mayEdit(report) ? (
                    <Button
                      type="button"
                      size="badge"
                      variant="secondary"
                      className="shrink-0 gap-1"
                      onClick={() => openEdit(report)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t("common.actions.edit")}
                    </Button>
                  ) : null}
                </header>

                {report.photos.length > 0 ? (
                  <div
                    className={
                      report.photos.length === 1
                        ? "relative aspect-square w-full bg-inset"
                        : "grid grid-cols-2 gap-0.5 bg-inset"
                    }
                  >
                    {report.photos.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setLightboxSrc(photo.url)}
                        className={
                          report.photos.length === 1
                            ? "relative h-full w-full"
                            : "relative aspect-square"
                        }
                      >
                        <Image
                          src={photo.url}
                          alt={t("pages.progress.progressPhoto")}
                          fill
                          className="object-cover"
                          unoptimized
                          priority={index === 0}
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center gap-2 bg-inset text-muted">
                    <Camera className="h-5 w-5" />
                    {t("pages.progress.noPhotos")}
                  </div>
                )}

                <div className="space-y-2 px-4 py-3">
                  {report.stageLabel ? (
                    <p className="text-sm font-medium text-text">
                      {report.stageLabel}
                    </p>
                  ) : null}
                  {report.notes ? (
                    <p className="text-sm leading-6 text-muted">
                      <span className="font-semibold text-text">{name} </span>
                      {report.notes}
                    </p>
                  ) : (
                    <p className="text-sm text-subtle">
                      {t("pages.progress.noNotes")}
                    </p>
                  )}
                  <p className="text-xs text-subtle">
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
          })}
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
