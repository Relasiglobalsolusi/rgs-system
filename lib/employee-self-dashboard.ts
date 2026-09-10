import { formatProjectShiftLabel } from "@/lib/project-shifts";
import { holderBalanceFromEntries } from "@/lib/petty-cash";
import {
  currentPayrollPeriod,
  formatPayrollPeriodRange,
  type PayrollRunKind,
} from "@/lib/internal-payroll-period";
import { loadInternalPayrollMonth } from "@/lib/internal-payroll-month";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";

/**
 * Everything an employee may see about themselves, gathered for their own
 * dashboard. Each block is scoped to this employee, so a staff account never
 * needs a module just to read their own roster, float, or pay.
 */
export type EmployeeSelfDashboard = {
  team: { name: string; serviceArea: string | null } | null;
  jobs: Array<{
    id: string;
    projectName: string;
    clientName: string | null;
    location: string | null;
    shiftLabel: string | null;
    isBackup: boolean;
    coveringName: string | null;
  }>;
  pay: {
    periodLabel: string;
    daysWorked: number;
    earnedSoFar: number;
    dailyRate: number;
    exemptFromCico: boolean;
  } | null;
  pettyCash: { balance: number } | null;
  prepaidCards: Array<{
    id: string;
    cardNumber: string;
    balance: number;
    vehicleLabel: string | null;
  }>;
  thr: {
    year: number;
    amount: number;
    paid: boolean;
    hariRayaDate: string;
  } | null;
  bpjs: { employeePaidToDate: number; heldBack: number } | null;
};

const LIVE_PROJECT_STATUSES = ["IN_PROGRESS", "WAITING_FOR_APPROVAL"] as const;

