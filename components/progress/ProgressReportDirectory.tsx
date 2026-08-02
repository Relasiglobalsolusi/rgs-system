"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Camera, ChevronDown, ChevronRight, Pencil } from "lucide-react";

import ProgressDialog, {
  type EditableProgressReport,
} from "@/components/progress/ProgressDialog";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFormClass,
} from "@/components/employees/employee-dialog-ui";
import ImageLightbox from "@/components/ui/ImageLightbox";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatDisplayTime } from "@/lib/format-date";
import { formatDateInput } from "@/lib/invoice-period";
import { useT } from "@/lib/i18n/use-t";

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
  missing: boolean;
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
  /** Managers may edit any in-company report. */
  canManage?: boolean;
  /** Clients / viewers cannot edit. */
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
  const { t } = useT();
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () => new Set(projects.map((p) => p.id))
  );
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(
    () =>
      new Set(
        projects.flatMap((p) =>
          p.employees.map((e) => `${p.id}:${e.id}`)
        )
      )
  );
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

  function toggleProject(projectId: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function toggleEmployee(key: string) {
    setExpandedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function mayEdit(report: ProgressDirectoryReport): boolean {
    if (!canEdit) return false;
    if (canManage) return true;
    return Boolean(currentEmployeeId && report.employeeId === currentEmployeeId);
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
      <div className="mb-3 text-xs text-subtle">
        {t(
          totalReports === 1
            ? "pages.progress.submittedCountOne"
            : "pages.progress.submittedCountOther",
          { count: totalReports }
        )}
        {" · "}
        {t("pages.progress.directoryHint")}
      </div>

      <div className="space-y-4">
        {projects.map((project) => {
          const projectOpen = expandedProjects.has(project.id);
          const reportCount = project.employees.reduce(
            (sum, e) => sum + e.reports.length,
            0
          );
          const missingCount = project.employees.filter((e) => e.missing).length;

          return (
            <SectionCard key={project.id} className="!p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleProject(project.id)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-elevated/60 sm:px-6"
              >
                {projectOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text">{project.name}</p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {t(
                      project.employees.length === 1
                        ? "pages.progress.assignedEmployeeOne"
                        : "pages.progress.assignedEmployeeOther",
                      { count: project.employees.length }
                    )}
                    {" · "}
                    {t(
                      reportCount === 1
                        ? "pages.progress.submittedCountOne"
                        : "pages.progress.submittedCountOther",
                      { count: reportCount }
                    )}
                    {missingCount > 0
                      ? ` · ${t("pages.progress.missingEmployeeCount", {
                          count: missingCount,
                        })}`
                      : ""}
                  </p>
                </div>
              </button>

              {projectOpen ? (
                <div className="space-y-2 border-t border-border px-3 pb-4 pt-2 sm:px-4">
                  {project.employees.map((employee) => {
                    const empKey = `${project.id}:${employee.id}`;
                    const empOpen = expandedEmployees.has(empKey);
                    const name = `${employee.firstName} ${employee.lastName}`;

                    return (
                      <div
                        key={empKey}
                        className="rounded-xl border border-border bg-elevated/40"
                      >
                        <button
                          type="button"
                          onClick={() => toggleEmployee(empKey)}
                          className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-elevated/80 sm:px-4"
                        >
                          {empOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-text">
                              {name}
                            </p>
                            <p className="mt-0.5 text-xs text-subtle">
                              {employee.employeeNo}
                              {employee.category
                                ? ` · ${employee.category.name}`
                                : ""}
                              {" · "}
                              {t(
                                employee.reports.length === 1
                                  ? "pages.progress.reportCountOne"
                                  : "pages.progress.reportCountOther",
                                { count: employee.reports.length }
                              )}
                            </p>
                          </div>
                          {employee.missing ? (
                            <StatusBadge status="warning" compact>
                              {t("pages.progress.missingBadge")}
                            </StatusBadge>
                          ) : employee.reports.length > 0 ? (
                            <StatusBadge status="success" compact>
                              {t("pages.progress.submitted")}
                            </StatusBadge>
                          ) : null}
                        </button>

                        {empOpen ? (
                          <div className="space-y-2 border-t border-border px-3 py-3 sm:px-4">
                            {employee.reports.length === 0 ? (
                              <p className="px-1 py-2 text-sm text-subtle">
                                {employee.missing
                                  ? t("pages.progress.noReportsAfterShift")
                                  : t("pages.progress.noReportsYet")}
                              </p>
                            ) : (
                              employee.reports.map((report) => (
                                <div
                                  key={report.id}
                                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => setViewReport(report)}
                                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                  >
                                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-inset">
                                      {report.photos[0] ? (
                                        <Image
                                          src={report.photos[0].url}
                                          alt=""
                                          fill
                                          className="object-cover"
                                          unoptimized
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                          <Camera className="h-4 w-4 text-muted" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-text">
                                        {report.stageLabel ||
                                          t("pages.progress.untitledReport")}
                                      </p>
                                      <p className="mt-0.5 text-xs text-subtle">
                                        {formatDisplayTime(report.createdAt)}
                                        {" · "}
                                        {t(
                                          report.photos.length === 1
                                            ? "pages.progress.photoCountOne"
                                            : "pages.progress.photoCountOther",
                                          { count: report.photos.length }
                                        )}
                                      </p>
                                    </div>
                                  </button>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <Button
                                      type="button"
                                      size="badge"
                                      variant="infoBadge"
                                      onClick={() => setViewReport(report)}
                                    >
                                      {t("common.actions.view")}
                                    </Button>
                                    {mayEdit(report) ? (
                                      <Button
                                        type="button"
                                        size="badge"
                                        variant="secondary"
                                        className="gap-1"
                                        onClick={() => openEdit(report)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        {t("common.actions.edit")}
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </SectionCard>
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
              <div className="flex w-full flex-wrap items-center justify-end gap-2">
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
