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
  const session = await requireModule("attendance");
  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
  });

  const clients = await prisma.client.findMany({
    where: {
      companyId: session.user.companyId,
      active: true,
      ...(session.user.clientId ? { id: session.user.clientId } : {}),
      projects: { some: projectWhere },
    },
    include: {
      projects: { where: projectWhere, select: { id: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return clients
    .map((c) => ({ id: c.id, name: c.name, projectCount: c.projects.length }))
    .filter((c) => c.projectCount > 0);
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
        select: { id: true, name: true, location: true, subCategory: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!client) return null;

  return { clientName: client.name, projects: client.projects };
}

async function getAccessibleAttendanceProject(
  clientId: string,
  projectId: string
) {
  const session = await requireModule("attendance");

  if (session.user.clientId && session.user.clientId !== clientId) {
    return null;
  }

  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
  });

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
  if (!project?.client) return null;

  return {
    projectName: project.name,
    clientName: project.client.name,
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
  if (!project?.client) return null;

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
    const isLate =
      record.checkIn != null ? isLateCheckIn(record.checkIn, expected) : null;

    dayGroups.get(dateKey)!.rows.push({
      id: record.id,
      date: record.date,
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      checkInDistanceMeters: record.checkInDistanceMeters,
      checkOutDistanceMeters: record.checkOutDistanceMeters,
      checkInPhotoUrl: record.checkInPhotoUrl,
      note: record.note,
      isLate,
      shiftLabel: formatTimeRange(
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
    clientName: project.client.name,
    groups,
  };
}
