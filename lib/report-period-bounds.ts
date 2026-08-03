import { formatAppDateInput } from "@/lib/progress-report-compliance";
import { formatDateInput, parseDateInput } from "@/lib/invoice-period";

export type YearMonth = {
  year: number;
  month: number;
};

export type ReportPeriodBounds = {
  min: YearMonth;
  max: YearMonth;
  projectName: string;
};

type ProjectDateFields = {
  name: string;
  startDate: Date | null;
  estimatedStartDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
};

export function toYearMonth(date: Date): YearMonth {
  const key = formatDateInput(date);
  const [year, month] = key.split("-").map(Number);
  return { year: year!, month: month! };
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

/** Real work start — contract start, else planning estimate, else record creation. */
export function resolveProjectWorkStartDate(project: {
  startDate: Date | null;
  estimatedStartDate: Date | null;
  createdAt: Date;
}): Date {
  return project.startDate ?? project.estimatedStartDate ?? project.createdAt;
}

/** Latest selectable month — project end if set, else current calendar month (Jakarta). */
export function resolveProjectWorkEndDate(
  project: { endDate: Date | null },
  now: Date = new Date()
): Date {
  if (project.endDate) return project.endDate;
  return parseDateInput(formatAppDateInput(now));
}

export function getReportPeriodBounds(
  project: ProjectDateFields,
  now: Date = new Date()
): ReportPeriodBounds {
  const min = toYearMonth(resolveProjectWorkStartDate(project));
  const max = toYearMonth(resolveProjectWorkEndDate(project, now));
  const normalizedMax = compareYearMonth(max, min) < 0 ? min : max;

  return {
    min,
    max: normalizedMax,
    projectName: project.name,
  };
}

export function defaultReportPeriod(
  bounds: ReportPeriodBounds,
  now: Date = new Date()
): YearMonth {
  const current = toYearMonth(parseDateInput(formatAppDateInput(now)));
  if (compareYearMonth(current, bounds.min) < 0) return bounds.min;
  if (compareYearMonth(current, bounds.max) > 0) return bounds.max;
  return current;
}

export function isReportPeriodInBounds(
  year: number,
  month: number,
  bounds: ReportPeriodBounds
): boolean {
  const selected = { year, month };
  return (
    compareYearMonth(selected, bounds.min) >= 0 &&
    compareYearMonth(selected, bounds.max) <= 0
  );
}

export function listAllowedYears(bounds: ReportPeriodBounds): number[] {
  const years: number[] = [];
  for (let year = bounds.min.year; year <= bounds.max.year; year += 1) {
    years.push(year);
  }
  return years;
}

export function listAllowedMonths(
  year: number,
  bounds: ReportPeriodBounds
): number[] {
  const startMonth = year === bounds.min.year ? bounds.min.month : 1;
  const endMonth = year === bounds.max.year ? bounds.max.month : 12;
  const months: number[] = [];
  for (let month = startMonth; month <= endMonth; month += 1) {
    months.push(month);
  }
  return months;
}

export function clampReportPeriod(
  year: number,
  month: number,
  bounds: ReportPeriodBounds
): YearMonth {
  const selected = { year, month };
  if (compareYearMonth(selected, bounds.min) < 0) return bounds.min;
  if (compareYearMonth(selected, bounds.max) > 0) return bounds.max;
  return selected;
}