export async function loadEmployeeSelfDashboard(options: {
  companyId: string;
  employeeId: string;
  payrollRun: PayrollRunKind;
  /** Petty Cash / Cards children this account may open. */
  advanceCash: { petty: boolean; prepaid: boolean };
  bcp47?: string;
}): Promise<EmployeeSelfDashboard> {
  const { companyId, employeeId } = options;
  const period = currentPayrollPeriod(undefined, options.payrollRun);

  const [
    membership,
    assignments,
    payRows,
    pettyEntries,
    cardAssignments,
    thr,
    employee,
  ] = await Promise.all([
    prisma.operationsTeamMember.findFirst({
      where: { employeeId, team: { companyId } },
      select: {
        team: {
          select: {
            name: true,
            serviceAreaCatalog: { select: { nameEn: true } },
          },
        },
      },
    }),
    prisma.projectAssignment.findMany({
      where: {
        employeeId,
        project: { companyId, status: { in: [...LIVE_PROJECT_STATUSES] } },
      },
      select: {
        id: true,
        isBackup: true,
        shiftStart: true,
        shiftEnd: true,
        shift: { select: { number: true, startTime: true, endTime: true } },
        project: {
          select: {
            name: true,
            location: true,
            client: { select: { name: true } },
          },
        },
        coveredEmployee: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ isBackup: "asc" }, { assignedAt: "asc" }],
    }),
    // Live CICO, so the employee sees what they have earned so far this period.
    loadInternalPayrollMonth({
      companyId,
      year: period.year,
      month: period.month,
      run: options.payrollRun,
      employeeId,
      live: true,
    }),
    options.advanceCash.petty
      ? prisma.pettyCashEntry.findMany({
          where: { companyId, holderEmployeeId: employeeId },
          select: { kind: true, status: true, amount: true },
        })
      : Promise.resolve([]),
    options.advanceCash.prepaid
      ? prisma.prepaidCardAssignment.findMany({
          where: {
            custodianEmployeeId: employeeId,
            endedAt: null,
            prepaidCard: { companyId },
          },
          select: {
            prepaidCard: {
              select: { id: true, cardNumber: true, currentBalance: true },
            },
            vehicleAsset: { select: { assetCode: true } },
          },
        })
      : Promise.resolve([]),
    // Nothing shows until THR is actually generated — a draft is not a promise.
    prisma.thrPayment.findFirst({
      where: {
        employeeId,
        companyId,
        status: { in: ["GENERATED", "PAID"] },
      },
      select: {
        year: true,
        amount: true,
        status: true,
        paidAt: true,
        hariRayaDate: true,
      },
      orderBy: { year: "desc" },
    }),
    prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { bpjsShareHeldIdr: true },
    }),
  ]);

  const payRow = payRows[0] ?? null;
  const bpjsPaid = await sumBpjsEmployeeShare(companyId, employeeId);

  return {
    team: membership?.team
      ? {
          name: membership.team.name,
          serviceArea: membership.team.serviceAreaCatalog?.nameEn ?? null,
        }
      : null,
    jobs: assignments.map((row) => ({
      id: row.id,
      projectName: row.project.name,
      clientName: row.project.client?.name ?? null,
      location: row.project.location,
      shiftLabel: row.shift
        ? formatProjectShiftLabel({
            number: row.shift.number,
            startTime: row.shift.startTime,
            endTime: row.shift.endTime,
          })
        : row.shiftStart && row.shiftEnd
          ? `${row.shiftStart}–${row.shiftEnd}`
          : null,
      isBackup: row.isBackup,
      coveringName: row.coveredEmployee
        ? `${row.coveredEmployee.firstName} ${row.coveredEmployee.lastName}`.trim()
        : null,
    })),
    pay: payRow
      ? {
          periodLabel: formatPayrollPeriodRange(
            period.year,
            period.month,
            options.bcp47,
            options.payrollRun
          ),
          daysWorked: payRow.daysWorked,
          earnedSoFar: payRow.wage,
          dailyRate: payRow.dailyRate,
          exemptFromCico: payRow.cicoExempt === true,
        }
      : null,
    pettyCash: options.advanceCash.petty
      ? {
          balance: holderBalanceFromEntries(
            pettyEntries.map((row) => ({
              kind: row.kind,
              status: row.status,
              amount: decimalToNumber(row.amount) ?? 0,
            }))
          ),
        }
      : null,
    prepaidCards: cardAssignments.map((row) => ({
      id: row.prepaidCard.id,
      cardNumber: row.prepaidCard.cardNumber,
      balance: decimalToNumber(row.prepaidCard.currentBalance) ?? 0,
      vehicleLabel: row.vehicleAsset?.assetCode ?? null,
    })),
    thr: thr
      ? {
          year: thr.year,
          amount: decimalToNumber(thr.amount) ?? 0,
          paid: thr.status === "PAID" || thr.paidAt != null,
          hariRayaDate: thr.hariRayaDate.toISOString(),
        }
      : null,
    bpjs: {
      employeePaidToDate: bpjsPaid,
      heldBack: Math.max(
        0,
        Math.round(decimalToNumber(employee?.bpjsShareHeldIdr) ?? 0)
      ),
    },
  };
}

/**
 * BPJS the employee has actually paid: their share on every locked run, taken
 * from the frozen payslip snapshots so it never moves after a month closes.
 */
async function sumBpjsEmployeeShare(
  companyId: string,
  employeeId: string
): Promise<number> {
  const locks = await prisma.internalPayrollLock.findMany({
    where: { companyId, locked: true },
    select: { snapshot: true },
  });
  let total = 0;
  for (const lock of locks) {
    if (!Array.isArray(lock.snapshot)) continue;
    for (const raw of lock.snapshot as Array<Record<string, unknown>>) {
      if (raw?.employeeId !== employeeId) continue;
      const kesehatan = Number(raw.bpjsKesehatan ?? 0);
      const tk = Number(raw.bpjsTk ?? 0);
      total +=
        (Number.isFinite(kesehatan) ? kesehatan : 0) +
        (Number.isFinite(tk) ? tk : 0);
    }
  }
  return Math.round(total);
}
