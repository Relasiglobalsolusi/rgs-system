"use server";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { getProjectWhereForUser } from "@/lib/project-access";
import {
  COMPLETE_SHIFT_HOURS,
  DOUBLE_SHIFT_HOURS,
  attendanceHours,
  hoursMeetShift,
  jakartaWorkDateKey,
} from "@/lib/shift-pay";
import {
  getReportPeriodBounds,
  type ReportPeriodBounds,
} from "@/lib/report-period-bounds";
import {
  formatTimeRange,
  isEarlyCheckOut,
  isLateCheckIn,
  resolveExpectedShiftStart,
} from "@/lib/operating-hours";
import { formatDisplayDate, DISPLAY_LOCALE } from "@/lib/format-date";
import { getServerLocale, localeToBcp47 } from "@/lib/i18n/locale";
import { formatAppDateInput } from "@/lib/progress-report-compliance";
import { ensureInternalAttendanceSites } from "@/lib/ensure-internal-attendance-sites";
import type { ProjectSubCategory } from "@prisma/client";

export type AttendanceClientRow = {
  id: string;
  name: string;
  projectCount: number;
};

export type AttendanceProjectRow = {
  id: string;
  name: string;
  location: string | null;
  subCategory: ProjectSubCategory;
  serviceArea: string;
};

/** Pinned Head Office / Warehouse cards on the Attendance Report home. */
export type AttendanceInternalSiteRow = {
  /** Route client id — `"internal"` for company-owned Internal projects. */
  clientId: string;
  projectId: string;
  name: string;
  kind: "HEAD_OFFICE" | "WAREHOUSE";
};

export type AttendanceDirectory = {
  internalSites: AttendanceInternalSiteRow[];
  clients: AttendanceClientRow[];
};

export type AttendanceProjectContext = {
  projectName: string;
  clientName: string;
  bounds: ReportPeriodBounds;
};

export type AttendanceMonthRow = {
  id: string;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  checkInDistanceMeters: number | null;
  checkOutDistanceMeters: number | null;
  checkInPhotoUrl: string | null;
  note: string | null;
  isLate: boolean | null;
  isEarly: boolean | null;
  hoursWorked: number | null;
  requiredHours: number | null;
  underAssignedHours: boolean;
  shiftLabel: string;
  employee: { firstName: string; lastName: string; employeeNo: string };
  project: { name: string } | null;
};

export type AttendanceDayGroup = {
  dateKey: string;
  dateLabel: string;
  isToday: boolean;
  rows: AttendanceMonthRow[];
};

export type AttendanceMonthData = {
  projectName: string;
  clientName: string;
  groups: AttendanceDayGroup[];
};

