import type { ProjectSubCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  getEmployeeForUser,
  toPermissionUser,
} from "@/lib/session";
import { formatDisplayTime } from "@/lib/format-date";
import {
  formatTimeRange,
  isLateCheckIn,
  resolveExpectedShiftStart,
} from "@/lib/operating-hours";
import {
  formatDateInput,
  parseDateInput,
  toUtcDateOnly,
} from "@/lib/invoice-period";
import { getCicoDaySessions, getCicoWorkAttendance } from "@/lib/cico-attendance";
import { formatAppDateInput } from "@/lib/progress-report-compliance";
import { FIELD_CICO_ELIGIBLE_PROJECT_SUB_CATEGORIES } from "@/lib/project-subcategory";
import { PROJECT_SITE_WORK_STATUSES } from "@/lib/project-status";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { refreshLeaveEmploymentForUser } from "@/lib/leave-employment-status";
import { releaseExpiredBackupCrew } from "@/lib/workforce-crew";
import {
  canViewCicoAdminPreview,
  canUseCicoAdminFieldPreview,
  canUseOfficeCico,
  isCicoFieldEligible,
  isCicoOperationalEligible,
  requiresCicoProgressReport,
} from "@/lib/cico-access";
import { isBackupAssignmentActiveOnJakartaDay } from "@/lib/petty-cash";
import { internalHomeSiteToProjectName } from "@/lib/office-cico";
import type { AttendanceCheckInRow } from "@/components/attendance/AttendanceCheckInTable";

import AppShell from "@/components/layout/AppShell";
import SectionCard from "@/components/ui/SectionCard";
import CicoActions from "@/components/cico/CicoActions";
import CicoHistoryTable from "@/components/cico/CicoHistoryTable";
import CicoAdminPreview from "@/components/cico/CicoAdminPreview";

