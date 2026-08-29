"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Camera, FolderKanban, Pencil, Users } from "lucide-react";

import ProgressDialog, {
  type EditableProgressReport,
} from "@/components/progress/ProgressDialog";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFormClass,
} from "@/components/employees/employee-dialog-ui";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DirectoryStatGrid from "@/components/ui/DirectoryStatGrid";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatDisplayTime } from "@/lib/format-date";
import { formatDateInput } from "@/lib/invoice-period";
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { todayDateInput } from "@/lib/project-contract";

export type ProgressDirectoryReport = {
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

export type ProgressDirectoryEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
  category: { name: string } | null;
  reports: ProgressDirectoryReport[];
};

export type ProgressDirectoryProject = {
  id: string;
  name: string;
  employees: ProgressDirectoryEmployee[];
};

type Props = {
  projects: ProgressDirectoryProject[];
  /** Current user's linked employee id (for author edit). */
  currentEmployeeId?: string | null;
  /** Author may edit their own report when Active. */
  canManage?: boolean;
  /** Clients / viewers / On Leave staff cannot edit. */
  canEdit?: boolean;
};

function reportDateInput(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return formatDateInput(date);
}

export default function ProgressReportDirectory({
  projects,
  currentEmployeeId = null,
  canManage = false,
  canEdit = true,
}: Props) {
  const { t, locale } = useT();
  const [viewReport, setViewReport] = useState<ProgressDirectoryReport | null>(
    null
  );
  const [editReport, setEditReport] = useState<EditableProgressReport | null>(
    null
  );
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const totalReports = useMemo(
    () =>
      projects.reduce(
        (sum, project) =>
          sum +
          project.employees.reduce(
            (inner, employee) => inner + employee.reports.length,
            0
          ),
        0
      ),
    [projects]
  );
  const totalEmployees = useMemo(
    () =>
      new Set(
        projects.flatMap((project) =>
          project.employees.map((employee) => employee.id)
        )
      ).size,
    [projects]
  );

  function mayEdit(report: ProgressDirectoryReport): boolean {
    if (!canEdit) return false;
    if (!(currentEmployeeId && report.employeeId === currentEmployeeId)) {
      return false;
    }
    // Author-only + same Jakarta calendar day as reportDate.
    return reportDateInput(report.reportDate) === todayDateInput();
  }

  function openEdit(report: ProgressDirectoryReport) {
    setViewReport(null);
    setEditReport({
      id: report.id,
      projectId: report.projectId,
      projectName: report.project.name,
      stageLabel: report.stageLabel,
      notes: report.notes,
      reportDate: reportDateInput(report.reportDate),
      photos: report.photos,
    });
  }

  if (projects.length === 0) {
    return null;
  }

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

  return (
    <>
      <DirectoryStatGrid className="mb-5">
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.progress.cards.projects")}
          value={projects.length}
          accent="info"
          icon={<FolderKanban size={18} />}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.progress.cards.employees")}
          value={totalEmployees}
          accent="success"
          icon={<Users size={18} />}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.progress.cards.reports")}
          value={totalReports}
          accent="warning"
          icon={<Camera size={18} />}
        />
      </DirectoryStatGrid>

      <div className="space-y-6">
        {projects.map((project) => {
          const reports = project.employees.flatMap((employee) => employee.reports);
          const columns: DataTableColumn<ProgressDirectoryReport>[] = [
            {
              key: "employee",
              title: t("pages.progress.columns.employee"),
              width: "12rem",
              share: 1.25,
              className: "min-w-[12rem]",
              render: (report) => (
                <div className="min-w-0">
                  <p className="font-semibold text-text">
                    {report.employee.firstName} {report.employee.lastName}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-subtle">
                    {report.employee.employeeNo}
                    {report.employee.category
                      ? ` · ${localizeDepartmentLabel(null, report.employee.category.name, locale)}`
                      : ""}
                  </p>
                </div>
              ),
            },
            {
              key: "serviceArea",
              title: t("pages.progress.columns.serviceArea"),
              width: "11rem",
              share: 1.1,
              className: "min-w-[11rem]",
              render: (report) => (
                <p className="min-w-0 text-text">
                  {report.stageLabel || t("pages.progress.untitledReport")}
                </p>
              ),
            },
            {
              key: "submittedAt",
              title: t("pages.progress.columns.submittedAt"),
              width: "9rem",
              share: 1,
              className: "min-w-[9rem] whitespace-nowrap",
              render: (report) => (
                <span className="text-muted">
                  {formatDisplayTime(report.createdAt)}
                </span>
              ),
            },
            {
              key: "photos",
              title: t("pages.progress.columns.photos"),
              width: "9rem",
              share: 1,
              cellAlign: "right",
              className: "min-w-[9rem] whitespace-nowrap",
              render: (report) => (
                <span className="text-lg font-semibold tabular-nums text-text">
                  {report.photos.length}
                </span>
              ),
            },
            {
              key: "actions",
              title: t("common.labels.actions"),
              width: "10rem",
              share: 1,
              cellAlign: "center",
              className: "min-w-[10rem] overflow-visible",
              render: (report) =>
                mayEdit(report) ? (
                  <Button
                    type="button"
                    size="badge"
                    variant="secondary"
                    className="gap-1"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEdit(report);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t("common.actions.edit")}
                  </Button>
                ) : null,
            },
          ];

          return (
            <section key={project.id} className="space-y-3">
              <div>
                <h3 className="text-base font-semibold text-text">
                  {project.name}{" "}
                  <span className="font-medium text-subtle">
                    ({reports.length})
                  </span>
                </h3>
                <p className="mt-0.5 text-sm text-subtle">
                  {t(
                    project.employees.length === 1
                      ? "pages.progress.assignedEmployeeOne"
                      : "pages.progress.assignedEmployeeOther",
                    { count: project.employees.length }
                  )}
                </p>
              </div>
              {reports.length === 0 ? (
                <p className="text-sm text-subtle">
                  {t("pages.progress.noReportsYet")}
                </p>
              ) : (
                <DataTable
                  columns={columns}
                  data={reports}
                  getRowKey={(report) => report.id}
                  onRowClick={setViewReport}
                  emptyMessage={t("pages.progress.noReportsYet")}
                />
              )}
            </section>
          );
        })}
      </div>

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
              <div className="flex w-full flex-wrap items-center justify-end gap-3">
                {mayEdit(viewReport) ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-1.5"
                    onClick={() => openEdit(viewReport)}
                  >
                    <Pencil className="h-4 w-4" />
                    {t("common.actions.edit")}
                  </Button>
                ) : null}
                <EmployeePrimaryButton
                  type="button"
                  onClick={() => setViewReport(null)}
                >
                  {t("common.actions.close")}
                </EmployeePrimaryButton>
              </div>
            }
          >
            <div className={employeeDialogFormClass}>
              {viewReport.stageLabel ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {t("pages.progress.serviceArea")}
                  </p>
                  <p className="mt-1 text-sm text-text">
                    {viewReport.stageLabel}
                  </p>
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
    </>
  );
}
