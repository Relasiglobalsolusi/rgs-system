import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import {
  formatDateInput,
  parseDateInput,
  toUtcDateOnly,
} from "@/lib/invoice-period";
import { formatDisplayDate } from "@/lib/format-date";
import {
  formatTimeRange,
  isLateCheckIn,
  resolveExpectedShiftStart,
} from "@/lib/operating-hours";
import { isProjectSubCategory } from "@/lib/project-subcategory";
import { localizeSubCategory } from "@/lib/i18n/labels";
import { getServerLocale, localeToBcp47 } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";

import AppShell from "@/components/layout/AppShell";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import AttendanceDateFilters from "@/components/attendance/AttendanceDateFilters";
import AttendanceSiteTable, {
  type AttendanceSiteRow,
} from "@/components/attendance/AttendanceSiteTable";
import AttendanceCheckInTable, {
  type AttendanceCheckInRow,
} from "@/components/attendance/AttendanceCheckInTable";

export default async function AttendanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    projectId?: string;
    subCategory?: string;
  }>;
}) {
  const session = await requireModule("attendance");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const companyId = session.user.companyId;
  const portalClientId = session.user.clientId;
  const { date: dateRaw, projectId, subCategory: subCategoryRaw } =
    await searchParams;
  const subCategory =
    subCategoryRaw && isProjectSubCategory(subCategoryRaw)
      ? subCategoryRaw
      : undefined;

  const todayInput = formatDateInput(toUtcDateOnly(new Date()));
  let selectedDate = todayInput;
  try {
    if (dateRaw) selectedDate = formatDateInput(parseDateInput(dateRaw));
  } catch {
    selectedDate = todayInput;
  }
  const reportDate = parseDateInput(selectedDate);

  const projectScope = {
    ...(projectId ? { id: projectId } : {}),
    ...(subCategory ? { subCategory } : {}),
    ...(portalClientId ? { clientId: portalClientId } : {}),
  };

  const [sites, dayAttendance, filterProjects, assignmentShifts] =
    await Promise.all([
      prisma.project.findMany({
        where: {
          companyId,
          status: { in: ["PLANNED", "IN_PROGRESS"] },
          ...projectScope,
        },
        include: {
          assignments: {
            include: {
              employee: {
                select: { id: true, status: true },
              },
            },
          },
          attendances: {
            where: { date: reportDate },
            select: {
              id: true,
              checkIn: true,
              employeeId: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.attendance.findMany({
        where: {
          date: reportDate,
          ...(projectId ? { projectId } : {}),
          employee: { companyId },
          ...(subCategory || portalClientId
            ? {
                project: {
                  ...(subCategory ? { subCategory } : {}),
                  ...(portalClientId ? { clientId: portalClientId } : {}),
                },
              }
            : {}),
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
      prisma.project.findMany({
        where: {
          companyId,
          status: { in: ["PLANNED", "IN_PROGRESS"] },
          ...(portalClientId ? { clientId: portalClientId } : {}),
        },
        select: {
          id: true,
          name: true,
          subCategory: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.projectAssignment.findMany({
        where: {
          project: {
            companyId,
            ...(portalClientId ? { clientId: portalClientId } : {}),
          },
          ...(projectId ? { projectId } : {}),
        },
        select: {
          employeeId: true,
          projectId: true,
          shiftStart: true,
          shiftEnd: true,
        },
      }),
    ]);

  const shiftKey = (employeeId: string, projectIdValue: string | null) =>
    `${employeeId}:${projectIdValue ?? ""}`;

  const shiftMap = new Map(
    assignmentShifts.map((a) => [shiftKey(a.employeeId, a.projectId), a])
  );

  const siteRows: AttendanceSiteRow[] = sites.map((site) => {
    const activeStaff = site.assignments.filter(
      (a) => a.employee.status === "ACTIVE"
    );
    const presentIds = new Set(
      site.attendances.filter((a) => a.checkIn).map((a) => a.employeeId)
    );

    let lateCount = 0;
    for (const record of site.attendances) {
      if (!record.checkIn) continue;
      const assignment = shiftMap.get(shiftKey(record.employeeId, site.id));
      const expected = resolveExpectedShiftStart(assignment);
      if (isLateCheckIn(record.checkIn, expected) === true) {
        lateCount += 1;
      }
    }

    return {
      id: site.id,
      name: site.name,
      location: site.location,
      status: site.status,
      staffCount: activeStaff.length,
      presentCount: presentIds.size,
      lateCount,
    };
  });

  function toAttendanceRow(
    row: (typeof dayAttendance)[number]
  ): AttendanceCheckInRow {
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
  }

  const attendanceRows = dayAttendance.map(toAttendanceRow);

  const totalStaff = siteRows.reduce((sum, row) => sum + row.staffCount, 0);
  const totalPresent = attendanceRows.filter((row) => row.checkIn).length;
  const dateLabel = formatDisplayDate(
    reportDate,
    { timeZone: "UTC" },
    localeToBcp47(locale)
  );
  const selectedFilterLabel = projectId
    ? filterProjects.find((p) => p.id === projectId)?.name
    : subCategory
      ? localizeSubCategory(subCategory, locale)
      : null;
  const checkInCountKey =
    attendanceRows.length === 1
      ? "pages.attendance.checkInCountOne"
      : "pages.attendance.checkInCountOther";

  return (
    <AppShell
      titleKey="pages.attendance.title"
      descriptionKey="pages.attendance.description"
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text">
          {t("pages.attendance.attendanceForDate", { date: dateLabel })}
        </h2>
        <p className="mt-1 text-xs text-muted">
          {t(checkInCountKey, { count: attendanceRows.length })}
          {selectedFilterLabel ? ` · ${selectedFilterLabel}` : ""}
        </p>
      </div>

      <AttendanceDateFilters
        date={selectedDate}
        projectId={projectId}
        subCategory={subCategory}
        projects={filterProjects}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <SectionCard>
          <p className="text-sm text-subtle">
            {t("pages.attendance.activeSites")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-text">
            {siteRows.length}
          </p>
        </SectionCard>
        <SectionCard>
          <p className="text-sm text-subtle">
            {t("pages.attendance.assignedStaff")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-text">{totalStaff}</p>
        </SectionCard>
        <SectionCard>
          <p className="text-sm text-subtle">
            {t("pages.attendance.checkedIn")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-400">
            {totalPresent}
          </p>
        </SectionCard>
      </div>

      {!projectId && (
        <SectionCard className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-text">
            {t("pages.attendance.activeProjectSites")}
          </h3>
          <AttendanceSiteTable data={siteRows} />
        </SectionCard>
      )}

      <SectionCard>
        <h3 className="mb-4 text-lg font-semibold text-text">
          {t("pages.attendance.siteCheckIns")}
          {selectedFilterLabel ? ` — ${selectedFilterLabel}` : ""}
        </h3>
        {attendanceRows.length === 0 ? (
          <EmptyState
            titleKey="pages.attendance.emptyTitle"
            descriptionKey="pages.attendance.emptyDescription"
          />
        ) : (
          <AttendanceCheckInTable data={attendanceRows} />
        )}
      </SectionCard>
    </AppShell>
  );
}
