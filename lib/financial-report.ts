import type { EmploymentType } from "@prisma/client";

import { formatEmployeeName } from "@/lib/employee-user-link";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";

/**
 * Financial Report P&L definitions (HO Finance only):
 *
 * - Contract value: Project.contractPrice (IDR), summed across a client's projects.
 * - Money in: ProjectInvoicePeriod rows with status === "PAID" (confirmed cash;
 *   PENDING_VERIFICATION is excluded). Amount =
 *   revisedInvoiceAmount ?? amount ?? project.contractPrice (same fallback as billing).
 * - Money out / spending: inventory issued to the project + wage cost of employees
 *   currently assigned to the project (see below).
 * - Client profit: contract value − spending (contract margin).
 * - Project profit: money in − money out (confirmed receipts vs inventory + wages).
 *
 * Wage cost (no payroll-run model in this ERP):
 * - Source: Employee.basePay (monthly upah pokok in IDR; also used for BPJS/THR).
 * - Scope: current ProjectAssignment rows only. Releases delete assignment rows, so
 *   former assignees are not included (no assignment history).
 * - Period: inclusive UTC calendar days from assignedAt through
 *   min(today, project.endDate when set and earlier than today).
 * - Amount: calendar-month proration of monthly basePay
 *   (days overlapping month / days in that month × basePay), rounded to IDR.
 * - THR, BPJS employer cost, attendance/timesheet allocation, and paid payroll
 *   lines are not included (none are project-linked payroll actuals).
 * - Full Time and Part Time use the same monthly basePay field; there is no
 *   separate daily rate. Dual-assigned staff get full prorated basePay on each
 *   project (no timesheet split).
 */

export type PaidPeriodAmountInput = {
  amount: Parameters<typeof decimalToNumber>[0];
  revisedInvoiceAmount?: Parameters<typeof decimalToNumber>[0];
  projectContractPrice?: Parameters<typeof decimalToNumber>[0];
};

/** Confirmed receipt amount for one PAID invoice period. */
export function paidPeriodAmount(period: PaidPeriodAmountInput): number {
  return (
    decimalToNumber(period.revisedInvoiceAmount) ??
    decimalToNumber(period.amount) ??
    decimalToNumber(period.projectContractPrice) ??
    0
  );
}

export function profitMarginPercent(
  moneyIn: number,
  profit: number
): number | null {
  if (moneyIn <= 0) return null;
  return (profit / moneyIn) * 100;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** UTC calendar day (00:00Z). */
export function utcCalendarDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Last day to accrue wage cost for an assignment on a project.
 * Uses project.endDate when it is on/before asOf; otherwise asOf (today).
 */
export function wageCostThroughDate(options: {
  asOf?: Date;
  projectEndDate?: Date | null;
}): Date {
  const asOf = utcCalendarDay(options.asOf ?? new Date());
  if (!options.projectEndDate) return asOf;
  const end = utcCalendarDay(options.projectEndDate);
  return end.getTime() < asOf.getTime() ? end : asOf;
}

/**
 * Prorate monthly base pay over inclusive UTC calendar days [from, through].
 * Each calendar month contributes basePay × (overlapDays / daysInMonth).
 */
export function prorateMonthlyBasePay(
  monthlyBasePay: number,
  from: Date,
  through: Date
): number {
  const pay = Math.max(0, Number.isFinite(monthlyBasePay) ? monthlyBasePay : 0);
  const start = utcCalendarDay(from);
  const end = utcCalendarDay(through);
  if (pay <= 0 || end.getTime() < start.getTime()) return 0;

  let total = 0;
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const monthDays = daysInUtcMonth(year, month);
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month, monthDays));
    const overlapStart =
      start.getTime() > monthStart.getTime() ? start : monthStart;
    const overlapEnd = end.getTime() < monthEnd.getTime() ? end : monthEnd;
    if (overlapEnd.getTime() >= overlapStart.getTime()) {
      const days =
        Math.round(
          (overlapEnd.getTime() - overlapStart.getTime()) / MS_PER_DAY
        ) + 1;
      total += pay * (days / monthDays);
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return Math.round(total);
}

