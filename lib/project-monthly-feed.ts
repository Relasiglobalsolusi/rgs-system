import { prisma } from "@/lib/prisma";
import { addUtcDays, formatDateInput } from "@/lib/invoice-period";

export type FeedProgressReport = {
  id: string;
  stageLabel: string | null;
  notes: string | null;
  createdAt: string;
  photos: { id: string; url: string }[];
};

export type FeedCico = {
  checkIn: string | null;
  checkOut: string | null;
};

export type FeedEmployeeDay = {
  employeeId: string;
  name: string;
  employeeNo: string;
  progressReports: FeedProgressReport[];
  cico: FeedCico | null;
};

export type FeedDay = {
  dateKey: string;
  employees: FeedEmployeeDay[];
  hasActivity: boolean;
};

export type ProjectMonthlyDayFeed = {
  year: number;
  month: number;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  days: FeedDay[];
};

function monthDateRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

function calendarDaysInMonth(year: number, month: number): string[] {
  const { start, end } = monthDateRange(year, month);
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(formatDateInput(cursor));
    cursor = addUtcDays(cursor, 1);
  }
  return days;
}

function dateKeyFromDbDate(date: Date): string {
  return formatDateInput(date);
}

export async function buildProjectMonthlyDayFeed(
  projectId: string,
  year: number,
  month: number
): Promise<ProjectMonthlyDayFeed | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      clientId: true,
      client: { select: { name: true } },
    },
  });
  if (!project?.clientId || !project.client) return null;

  const { start, end } = monthDateRange(year, month);

  const [progressReports, attendances] = await Promise.all([
    prisma.progressReport.findMany({
      where: {
        projectId,
        reportDate: { gte: start, lte: end },
      },
      include: {
        employee: true,
        photos: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    // CICO is strictly scoped to this project — never aggregate other sites.
    prisma.attendance.findMany({
      where: {
        projectId: { equals: projectId },
        date: { gte: start, lte: end },
      },
      include: { employee: true },
    }),
  ]);

  const projectScopedAttendances = attendances.filter(
    (row) => row.projectId === projectId
  );

  const dayKeys = calendarDaysInMonth(year, month);

  type EmployeeBucket = {
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      employeeNo: string;
    };
    progressReports: typeof progressReports;
    attendance: (typeof attendances)[number] | null;
    firstActivityMs: number;
  };

  const byDay = new Map<string, Map<string, EmployeeBucket>>();
  for (const key of dayKeys) {
    byDay.set(key, new Map());
  }

  for (const report of progressReports) {
    const dayKey = dateKeyFromDbDate(report.reportDate);
    const dayMap = byDay.get(dayKey);
    if (!dayMap) continue;

    let entry = dayMap.get(report.employeeId);
    if (!entry) {
      entry = {
        employee: report.employee,
        progressReports: [],
        attendance: null,
        firstActivityMs: Number.POSITIVE_INFINITY,
      };
      dayMap.set(report.employeeId, entry);
    }
    entry.progressReports.push(report);
    entry.firstActivityMs = Math.min(
      entry.firstActivityMs,
      report.createdAt.getTime()
    );
  }

  for (const attendance of projectScopedAttendances) {
    const dayKey = dateKeyFromDbDate(attendance.date);
    const dayMap = byDay.get(dayKey);
    if (!dayMap) continue;

    let entry = dayMap.get(attendance.employeeId);
    if (!entry) {
      entry = {
        employee: attendance.employee,
        progressReports: [],
        attendance: null,
        firstActivityMs: Number.POSITIVE_INFINITY,
      };
      dayMap.set(attendance.employeeId, entry);
    }

    const existing = entry.attendance;
    if (
      !existing ||
      (attendance.checkIn &&
        (!existing.checkIn || attendance.checkIn < existing.checkIn))
    ) {
      entry.attendance = attendance;
    }

    if (attendance.checkIn) {
      entry.firstActivityMs = Math.min(
        entry.firstActivityMs,
        attendance.checkIn.getTime()
      );
    }
  }

  const days: FeedDay[] = dayKeys.map((dateKey) => {
    const dayMap = byDay.get(dateKey)!;
    const employees = [...dayMap.values()]
      .sort((a, b) => a.firstActivityMs - b.firstActivityMs)
      .map((entry) => ({
        employeeId: entry.employee.id,
        name: `${entry.employee.firstName} ${entry.employee.lastName}`,
        employeeNo: entry.employee.employeeNo,
        progressReports: [...entry.progressReports]
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((report) => ({
          id: report.id,
          stageLabel: report.stageLabel,
          notes: report.notes,
          createdAt: report.createdAt.toISOString(),
          photos: report.photos.map((photo) => ({
            id: photo.id,
            url: photo.url,
          })),
        })),
        cico: entry.attendance
          ? {
              checkIn: entry.attendance.checkIn?.toISOString() ?? null,
              checkOut: entry.attendance.checkOut?.toISOString() ?? null,
            }
          : null,
      }));

    return {
      dateKey,
      employees,
      hasActivity: employees.length > 0,
    };
  });

  return {
    year,
    month,
    projectId: project.id,
    projectName: project.name,
    clientId: project.clientId,
    clientName: project.client.name,
    days,
  };
}
