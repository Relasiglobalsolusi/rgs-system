import type { ProjectStatus, ProjectSubCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activeFieldStaffWhere } from "@/lib/permissions";
import { CLEANING_PROJECT_SUB_CATEGORIES } from "@/lib/project-subcategory";
import {
  formatDateInput,
  parseDateInput,
  toUtcDateOnly,
} from "@/lib/invoice-period";
import { formatDisplayDate } from "@/lib/format-date";

/**
 * Personal "missing cleaning progress report" prompts apply only to active
 * field / project-site staff — not Head Office, corporate, or office roles.
 */
async function isFieldCleaningReporter(employeeId: string): Promise<boolean> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, ...activeFieldStaffWhere },
    select: { id: true },
  });
  return Boolean(employee);
}

/** App local timezone for progress-report deadlines (Indonesia). */
export const APP_TIMEZONE = "Asia/Jakarta";

/** Local hour after which a missing report for that day becomes warnable. */
export const MISSING_REPORT_WARNING_HOUR = 22;

/** How many prior local calendar days to check for missed reports. */
export const MISSING_REPORT_LOOKBACK_DAYS = 14;

export type MissingReportProject = {
  id: string;
  name: string;
};

/** One missing project+day warning for field cleaning staff. */
export type MissingReportWarning = {
  projectId: string;
  projectName: string;
  /** YYYY-MM-DD in Asia/Jakarta / UTC date-only storage. */
  date: string;
  dateLabel: string;
};

const ACTIVE_CLEANING_STATUSES: ProjectStatus[] = ["PLANNED", "IN_PROGRESS"];
const CLEANING_SUBS: ProjectSubCategory[] = [
  ...CLEANING_PROJECT_SUB_CATEGORIES,
];

/** Active cleaning projects that field staff must report against. */
const activeCleaningProjectWhere = {
  status: { in: ACTIVE_CLEANING_STATUSES },
  subCategory: { in: CLEANING_SUBS },
};

/**
 * Calendar date string (YYYY-MM-DD) for `instant` in Asia/Jakarta.
 * Jakarta has no DST (UTC+7 year-round).
 */
export function formatAppDateInput(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * Instant when the missing-report warning for calendar day `dateInput`
 * becomes eligible: that day at 22:00 Asia/Jakarta.
 */
export function missingReportWarningDeadline(dateInput: string): Date {
  const [year, month, day] = dateInput.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("Invalid date.");
  }
  // 22:00 Asia/Jakarta = 15:00 UTC same calendar date (fixed UTC+7).
  return new Date(Date.UTC(year, month - 1, day, 15, 0, 0));
}

/** True when `now` is at or after 22:00 local on `dateInput`. */
export function isMissingReportWarningDue(
  dateInput: string,
  now: Date = new Date()
): boolean {
  return now.getTime() >= missingReportWarningDeadline(dateInput).getTime();
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days
    )
  );
}

function dateLabelFor(dateInput: string): string {
  return formatDisplayDate(parseDateInput(dateInput), { timeZone: "UTC" });
}

/**
 * Local calendar days (Asia/Jakarta) that are eligible for a missing-report
 * warning as of `now`, newest first. Includes today only after 22:00 local.
 */
export function getEligibleMissingReportDates(
  now: Date = new Date(),
  lookbackDays: number = MISSING_REPORT_LOOKBACK_DAYS
): string[] {
  const todayInput = formatAppDateInput(now);
  const today = parseDateInput(todayInput);
  const dates: string[] = [];

  for (let offset = 0; offset <= lookbackDays; offset++) {
    const day = addUtcDays(today, -offset);
    const dateInput = formatDateInput(day);
    if (isMissingReportWarningDue(dateInput, now)) {
      dates.push(dateInput);
    }
  }

  return dates;
}

/**
 * Field cleaning staff missing-report warnings:
 * - Only active field / project-site staff (not HO / corporate / office)
 * - Only assigned active Regular / General / Facade cleaning projects
 * - Only days with no progress report at all
 * - Only after 22:00 Asia/Jakarta on that day (missed days still appear later)
 * - Excludes warnings the user has acknowledged
 */
