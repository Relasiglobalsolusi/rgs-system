"use server";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { getProjectWhereForUser } from "@/lib/project-access";
import {
  getReportPeriodBounds,
  type ReportPeriodBounds,
} from "@/lib/report-period-bounds";
import {
  formatTimeRange,
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

export async function getAttendanceClients(): Promise<AttendanceClientRow[]> {
  const directory = await getAttendanceDirectory();
  return directory.clients;
}

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
      record.checkIn != null ? isLateCheckIn(record.checkIn, expected) : null;
    if (isInternal && record.checkIn != null && isLate == null) {
      isLate = officePunctuality?.lateCheckIn ?? false;
    }
    let note = record.note;
    if (isInternal && officePunctuality?.earlyCheckOut) {
      const earlyTag = "Left early (before 17:00)";
      note = note?.includes(earlyTag)
        ? note
        : note
          ? `${note} · ${earlyTag}`
          : earlyTag;
    }

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
