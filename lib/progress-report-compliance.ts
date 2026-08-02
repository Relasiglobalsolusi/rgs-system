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
import { parseTimeToMinutes } from "@/lib/operating-hours";

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

/**
 * How many prior local calendar days to check for missed reports after
 * the relevant shift has ended.
 */
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

/** Matches create/list gates — reports are only for In Progress cleaning work. */
const ACTIVE_CLEANING_STATUSES: ProjectStatus[] = ["IN_PROGRESS"];
const CLEANING_SUBS: ProjectSubCategory[] = [
  ...CLEANING_PROJECT_SUB_CATEGORIES,
];

/** In Progress cleaning projects that field staff must report against. */
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
 * Instant when the staff shift for calendar day `dateInput` ends (Asia/Jakarta).
 * Overnight shifts (`shiftEnd` ≤ `shiftStart`) end on the next calendar day.
 * When shift times are missing, falls back to end of that calendar day (23:59:59.999).
 */
export function shiftEndInstant(
  dateInput: string,
  shiftStart: string | null | undefined,
  shiftEnd: string | null | undefined
): Date {
  const [year, month, day] = dateInput.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("Invalid date.");
  }

  const startMins = parseTimeToMinutes(shiftStart);
  const endMins = parseTimeToMinutes(shiftEnd);

  if (endMins == null) {
    // 23:59:59.999 Asia/Jakarta = 16:59:59.999 UTC same calendar date.
    return new Date(Date.UTC(year, month - 1, day, 16, 59, 59, 999));
  }

  const endHour = Math.floor(endMins / 60);
  const endMinute = endMins % 60;
  const overnight = startMins != null && endMins <= startMins;
  const dayOffset = overnight ? 1 : 0;

  // Asia/Jakarta is fixed UTC+7 — convert wall clock to UTC.
  return new Date(
    Date.UTC(year, month - 1, day + dayOffset, endHour - 7, endMinute, 0, 0)
  );
}

/** True when `now` is at or after the shift end for that work day. */
export function hasShiftEndedForReportDay(
  dateInput: string,
  shiftStart: string | null | undefined,
  shiftEnd: string | null | undefined,
  now: Date = new Date()
): boolean {
  return now.getTime() >= shiftEndInstant(dateInput, shiftStart, shiftEnd).getTime();
}

/**
 * Local calendar days (Asia/Jakarta) to scan for missing reports, newest first.
 * Eligibility for each assignment×day still requires that assignment's shift to have ended.
 */
export function getMissingReportLookbackDates(
  now: Date = new Date(),
  lookbackDays: number = MISSING_REPORT_LOOKBACK_DAYS
): string[] {
  const todayInput = formatAppDateInput(now);
  const today = parseDateInput(todayInput);
  const dates: string[] = [];

  for (let offset = 0; offset <= lookbackDays; offset++) {
    const day = addUtcDays(today, -offset);
    dates.push(formatDateInput(day));
  }

  return dates;
}

type AssignmentShift = {
  projectId: string;
  shiftStart: string | null;
  shiftEnd: string | null;
  project: { id: string; name: string };
};

/**
 * Field cleaning staff missing-report warnings:
 * - Only active field / project-site staff (not HO / corporate / office)
 * - Only assigned active Regular / General / Facade cleaning projects
 * - Only after that assignment's shift has ended for the work day
 * - Missing = zero progress reports for employee × project × shift-day
 * - Excludes warnings the user has acknowledged
 */
export async function getMissingProgressReportsForEmployee(
  employeeId: string,
  userId: string,
  now: Date = new Date()
): Promise<MissingReportWarning[]> {
  if (!(await isFieldCleaningReporter(employeeId))) return [];

  const lookbackDates = getMissingReportLookbackDates(now);
  if (lookbackDates.length === 0) return [];

  const assignments = await prisma.projectAssignment.findMany({
    where: {
      employeeId,
      project: activeCleaningProjectWhere,
    },
    select: {
      projectId: true,
      shiftStart: true,
      shiftEnd: true,
      project: { select: { id: true, name: true } },
    },
  });

  if (assignments.length === 0) return [];

  const projectIds = assignments.map((a) => a.projectId);
  const reportDates = lookbackDates.map((d) => parseDateInput(d));

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

  for (const date of lookbackDates) {
    for (const assignment of assignments as AssignmentShift[]) {
      if (
        !hasShiftEndedForReportDay(
          date,
          assignment.shiftStart,
          assignment.shiftEnd,
          now
        )
      ) {
        continue;
      }
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
 * Single calendar-day missing projects for the selected date.
 * Only includes projects whose shift for that day has already ended.
 * Used for same-day page banners (no ack filter).
 */
export async function getMissingProjectsForEmployeeOnDate(
  employeeId: string,
  date: Date,
  now: Date = new Date()
): Promise<MissingReportProject[]> {
  if (!(await isFieldCleaningReporter(employeeId))) return [];

  const reportDate = toUtcDateOnly(date);
  const dateInput = formatDateInput(reportDate);

  const assignments = await prisma.projectAssignment.findMany({
    where: {
      employeeId,
      project: activeCleaningProjectWhere,
    },
    select: {
      projectId: true,
      shiftStart: true,
      shiftEnd: true,
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
    .filter(
      (a) =>
        !submitted.has(a.projectId) &&
        hasShiftEndedForReportDay(dateInput, a.shiftStart, a.shiftEnd, now)
    )
    .map((a) => ({ id: a.project.id, name: a.project.name }));
}

/**
 * For admin views: field cleaning staff missing a report for any assigned
 * active cleaning project on the selected date (after that shift has ended).
 */
export async function getStaffMissingReportsForDate(
  companyId: string,
  dateInput: string,
  now: Date = new Date()
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
    if (
      !hasShiftEndedForReportDay(
        dateInput,
        assignment.shiftStart,
        assignment.shiftEnd,
        now
      )
    ) {
      continue;
    }

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
