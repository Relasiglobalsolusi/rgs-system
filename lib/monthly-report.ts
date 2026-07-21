import { prisma } from "@/lib/prisma";
import type { Prisma, ProjectSubCategory } from "@prisma/client";
import {
  DEFAULT_LOCALE,
  localeToBcp47,
  type AppLocale,
} from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";

export type StaffAttendanceSummary = {
  employeeId: string;
  name: string;
  employeeNo: string;
  progressDays: number;
  attendanceDays: number;
};

export type ProjectMonthlyReport = {
  projectId: string;
  projectName: string;
  subCategory: ProjectSubCategory;
  location: string | null;
  clientName: string | null;
  daysWithProgress: number;
  totalProgressEntries: number;
  activitySummary: string;
  staff: StaffAttendanceSummary[];
  /** Number of photo progress reports in the period (replaces legacy %). */
  reportCount: number;
};

export type MonthlyReportData = {
  year: number;
  month: number;
  projects: ProjectMonthlyReport[];
  generatedAt: string;
};

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

export async function buildMonthlyReport(
  companyId: string,
  year: number,
  month: number,
  projectWhere: Prisma.ProjectWhereInput = {},
  locale: AppLocale = DEFAULT_LOCALE
): Promise<MonthlyReportData> {
  const { start, end } = monthRange(year, month);
  const photoReportFallback = translate(locale, "pages.reports.photoReport");

  const projects = await prisma.project.findMany({
    where: { companyId, ...projectWhere },
    include: {
      client: true,
      assignments: { include: { employee: true } },
      progressReports: {
        where: { reportDate: { gte: start, lte: end } },
        include: { employee: true },
        orderBy: { reportDate: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const assignedEmployeeIds = [
    ...new Set(
      projects.flatMap((p) => p.assignments.map((a) => a.employeeId))
    ),
  ];

  const attendances =
    assignedEmployeeIds.length > 0
      ? await prisma.attendance.findMany({
          where: {
            employeeId: { in: assignedEmployeeIds },
            date: { gte: start, lte: end },
            checkIn: { not: null },
          },
        })
      : [];

  const attendanceByEmployee = new Map<string, number>();
  for (const record of attendances) {
    attendanceByEmployee.set(
      record.employeeId,
      (attendanceByEmployee.get(record.employeeId) ?? 0) + 1
    );
  }

  const reportProjects: ProjectMonthlyReport[] = projects.map((project) => {
    const progressEntries = project.progressReports;
    const uniqueDays = new Set(
      progressEntries.map((e) => e.reportDate.toISOString().slice(0, 10))
    );

    const staffMap = new Map<string, StaffAttendanceSummary>();

    for (const assignment of project.assignments) {
      const emp = assignment.employee;
      staffMap.set(emp.id, {
        employeeId: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        employeeNo: emp.employeeNo,
        progressDays: 0,
        attendanceDays: attendanceByEmployee.get(emp.id) ?? 0,
      });
    }

    for (const entry of progressEntries) {
      const existing = staffMap.get(entry.employeeId);
      if (existing) {
        existing.progressDays += 1;
      } else {
        staffMap.set(entry.employeeId, {
          employeeId: entry.employeeId,
          name: `${entry.employee.firstName} ${entry.employee.lastName}`,
          employeeNo: entry.employee.employeeNo,
          progressDays: 1,
          attendanceDays: attendanceByEmployee.get(entry.employeeId) ?? 0,
        });
      }
    }

    const activities = progressEntries
      .slice(-5)
      .map((e) => e.notes || e.stageLabel || photoReportFallback)
      .join("; ");

    return {
      projectId: project.id,
      projectName: project.name,
      subCategory: project.subCategory,
      location: project.location,
      clientName: project.client?.name ?? null,
      daysWithProgress: uniqueDays.size,
      totalProgressEntries: progressEntries.length,
      activitySummary: activities,
      staff: [...staffMap.values()],
      reportCount: progressEntries.length,
    };
  });

  return {
    year,
    month,
    projects: reportProjects,
    generatedAt: new Date().toISOString(),
  };
}

export function formatMonthLabel(
  year: number,
  month: number,
  locale: AppLocale = DEFAULT_LOCALE
) {
  return new Date(year, month - 1, 1).toLocaleDateString(localeToBcp47(locale), {
    month: "long",
    year: "numeric",
  });
}