export async function getMissingProgressReportsForEmployee(
  employeeId: string,
  userId: string,
  now: Date = new Date()
): Promise<MissingReportWarning[]> {
  if (!(await isFieldCleaningReporter(employeeId))) return [];

  const eligibleDates = getEligibleMissingReportDates(now);
  if (eligibleDates.length === 0) return [];

  const assignments = await prisma.projectAssignment.findMany({
    where: {
      employeeId,
      project: activeCleaningProjectWhere,
    },
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  if (assignments.length === 0) return [];

  const projectIds = assignments.map((a) => a.projectId);
  const reportDates = eligibleDates.map((d) => parseDateInput(d));

  const [reports, acks] = await Promise.all([
    prisma.progressReport.findMany({
      where: {
        employeeId,
        projectId: { in: projectIds },
        reportDate: { in: reportDates },
      },
      select: { projectId: true, reportDate: true },
    }),
    prisma.progressWarningAck.findMany({
      where: {
        userId,
        projectId: { in: projectIds },
        reportDate: { in: reportDates },
      },
      select: { projectId: true, reportDate: true },
    }),
  ]);

  const submitted = new Set(
    reports.map((r) => `${r.projectId}:${formatDateInput(r.reportDate)}`)
  );
  const acknowledged = new Set(
    acks.map((a) => `${a.projectId}:${formatDateInput(a.reportDate)}`)
  );

  const warnings: MissingReportWarning[] = [];

  for (const date of eligibleDates) {
    for (const assignment of assignments) {
      const key = `${assignment.projectId}:${date}`;
      if (submitted.has(key) || acknowledged.has(key)) continue;
      warnings.push({
        projectId: assignment.project.id,
        projectName: assignment.project.name,
        date,
        dateLabel: dateLabelFor(date),
      });
    }
  }

  return warnings;
}

/**
 * Single calendar-day missing projects (no 22:00 gate, no ack filter).
 * Used for admin date pickers / same-day page banners when a date is selected.
 */
export async function getMissingProjectsForEmployeeOnDate(
  employeeId: string,
  date: Date
): Promise<MissingReportProject[]> {
  if (!(await isFieldCleaningReporter(employeeId))) return [];

  const reportDate = toUtcDateOnly(date);

  const assignments = await prisma.projectAssignment.findMany({
    where: {
      employeeId,
      project: activeCleaningProjectWhere,
    },
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  if (assignments.length === 0) return [];

  const reports = await prisma.progressReport.findMany({
    where: {
      employeeId,
      reportDate,
      projectId: { in: assignments.map((a) => a.projectId) },
    },
    select: { projectId: true },
  });

  const submitted = new Set(reports.map((r) => r.projectId));

  return assignments
    .filter((a) => !submitted.has(a.projectId))
    .map((a) => ({ id: a.project.id, name: a.project.name }));
}

/**
 * For admin views: field cleaning staff missing a report for any assigned
 * active cleaning project on the selected date.
 */
export async function getStaffMissingReportsForDate(
  companyId: string,
  dateInput: string
) {
  const reportDate = parseDateInput(dateInput);

  const assignments = await prisma.projectAssignment.findMany({
    where: {
      project: {
        companyId,
        ...activeCleaningProjectWhere,
      },
      employee: {
        ...activeFieldStaffWhere,
        companyId,
      },
    },
    include: {
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
  });

  const reports = await prisma.progressReport.findMany({
    where: {
      reportDate,
      project: {
        companyId,
        subCategory: { in: CLEANING_SUBS },
      },
    },
    select: { employeeId: true, projectId: true },
  });

  const submitted = new Set(
    reports.map((r) => `${r.employeeId}:${r.projectId}`)
  );

  const byEmployee = new Map<
    string,
    {
      employee: {
        id: string;
        firstName: string;
        lastName: string;
        employeeNo: string;
        category: { name: string } | null;
      };
      missingProjects: { id: string; name: string }[];
    }
  >();

  for (const assignment of assignments) {
    const key = `${assignment.employeeId}:${assignment.projectId}`;
    if (submitted.has(key)) continue;

    const existing = byEmployee.get(assignment.employeeId);
    if (existing) {
      existing.missingProjects.push({
        id: assignment.project.id,
        name: assignment.project.name,
      });
    } else {
      byEmployee.set(assignment.employeeId, {
        employee: assignment.employee,
        missingProjects: [
          { id: assignment.project.id, name: assignment.project.name },
        ],
      });
    }
  }

  return {
    date: formatDateInput(reportDate),
    missing: Array.from(byEmployee.values()),
  };
}
