import type { ProjectStatus, ProjectSubCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, getEmployeeForUser, toPermissionUser } from "@/lib/session";
import { canManageProjects } from "@/lib/project-access";
import {
  formatDateInput,
  parseDateInput,
} from "@/lib/invoice-period";
import {
  getMissingProgressReportsForEmployee,
  getStaffMissingReportsForDate,
  formatAppDateInput,
} from "@/lib/progress-report-compliance";
import {
  CLEANING_PROJECT_SUB_CATEGORIES,
  isProjectSubCategory,
} from "@/lib/project-subcategory";
import { formatDisplayDate } from "@/lib/format-date";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";

import AppShell from "@/components/layout/AppShell";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import ProgressDialog from "@/components/progress/ProgressDialog";
import ProgressDateFilters from "@/components/progress/ProgressDateFilters";
import ProgressReportTable from "@/components/progress/ProgressReportTable";
import MissingReportsWarning from "@/components/progress/MissingReportsWarning";
import { AlertTriangle } from "lucide-react";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    projectId?: string;
    subCategory?: string;
  }>;
}) {
  const session = await requireSession();
  const t = createTranslator(await getServerLocale());
  const { date: dateRaw, projectId, subCategory: subCategoryRaw } =
    await searchParams;
  const subCategory =
    subCategoryRaw && isProjectSubCategory(subCategoryRaw)
      ? subCategoryRaw
      : undefined;
  const employee = await getEmployeeForUser(session.user.id);
  const canManage = canManageProjects(toPermissionUser(session));

  const todayInput = formatAppDateInput(new Date());
  let selectedDate = todayInput;
  try {
    if (dateRaw) selectedDate = formatDateInput(parseDateInput(dateRaw));
  } catch {
    selectedDate = todayInput;
  }
  const reportDate = parseDateInput(selectedDate);

  const activeStatuses: ProjectStatus[] = ["IN_PROGRESS"];
  const cleaningSubs: ProjectSubCategory[] = [
    ...CLEANING_PROJECT_SUB_CATEGORIES,
  ];
  const cleaningProjectFilter = {
    companyId: session.user.companyId,
    status: { in: activeStatuses },
    subCategory: { in: cleaningSubs },
    ...(session.user.clientId ? { clientId: session.user.clientId } : {}),
  };

  const [
    reports,
    filterProjects,
    assignedCleaningProjects,
    staffMissing,
    myWarnings,
  ] = await Promise.all([
    prisma.progressReport.findMany({
      where: {
        reportDate,
        ...(projectId ? { projectId } : {}),
        project: {
          companyId: session.user.companyId,
          subCategory: subCategory ?? { in: cleaningSubs },
          ...(session.user.clientId
            ? { clientId: session.user.clientId }
            : {}),
        },
      },
      include: {
        project: { select: { id: true, name: true } },
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNo: true,
            category: { select: { name: true } },
          },
        },
        photos: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    // Admin: all active cleaning projects for filtering. Staff: assigned only.
    prisma.project.findMany({
      where: {
        ...cleaningProjectFilter,
        ...(employee && !canManage
          ? { assignments: { some: { employeeId: employee.id } } }
          : {}),
      },
      select: { id: true, name: true, subCategory: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    // Submit dropdown: only cleaning projects the signed-in employee is assigned to.
    employee
      ? prisma.project.findMany({
          where: {
            ...cleaningProjectFilter,
            assignments: { some: { employeeId: employee.id } },
          },
          select: { id: true, name: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    canManage
      ? getStaffMissingReportsForDate(session.user.companyId, selectedDate)
      : Promise.resolve({ date: selectedDate, missing: [] }),
    employee
      ? getMissingProgressReportsForEmployee(employee.id, session.user.id)
      : Promise.resolve([]),
  ]);

  const missingOnSelectedDate = myWarnings
    .filter((w) => w.date === selectedDate)
    .map((w) => ({ id: w.projectId, name: w.projectName }));

  const dateLabel = formatDisplayDate(reportDate, { timeZone: "UTC" });

  const canSubmit = Boolean(employee) && assignedCleaningProjects.length > 0;

  return (
    <AppShell
      titleKey="pages.progress.title"
      descriptionKey="pages.progress.description"
    >
      {myWarnings.length > 0 && (
        <MissingReportsWarning warnings={myWarnings} />
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">
            {t("pages.progress.reportsForDate", { date: dateLabel })}
          </h2>
          <p className="mt-1 text-xs text-subtle">
            {t(
              reports.length === 1
                ? "pages.progress.submittedCountOne"
                : "pages.progress.submittedCountOther",
              { count: reports.length }
            )}
            {canManage ? t("pages.progress.missingUploadChecksNote") : ""}
          </p>
        </div>
        {canSubmit ? (
          <ProgressDialog
            projects={assignedCleaningProjects}
            defaultDate={selectedDate}
            triggerLabel={t("pages.progress.submitReport")}
          />
        ) : null}
      </div>

      <ProgressDateFilters
        date={selectedDate}
        projectId={projectId}
        subCategory={subCategory}
        projects={filterProjects}
      />

      {canManage && staffMissing.missing.length > 0 && (
        <SectionCard className="mb-6 border-amber-500/25 bg-card-tint-amber">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-amber-200">
                {t(
                  staffMissing.missing.length === 1
                    ? "pages.progress.missingUploadsTitleOne"
                    : "pages.progress.missingUploadsTitleOther",
                  { count: staffMissing.missing.length }
                )}
              </p>
              <p className="mt-1 text-sm text-subtle">
                {t("pages.progress.missingReportMessage")}
              </p>
              <ul className="mt-3 space-y-2">
                {staffMissing.missing.map((row) => (
                  <li
                    key={row.employee.id}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <StatusBadge status="warning" compact>
                      {t("pages.progress.missingBadge")}
                    </StatusBadge>
                    <span className="font-medium text-text">
                      {row.employee.firstName} {row.employee.lastName}
                    </span>
                    <span className="text-subtle">
                      ({row.employee.employeeNo}
                      {row.employee.category
                        ? ` · ${row.employee.category.name}`
                        : ""}
                      )
                    </span>
                    <span className="text-amber-200/90">
                      — {row.missingProjects.map((p) => p.name).join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>
      )}

      {employee && missingOnSelectedDate.length > 0 && (
        <SectionCard className="mb-6 border-amber-500/25 bg-card-tint-amber">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="font-medium text-amber-200">
                  {selectedDate === todayInput
                    ? t("pages.progress.needToReportToday")
                    : t("pages.progress.noReportOnDate", { date: dateLabel })}
                </p>
                <p className="mt-1 text-sm text-subtle">
                  {t("pages.progress.missingProjectsPrefix")}{" "}
                  {missingOnSelectedDate.map((p) => p.name).join(", ")}
                </p>
              </div>
            </div>
            <ProgressDialog
              projects={missingOnSelectedDate}
              defaultDate={selectedDate}
              defaultProjectId={missingOnSelectedDate[0]?.id}
              triggerLabel={t("pages.progress.uploadNow")}
              compact
            />
          </div>
        </SectionCard>
      )}

      {reports.length === 0 ? (
        <EmptyState
          titleKey="pages.progress.emptyTitle"
          descriptionKey="pages.progress.emptyDescription"
        />
      ) : (
        <ProgressReportTable
          reports={reports}
          canReorder={canManage}
        />
      )}
    </AppShell>
  );
}