/** Attendance home: Internal (HO + Warehouse) then external clients. */
export async function getAttendanceDirectory(): Promise<AttendanceDirectory> {
  const session = await requireModule("attendance");
  const companyId = session.user.companyId;
  if (!companyId) {
    return { internalSites: [], clients: [] };
  }

  // Client portal: no internal RGS sites — only their client.
  const isClientPortal = Boolean(session.user.clientId);
  let internalClientId: string | null = null;
  let internalSites: AttendanceInternalSiteRow[] = [];

  if (!isClientPortal) {
    const ensured = await ensureInternalAttendanceSites(companyId);
    internalClientId = ensured.internalClientId;
    internalSites = ensured.sites;
  }

  const projectWhere = await getProjectWhereForUser({
    companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });

  const { ATTENDANCE_INTERNAL_CLIENT_NAME, isAttendanceInternalProject } =
    await import("@/lib/attendance-internal-sites");
  const { normalizeClientName } = await import("@/lib/client-login-id");

  const clients = await prisma.client.findMany({
    where: {
      companyId,
      active: true,
      ...(session.user.clientId ? { id: session.user.clientId } : {}),
      ...(internalClientId ? { id: { not: internalClientId } } : {}),
      nameNormalized: {
        not: normalizeClientName(ATTENDANCE_INTERNAL_CLIENT_NAME),
      },
      projects: {
        some: {
          ...projectWhere,
          subCategory: { not: "INTERNAL" },
        },
      },
    },
    include: {
      projects: {
        where: {
          ...projectWhere,
          subCategory: { not: "INTERNAL" },
        },
        select: { id: true, name: true, serviceArea: true, subCategory: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  if (internalSites.length > 0) {
    const allowedInternal = await prisma.project.findMany({
      where: {
        id: { in: internalSites.map((site) => site.projectId) },
        ...projectWhere,
      },
      select: { id: true },
    });
    const allowedIds = new Set(allowedInternal.map((row) => row.id));
    internalSites = internalSites.filter((site) =>
      allowedIds.has(site.projectId)
    );
  }

  return {
    internalSites,
    clients: clients
      .map((c) => {
        const commercial = c.projects.filter(
          (p) => !isAttendanceInternalProject(p)
        );
        return {
          id: c.id,
          name: c.name,
          projectCount: commercial.length,
        };
      })
      .filter((c) => c.projectCount > 0),
  };
}

export async function getAttendanceProjectsForClient(
  clientId: string
): Promise<{ clientName: string; projects: AttendanceProjectRow[] } | null> {
  const session = await requireModule("attendance");

  if (session.user.clientId && session.user.clientId !== clientId) {
    return null;
  }

  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });

  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId: session.user.companyId, active: true },
    include: {
      projects: {
        where: projectWhere,
        select: {
          id: true,
          name: true,
          location: true,
          subCategory: true,
          serviceArea: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!client) return null;

  const { partitionAttendanceProjects } = await import(
    "@/lib/attendance-internal-sites"
  );
  const { internal, projects } = partitionAttendanceProjects(client.projects);

  return {
    clientName: client.name,
    projects: [...internal, ...projects],
  };
}

async function getAccessibleAttendanceProject(
  clientId: string,
  projectId: string
) {
  const session = await requireModule("attendance");
  const { ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID } = await import(
    "@/lib/attendance-internal-sites"
  );
  const isInternalRoute = clientId === ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID;

  // Client portal never sees Internal company sites.
  if (session.user.clientId) {
    if (isInternalRoute || session.user.clientId !== clientId) {
      return null;
    }
  }

  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });

  if (isInternalRoute) {
    return prisma.project.findFirst({
      where: {
        id: projectId,
        companyId: session.user.companyId,
        OR: [
          { subCategory: "INTERNAL" },
          { serviceArea: "HEAD_OFFICE" },
        ],
        ...projectWhere,
      },
      select: {
        id: true,
        name: true,
        subCategory: true,
        startDate: true,
        estimatedStartDate: true,
        endDate: true,
        createdAt: true,
        client: { select: { name: true } },
      },
    });
  }

  return prisma.project.findFirst({
    where: {
      id: projectId,
      clientId,
      companyId: session.user.companyId,
      ...projectWhere,
    },
    select: {
      id: true,
      name: true,
      subCategory: true,
      startDate: true,
      estimatedStartDate: true,
      endDate: true,
      createdAt: true,
      client: { select: { name: true } },
    },
  });
}

export async function getAttendanceProjectContext(
  clientId: string,
  projectId: string
): Promise<AttendanceProjectContext | null> {
  const project = await getAccessibleAttendanceProject(clientId, projectId);
  if (!project) return null;

  const { ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID } = await import(
    "@/lib/attendance-internal-sites"
  );
  const clientName =
    clientId === ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID
      ? "Internal"
      : project.client?.name;
  if (!clientName) return null;

  return {
    projectName: project.name,
    clientName,
    bounds: getReportPeriodBounds(project),
  };
}

export async function getAttendanceMonthData(
  clientId: string,
  projectId: string,
  year: number,
  month: number
): Promise<AttendanceMonthData | null> {
  const project = await getAccessibleAttendanceProject(clientId, projectId);
  if (!project) return null;

  const { ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID } = await import(
    "@/lib/attendance-internal-sites"
  );
  const clientName =
    clientId === ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID
      ? "Internal"
      : project.client?.name;
  if (!clientName) return null;

  const locale = await getServerLocale();
  const bcp47 = localeToBcp47(locale);
  const todayKey = formatAppDateInput(new Date());

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const [records, assignments] = await Promise.all([
    prisma.attendance.findMany({
      where: { projectId, date: { gte: monthStart, lt: monthEnd } },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeNo: true },
        },
      },
      orderBy: [
        { date: "asc" },
        { checkIn: "asc" },
        { employee: { firstName: "asc" } },
      ],
    }),
    prisma.projectAssignment.findMany({
      where: { projectId },
      select: { employeeId: true, shiftStart: true, shiftEnd: true },
    }),
  ]);

  const employeeIds = [...new Set(records.map((row) => row.employeeId))];
  const doubleShifts =
    employeeIds.length === 0
      ? []
      : await prisma.doubleShiftAssignment.findMany({
          where: {
            projectId,
            employeeId: { in: employeeIds },
            date: { gte: monthStart, lt: monthEnd },
          },
          select: { employeeId: true, date: true },
        });
  const doubleShiftKeys = new Set(
    doubleShifts.map(
      (row) => `${row.employeeId}:${jakartaWorkDateKey(row.date)}`
    )
  );

  const shiftMap = new Map(assignments.map((a) => [a.employeeId, a]));
  const { getOfficeCicoPunctuality } = await import("@/lib/office-cico");
  const isInternal = project.subCategory === "INTERNAL";

  const dayDateLabels = new Map<string, string>();
  const dayGroups = new Map<
    string,
    { date: Date; isToday: boolean; rows: AttendanceMonthRow[] }
  >();

  for (const record of records) {
    const dateKey = record.date.toISOString().slice(0, 10);

    if (!dayGroups.has(dateKey)) {
      const dateLabel = formatDisplayDate(
        record.date,
        {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        },
        bcp47 ?? DISPLAY_LOCALE
      );
      dayDateLabels.set(dateKey, dateLabel);
      dayGroups.set(dateKey, {
        date: record.date,
        isToday: dateKey === todayKey,
        rows: [],
      });
    }

    const assignment = shiftMap.get(record.employeeId);
    const expected = resolveExpectedShiftStart(assignment);
    const officePunctuality = isInternal
      ? getOfficeCicoPunctuality({
          checkIn: record.checkIn,
          checkOut: record.checkOut,
        })
      : null;
    let isLate: boolean | null =
      record.lateCheckIn === true
        ? true
        : record.checkIn != null
          ? isLateCheckIn(record.checkIn, expected)
          : null;
    if (isInternal && record.checkIn != null && isLate == null) {
      isLate = officePunctuality?.lateCheckIn ?? false;
    }
    let isEarly: boolean | null =
      record.earlyCheckOut === true
        ? true
        : record.checkOut != null
          ? isEarlyCheckOut(
              record.checkOut,
              assignment?.shiftStart,
              assignment?.shiftEnd
            )
          : null;
    if (isInternal && record.checkOut != null && isEarly == null) {
      isEarly = officePunctuality?.earlyCheckOut ?? false;
    }
    const note = record.note;
    const hoursWorked = attendanceHours(record.checkIn, record.checkOut);
    const requiredHours = doubleShiftKeys.has(
      `${record.employeeId}:${jakartaWorkDateKey(record.date)}`
    )
      ? DOUBLE_SHIFT_HOURS
      : COMPLETE_SHIFT_HOURS;
    const underAssignedHours =
      hoursWorked != null && !hoursMeetShift(hoursWorked, requiredHours);

    dayGroups.get(dateKey)!.rows.push({
      id: record.id,
      date: record.date,
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      checkInDistanceMeters: record.checkInDistanceMeters,
      checkOutDistanceMeters: record.checkOutDistanceMeters,
      checkInPhotoUrl: record.checkInPhotoUrl,
      note,
      isLate,
      isEarly,
      hoursWorked,
      requiredHours,
      underAssignedHours,
      shiftLabel: isInternal
        ? "09:00 – 17:00"
        : formatTimeRange(
            assignment?.shiftStart ?? null,
            assignment?.shiftEnd ?? null
          ),
      employee: record.employee,
      project: null,
    });
  }

  const groups: AttendanceDayGroup[] = Array.from(dayGroups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, group]) => ({
      dateKey,
      dateLabel: dayDateLabels.get(dateKey) ?? dateKey,
      isToday: group.isToday,
      rows: group.rows,
    }));

  return {
    projectName: project.name,
    clientName,
    groups,
  };
}