export default async function CicoPage() {
  const session = await requireModule("cico");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const permissionUser = toPermissionUser(session);

  // Client portal accounts never use CICO (employees only), even if overridden on.
  if (session.user.clientId) {
    return (
      <AppShell
        titleKey="pages.cico.title"
      >
        <SectionCard>
          <p className="text-subtle">{t("pages.cico.employeeOnly")}</p>
        </SectionCard>
      </AppShell>
    );
  }

  await refreshLeaveEmploymentForUser(session.user.id);
  if (session.user.companyId) {
    await releaseExpiredBackupCrew(prisma as never, session.user.companyId);
  }
  const employee = await getEmployeeForUser(session.user.id);

  if (canViewCicoAdminPreview(permissionUser, employee)) {
    const companyId = session.user.companyId;
    const todayInput = formatDateInput(toUtcDateOnly(new Date()));
    const reportDate = parseDateInput(todayInput);
    const fieldCicoSubs: ProjectSubCategory[] = [
      ...FIELD_CICO_ELIGIBLE_PROJECT_SUB_CATEGORIES,
    ];
    const adminFieldMode = canUseCicoAdminFieldPreview(permissionUser);

    const inProgressWithLocation = {
      companyId,
      status: { in: [...PROJECT_SITE_WORK_STATUSES] },
      latitude: { not: null },
      longitude: { not: null },
    };

    const [dayAttendance, assignmentShifts, previewAssignment, cleaningProjects, fallbackProjects] =
      await Promise.all([
        prisma.attendance.findMany({
          where: {
            date: reportDate,
            employee: { companyId },
          },
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeNo: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [{ checkIn: "asc" }, { employee: { firstName: "asc" } }],
        }),
        prisma.projectAssignment.findMany({
          where: {
            project: { companyId },
          },
          select: {
            employeeId: true,
            projectId: true,
            shiftStart: true,
            shiftEnd: true,
          },
        }),
        adminFieldMode
          ? Promise.resolve(null)
          : prisma.projectAssignment.findFirst({
              where: {
                project: {
                  ...inProgressWithLocation,
                  subCategory: { in: fieldCicoSubs },
                },
              },
              include: {
                project: {
                  select: {
                    id: true,
                    name: true,
                    location: true,
                    locationRadiusMeters: true,
                  },
                },
              },
              orderBy: { project: { name: "asc" } },
            }),
        adminFieldMode
          ? prisma.project.findMany({
              where: {
                ...inProgressWithLocation,
                subCategory: { in: fieldCicoSubs },
              },
              select: {
                id: true,
                name: true,
                location: true,
                locationRadiusMeters: true,
              },
              orderBy: { name: "asc" },
            })
          : Promise.resolve([]),
        adminFieldMode
          ? prisma.project.findMany({
              where: inProgressWithLocation,
              select: {
                id: true,
                name: true,
                location: true,
                locationRadiusMeters: true,
              },
              orderBy: { name: "asc" },
            })
          : Promise.resolve([]),
      ]);

    const adminProjects =
      adminFieldMode && cleaningProjects.length > 0
        ? cleaningProjects
        : adminFieldMode
          ? fallbackProjects
          : [];

    const adminTodayRecordPromise =
      adminFieldMode && employee
        ? getCicoWorkAttendance(employee.id)
        : Promise.resolve(null);
    const adminTodaySessionsPromise =
      adminFieldMode && employee
        ? getCicoDaySessions(employee.id)
        : Promise.resolve([]);

    const [adminTodayRecord, adminTodaySessions] = await Promise.all([
      adminTodayRecordPromise,
      adminTodaySessionsPromise,
    ]);

    const adminWorkDate = adminTodayRecord?.date
      ? formatDateInput(toUtcDateOnly(adminTodayRecord.date))
      : todayInput;

    const adminRequiresProgress = requiresCicoProgressReport(employee);

    const progressCount =
      adminFieldMode &&
      adminRequiresProgress &&
      employee &&
      adminTodayRecord?.projectId &&
      adminTodayRecord.checkIn &&
      !adminTodayRecord.checkOut
        ? await prisma.progressReport.count({
            where: {
              employeeId: employee.id,
              projectId: adminTodayRecord.projectId,
              reportDate: toUtcDateOnly(adminTodayRecord.date),
            },
          })
        : 0;

    const hasProgressReport =
      !adminRequiresProgress || progressCount > 0;

    const shiftKey = (employeeId: string, projectIdValue: string | null) =>
      `${employeeId}:${projectIdValue ?? ""}`;

    const shiftMap = new Map(
      assignmentShifts.map((assignment) => [
        shiftKey(assignment.employeeId, assignment.projectId),
        assignment,
      ])
    );

    const attendanceRows: AttendanceCheckInRow[] = dayAttendance.map((row) => {
      const assignment = row.project
        ? shiftMap.get(shiftKey(row.employeeId, row.project.id))
        : undefined;
      const expected = resolveExpectedShiftStart(assignment);
      const isLate =
        row.checkIn != null ? isLateCheckIn(row.checkIn, expected) : null;

      return {
        id: row.id,
        date: row.date,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        checkInDistanceMeters: row.checkInDistanceMeters,
        checkOutDistanceMeters: row.checkOutDistanceMeters,
        checkInPhotoUrl: row.checkInPhotoUrl,
        note: row.note,
        isLate,
        shiftLabel: formatTimeRange(
          assignment?.shiftStart ?? null,
          assignment?.shiftEnd ?? null
        ),
        employee: row.employee,
        project: row.project ? { name: row.project.name } : null,
      };
    });

    const openCheckInCount = attendanceRows.filter(
      (row) => row.checkIn && !row.checkOut
    ).length;

    const previewProject = previewAssignment
      ? {
          id: previewAssignment.project.id,
          name: previewAssignment.project.name,
          location: previewAssignment.project.location,
          locationRadiusMeters: previewAssignment.project.locationRadiusMeters,
          shiftStart: previewAssignment.shiftStart,
          shiftEnd: previewAssignment.shiftEnd,
        }
      : null;

    const selectableProjects = adminProjects.map((project) => ({
      id: project.id,
      name: project.name,
      location: project.location,
      locationRadiusMeters: project.locationRadiusMeters,
      shiftStart: null as string | null,
      shiftEnd: null as string | null,
    }));

    return (
      <AppShell
        titleKey="pages.cico.title"
      >
        <CicoAdminPreview
          attendanceRows={attendanceRows}
          openCheckInCount={openCheckInCount}
          previewProject={previewProject}
          workDate={adminWorkDate}
          adminFieldMode={adminFieldMode}
          selectableProjects={selectableProjects}
          todayRecord={adminTodayRecord}
          todaySessions={adminTodaySessions}
          hasProgressReport={hasProgressReport}
          requiresProgress={adminRequiresProgress}
          hasEmployeeProfile={!!employee}
        />
      </AppShell>
    );
  }

  if (!employee) {
    return (
      <AppShell
        titleKey="pages.cico.title"
      >
        <SectionCard>
          <p className="text-subtle">{t("pages.cico.noEmployeeProfile")}</p>
        </SectionCard>
      </AppShell>
    );
  }

  if (!isCicoOperationalEligible(employee)) {
    if (employee.archivedFromDirectory || employee.status !== "ACTIVE") {
      return (
        <AppShell
          titleKey="pages.cico.title"
        >
          <div className="mx-auto w-full max-w-2xl">
            <SectionCard>
              <p className="text-center text-subtle">
                {t("pages.cico.activeOnlyMessage")}
              </p>
            </SectionCard>
          </div>
        </AppShell>
      );
    }

    return (
      <AppShell
        titleKey="pages.cico.title"
      >
        <div className="mx-auto w-full max-w-2xl">
          <SectionCard>
            <p className="text-center text-subtle">
              {t("pages.cico.onProjectOnlyMessage")}
            </p>
          </SectionCard>
        </div>
      </AppShell>
    );
  }

  const fieldCicoSubs: ProjectSubCategory[] = [
    ...FIELD_CICO_ELIGIBLE_PROJECT_SUB_CATEGORIES,
  ];
  const officeMode =
    canUseOfficeCico(employee) && !isCicoFieldEligible(employee);
  const homeSiteName = officeMode
    ? internalHomeSiteToProjectName(employee.internalHomeSite)
    : null;

  const [todayRecord, todaySessions, assignments, officeProjects, history] = await Promise.all([
    getCicoWorkAttendance(employee.id),
    getCicoDaySessions(employee.id),
    prisma.projectAssignment.findMany({
      where: {
        employeeId: employee.id,
        project: {
          status: { in: [...PROJECT_SITE_WORK_STATUSES] },
          subCategory: { in: fieldCicoSubs },
          latitude: { not: null },
          longitude: { not: null },
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            location: true,
            locationRadiusMeters: true,
            subCategory: true,
          },
        },
      },
      orderBy: { project: { name: "asc" } },
    }),
    officeMode && homeSiteName
      ? prisma.project.findMany({
          where: {
            companyId: session.user.companyId,
            status: { in: [...PROJECT_SITE_WORK_STATUSES] },
            name: homeSiteName,
            latitude: { not: null },
            longitude: { not: null },
          },
          select: {
            id: true,
            name: true,
            location: true,
            locationRadiusMeters: true,
            subCategory: true,
          },
          take: 1,
        })
      : Promise.resolve([]),
    prisma.attendance.findMany({
      where: { employeeId: employee.id },
      include: {
        project: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ date: "desc" }, { checkIn: "desc" }],
      take: 60,
    }),
  ]);

  const workDate = todayRecord?.date
    ? formatDateInput(toUtcDateOnly(todayRecord.date))
    : formatAppDateInput();

  const requiresProgress = requiresCicoProgressReport(employee);

  const progressCount =
    requiresProgress &&
    todayRecord?.projectId &&
    todayRecord.checkIn &&
    !todayRecord.checkOut
      ? await prisma.progressReport.count({
          where: {
            employeeId: employee.id,
            projectId: todayRecord.projectId,
            reportDate: toUtcDateOnly(todayRecord.date),
          },
        })
      : 0;

  const hasProgressReport = !requiresProgress || progressCount > 0;

  const assignedProjects =
    assignments.length > 0
      ? assignments
          .filter((assignment) =>
            isBackupAssignmentActiveOnJakartaDay(assignment)
          )
          .map((assignment) => ({
          id: assignment.project.id,
          name: assignment.project.name,
          location: assignment.project.location,
          locationRadiusMeters: assignment.project.locationRadiusMeters,
          shiftStart: assignment.shiftStart,
          shiftEnd: assignment.shiftEnd,
        }))
      : officeProjects.map((project) => ({
          id: project.id,
          name: project.name,
          location: project.location,
          locationRadiusMeters: project.locationRadiusMeters,
          shiftStart: "09:00",
          shiftEnd: "17:00",
        }));

  return (
    <AppShell
      titleKey="pages.cico.title"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 pb-8">
        <SectionCard className="px-6 py-7 sm:px-8 sm:py-8">
          <h3 className="mb-6 text-lg font-semibold tracking-tight text-text">
            {t("pages.cico.todaysCico")}
          </h3>
          <CicoActions
            todayRecord={todayRecord}
            todaySessions={todaySessions}
            assignedProjects={assignedProjects}
            hasProgressReport={hasProgressReport}
            workDate={workDate}
            requiresProgress={requiresProgress}
          />
          {todaySessions.length > 0 && (
            <div className="mt-6 space-y-2 border-t border-border pt-5 text-sm text-subtle">
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-wrap gap-x-8 gap-y-2"
                >
                  <span className="font-medium text-text">
                    {session.project?.name ?? t("pages.cico.projectSite")}
                  </span>
                  <span>
                    {t("pages.cico.columns.checkIn")}:{" "}
                    <span className="font-medium text-text">
                      {session.checkIn
                        ? formatDisplayTime(session.checkIn)
                        : "-"}
                    </span>
                  </span>
                  <span>
                    {t("pages.cico.columns.checkOut")}:{" "}
                    <span className="font-medium text-text">
                      {session.checkOut
                        ? formatDisplayTime(session.checkOut)
                        : "-"}
                    </span>
                  </span>
                  {assignedProjects.find((p) => p.id === session.projectId)
                    ?.shiftStart && (
                    <span>
                      {t("pages.cico.shiftLabel")}:{" "}
                      <span className="font-medium text-text">
                        {formatTimeRange(
                          assignedProjects.find(
                            (p) => p.id === session.projectId
                          )?.shiftStart,
                          assignedProjects.find(
                            (p) => p.id === session.projectId
                          )?.shiftEnd
                        )}
                      </span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard className="px-6 py-7 sm:px-8 sm:py-8">
          <h3 className="mb-5 text-lg font-semibold tracking-tight text-text">
            {t("pages.cico.recentHistory")}
          </h3>
          <CicoHistoryTable data={history} />
        </SectionCard>
      </div>
    </AppShell>
  );
}
