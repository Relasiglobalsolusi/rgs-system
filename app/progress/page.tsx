import type { ProjectStatus, ProjectSubCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule, getEmployeeForUser, toPermissionUser } from "@/lib/session";
import {
  canManageProjects,
  getProjectWhereForUser,
} from "@/lib/project-access";
import { getOpenCicoProgressLock } from "@/lib/cico-attendance";
import {
  CLEANING_PROJECT_SUB_CATEGORIES,
} from "@/lib/project-subcategory";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { refreshLeaveEmploymentForUser } from "@/lib/leave-employment-status";

import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/ui/EmptyState";
import ProgressDialog from "@/components/progress/ProgressDialog";
import ProgressProjectFeed from "@/components/progress/ProgressProjectFeed";
import ProgressProjectPicker, {
  type ProgressProjectCard,
} from "@/components/progress/ProgressProjectPicker";
import ProgressReportDirectory, {
  type ProgressDirectoryProject,
} from "@/components/progress/ProgressReportDirectory";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{
    projectId?: string;
    employeeId?: string;
  }>;
}) {
  const session = await requireModule("progress");
  await refreshLeaveEmploymentForUser(session.user.id);
  const t = createTranslator(await getServerLocale());
  const { projectId, employeeId: employeeIdRaw } = await searchParams;
  const employeeIdFilter = employeeIdRaw?.trim() || undefined;

  const employee = await getEmployeeForUser(session.user.id);
  const permissionUser = toPermissionUser(session);
  const canManage = canManageProjects(permissionUser);
  const isClient = Boolean(session.user.clientId);
  const isViewerFeed = canManage || isClient;
  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
  });

  const activeStatuses: ProjectStatus[] = ["IN_PROGRESS"];
  const cleaningSubs: ProjectSubCategory[] = [
    ...CLEANING_PROJECT_SUB_CATEGORIES,
  ];
  const cleaningProjectFilter = {
    ...projectWhere,
    status: { in: activeStatuses },
    subCategory: { in: cleaningSubs },
  };

  const staffScope = Boolean(employee && !isViewerFeed);

  // ── Manager / Client: project picker or Instagram-style feed ─────────────
  if (isViewerFeed) {
    const projects = await prisma.project.findMany({
      where: cleaningProjectFilter,
      select: {
        id: true,
        name: true,
        sortOrder: true,
        progressReports: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            notes: true,
            photos: {
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { url: true },
            },
          },
        },
        _count: { select: { progressReports: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    if (projectId) {
      const project = projects.find((p) => p.id === projectId);
      if (!project) {
        return (
          <AppShell
            titleKey="pages.progress.title"
            descriptionKey="pages.progress.description"
          >
            <EmptyState
              titleKey="pages.progress.emptyTitle"
              descriptionKey="pages.progress.emptyDescription"
            />
          </AppShell>
        );
      }

      const [reports, assignees] = await Promise.all([
        prisma.progressReport.findMany({
          where: {
            projectId: project.id,
            ...(employeeIdFilter ? { employeeId: employeeIdFilter } : {}),
          },
          include: {
            photos: { orderBy: { createdAt: "asc" } },
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNo: true,
                category: { select: { name: true } },
              },
            },
            project: { select: { id: true, name: true } },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 100,
        }),
        prisma.projectAssignment.findMany({
          where: { projectId: project.id },
          select: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNo: true,
              },
            },
          },
          orderBy: [
            { employee: { firstName: "asc" } },
            { employee: { lastName: "asc" } },
          ],
        }),
      ]);

      // Include submitters who may no longer be assigned.
      const employeeMap = new Map(
        assignees.map((a) => [
          a.employee.id,
          {
            id: a.employee.id,
            firstName: a.employee.firstName,
            lastName: a.employee.lastName,
            employeeNo: a.employee.employeeNo,
          },
        ])
      );
      for (const report of reports) {
        if (!employeeMap.has(report.employeeId)) {
          employeeMap.set(report.employeeId, {
            id: report.employee.id,
            firstName: report.employee.firstName,
            lastName: report.employee.lastName,
            employeeNo: report.employee.employeeNo,
          });
        }
      }

      return (
        <AppShell
          titleKey="pages.progress.title"
          descriptionKey="pages.progress.feedDescription"
        >
          <ProgressProjectFeed
            project={{ id: project.id, name: project.name }}
            reports={reports}
            employees={Array.from(employeeMap.values())}
            selectedEmployeeId={employeeIdFilter}
            backHref="/progress"
            currentEmployeeId={null}
            canManage={false}
            canEdit={false}
          />
        </AppShell>
      );
    }

    const cards: ProgressProjectCard[] = projects.map((project) => ({
      id: project.id,
      name: project.name,
      reportCount: project._count.progressReports,
      latestPhotoUrl: project.progressReports[0]?.photos[0]?.url ?? null,
      latestNote: project.progressReports[0]?.notes ?? null,
    }));

    return (
      <AppShell
        titleKey="pages.progress.title"
        descriptionKey="pages.progress.feedDescription"
      >
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-text">
            {t("pages.progress.chooseProject")}
          </h2>
          <p className="mt-1 text-xs text-subtle">
            {t("pages.progress.chooseProjectHint")}
          </p>
        </div>
        {cards.length === 0 ? (
          <EmptyState
            titleKey="pages.progress.emptyTitle"
            descriptionKey="pages.progress.emptyDescription"
          />
        ) : (
          <ProgressProjectPicker projects={cards} />
        )}
      </AppShell>
    );
  }

  const directoryProjects = await prisma.project.findMany({
    where: {
      ...cleaningProjectFilter,
      ...(staffScope
        ? { assignments: { some: { employeeId: employee!.id } } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      assignments: {
        where: staffScope ? { employeeId: employee!.id } : undefined,
        select: {
          employeeId: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNo: true,
              category: { select: { name: true } },
            },
          },
        },
      },
      progressReports: {
        where: staffScope ? { employeeId: employee!.id } : undefined,
        include: {
          photos: { orderBy: { createdAt: "asc" } },
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNo: true,
              category: { select: { name: true } },
            },
          },
          project: { select: { id: true, name: true } },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 50,
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const assignedCleaningProjects = directoryProjects.map((project) => ({
    id: project.id,
    name: project.name,
  }));

  const openCicoLock = employee
    ? await getOpenCicoProgressLock(employee.id)
    : null;

  const openCicoAssigned = openCicoLock
    ? assignedCleaningProjects.find((p) => p.id === openCicoLock.projectId)
    : null;
  const openCicoProject =
    openCicoLock && openCicoAssigned
      ? {
          id: openCicoLock.projectId,
          name: openCicoAssigned.name,
          workDate: openCicoLock.workDate,
        }
      : null;

  const canSubmit =
    Boolean(employee) &&
    !isClient &&
    employee?.status === "ACTIVE" &&
    Boolean(openCicoProject) &&
    employee?.placement === "ON_PROJECT";
  const showCheckInRequired =
    Boolean(employee) &&
    !isClient &&
    employee?.status === "ACTIVE" &&
    assignedCleaningProjects.length > 0 &&
    employee?.placement === "ON_PROJECT" &&
    !openCicoProject;
  // Clients + managers: view feed only. Active staff submit/edit their own reports.
  const canEditReports =
    !isViewerFeed && employee?.status === "ACTIVE";

  const grouped: ProgressDirectoryProject[] = directoryProjects.map(
    (project) => {
      const reportsByEmployee = new Map<
        string,
        (typeof project.progressReports)[number][]
      >();
      for (const report of project.progressReports) {
        const list = reportsByEmployee.get(report.employeeId) ?? [];
        list.push(report);
        reportsByEmployee.set(report.employeeId, list);
      }

      const employees = project.assignments.map((assignment) => {
        const reports = reportsByEmployee.get(assignment.employeeId) ?? [];
        return {
          id: assignment.employee.id,
          firstName: assignment.employee.firstName,
          lastName: assignment.employee.lastName,
          employeeNo: assignment.employee.employeeNo,
          category: assignment.employee.category,
          missing: false,
          reports: reports.map((report) => ({
            id: report.id,
            notes: report.notes,
            stageLabel: report.stageLabel,
            reportDate: report.reportDate,
            createdAt: report.createdAt,
            employeeId: report.employeeId,
            projectId: report.projectId,
            project: report.project,
            employee: report.employee,
            photos: report.photos,
          })),
        };
      });

      return {
        id: project.id,
        name: project.name,
        employees,
      };
    }
  );

  return (
    <AppShell
      titleKey="pages.progress.title"
      descriptionKey="pages.progress.description"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">
            {t("pages.progress.myReportsTitle")}
          </h2>
          <p className="mt-1 text-xs text-subtle">
            {employee?.status === "ON_LEAVE"
              ? t("pages.progress.onLeaveMessage")
              : showCheckInRequired
                ? t("pages.progress.checkInRequiredMessage")
                : t("pages.progress.myReportsHint")}
          </p>
        </div>
        {canSubmit && openCicoProject ? (
          <ProgressDialog
            projects={[
              { id: openCicoProject.id, name: openCicoProject.name },
            ]}
            defaultDate={openCicoProject.workDate}
            defaultProjectId={openCicoProject.id}
            openCicoLock={{
              projectId: openCicoProject.id,
              workDate: openCicoProject.workDate,
            }}
            triggerLabel={t("pages.progress.submitReport")}
          />
        ) : null}
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          titleKey="pages.progress.emptyTitle"
          descriptionKey="pages.progress.emptyDescription"
        />
      ) : (
        <ProgressReportDirectory
          projects={grouped}
          currentEmployeeId={employee?.id ?? null}
          canManage={false}
          canEdit={canEditReports}
        />
      )}
    </AppShell>
  );
}