export type EarlyCheckOutRow = {
  id: string;
  employeeName: string;
  employeeNo: string;
  projectName: string;
  clientName: string;
  date: Date;
  shiftEnd: string | null;
  checkOut: Date;
  reportRecorded: boolean;
};

export type EarlyCheckOutReport = {
  year: number;
  month: number;
  rows: EarlyCheckOutRow[];
};

function currentAttendanceYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

async function loadEarlyCheckOutRows(
  year: number,
  month: number
): Promise<EarlyCheckOutRow[]> {
  const session = await requireModule("attendance");
  const companyId = session.user.companyId;
  if (!companyId) return [];

  const projectWhere = await getProjectWhereForUser({
    companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const records = await prisma.attendance.findMany({
    where: {
      earlyCheckOut: true,
      checkOut: { not: null },
      date: { gte: monthStart, lt: monthEnd },
      project: projectWhere,
    },
    include: {
      employee: {
        select: { firstName: true, lastName: true, employeeNo: true },
      },
      project: {
        select: {
          id: true,
          name: true,
          client: { select: { name: true } },
        },
      },
    },
    orderBy: [{ date: "desc" }, { checkOut: "desc" }],
    take: 200,
  });

  if (records.length === 0) return [];

  const assignmentPairs = records.flatMap((record) =>
    record.projectId
      ? [{ projectId: record.projectId, employeeId: record.employeeId }]
      : []
  );
  const assignments =
    assignmentPairs.length === 0
      ? []
      : await prisma.projectAssignment.findMany({
          where: { OR: assignmentPairs },
          select: { projectId: true, employeeId: true, shiftEnd: true },
        });
  const shiftEndByPair = new Map(
    assignments.map((row) => [`${row.projectId}:${row.employeeId}`, row.shiftEnd])
  );

  return records.flatMap((record) => {
    if (!record.checkOut || !record.project) return [];
    return [
      {
        id: record.id,
        employeeName: `${record.employee.firstName} ${record.employee.lastName}`.trim(),
        employeeNo: record.employee.employeeNo,
        projectName: record.project.name,
        clientName: record.project.client?.name ?? "Internal",
        date: record.date,
        shiftEnd:
          shiftEndByPair.get(`${record.projectId}:${record.employeeId}`) ??
          (record.project.client ? null : "17:00"),
        checkOut: record.checkOut,
        reportRecorded: true,
      },
    ];
  });
}

export async function getEarlyCheckOutCount(): Promise<number> {
  const { year, month } = currentAttendanceYearMonth();
  const rows = await loadEarlyCheckOutRows(year, month);
  return rows.length;
}

export async function getEarlyCheckOutReport(
  year?: number,
  month?: number
): Promise<EarlyCheckOutReport> {
  const current = currentAttendanceYearMonth();
  const resolvedYear = year && year >= 2000 && year <= 2100 ? year : current.year;
  const resolvedMonth =
    month && month >= 1 && month <= 12 ? month : current.month;
  const rows = await loadEarlyCheckOutRows(resolvedYear, resolvedMonth);
  return { year: resolvedYear, month: resolvedMonth, rows };
}