export type ProjectWageEmployeeRow = {
  assignmentId: string;
  employeeId: string;
  employeeNo: string;
  name: string;
  employmentType: EmploymentType;
  monthlyBasePay: number | null;
  assignedAt: Date;
  costFrom: Date;
  costThrough: Date;
  wageCost: number;
};

type AssignmentWageInput = {
  assignmentId: string;
  assignedAt: Date;
  employee: {
    id: string;
    employeeNo: string;
    firstName: string;
    lastName: string;
    employmentType: EmploymentType;
    basePay: Parameters<typeof decimalToNumber>[0];
  };
};

export function buildProjectWageEmployeeRow(
  assignment: AssignmentWageInput,
  projectEndDate: Date | null | undefined,
  asOf?: Date
): ProjectWageEmployeeRow {
  const monthlyBasePay = decimalToNumber(assignment.employee.basePay);
  const costFrom = utcCalendarDay(assignment.assignedAt);
  const costThrough = wageCostThroughDate({
    asOf,
    projectEndDate: projectEndDate ?? null,
  });
  const wageCost = prorateMonthlyBasePay(
    monthlyBasePay ?? 0,
    costFrom,
    costThrough
  );

  return {
    assignmentId: assignment.assignmentId,
    employeeId: assignment.employee.id,
    employeeNo: assignment.employee.employeeNo,
    name: formatEmployeeName(assignment.employee),
    employmentType: assignment.employee.employmentType,
    monthlyBasePay,
    assignedAt: assignment.assignedAt,
    costFrom,
    costThrough,
    wageCost,
  };
}

/** Wage rows for one project (current assignees), ordered by name. */
export async function listProjectWageCosts(
  projectId: string,
  options?: { companyId?: string; asOf?: Date }
): Promise<ProjectWageEmployeeRow[]> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...(options?.companyId ? { companyId: options.companyId } : {}),
    },
    select: {
      endDate: true,
      assignments: {
        select: {
          id: true,
          assignedAt: true,
          employee: {
            select: {
              id: true,
              employeeNo: true,
              firstName: true,
              lastName: true,
              employmentType: true,
              basePay: true,
            },
          },
        },
      },
    },
  });

  if (!project) return [];

  return project.assignments
    .map((assignment) =>
      buildProjectWageEmployeeRow(
        {
          assignmentId: assignment.id,
          assignedAt: assignment.assignedAt,
          employee: assignment.employee,
        },
        project.endDate,
        options?.asOf
      )
    )
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/** Sum wage cost for one project (current assignees). */
export async function getProjectWageCost(
  projectId: string,
  options?: { companyId?: string; asOf?: Date }
): Promise<number> {
  const rows = await listProjectWageCosts(projectId, options);
  return rows.reduce((sum, row) => sum + row.wageCost, 0);
}

/**
 * Wage cost totals keyed by projectId for many projects (one query).
 * Uses each project's endDate for the cost-through rule.
 */
export async function getProjectWageCostsByProjectIds(
  projectIds: string[],
  options?: { companyId?: string; asOf?: Date }
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (projectIds.length === 0) return totals;

  const assignments = await prisma.projectAssignment.findMany({
    where: {
      projectId: { in: projectIds },
      ...(options?.companyId
        ? { project: { companyId: options.companyId } }
        : {}),
    },
    select: {
      id: true,
      projectId: true,
      assignedAt: true,
      project: { select: { endDate: true } },
      employee: {
        select: {
          id: true,
          employeeNo: true,
          firstName: true,
          lastName: true,
          employmentType: true,
          basePay: true,
        },
      },
    },
  });

  for (const assignment of assignments) {
    const row = buildProjectWageEmployeeRow(
      {
        assignmentId: assignment.id,
        assignedAt: assignment.assignedAt,
        employee: assignment.employee,
      },
      assignment.project.endDate,
      options?.asOf
    );
    totals.set(
      assignment.projectId,
      (totals.get(assignment.projectId) ?? 0) + row.wageCost
    );
  }

  return totals;
}
