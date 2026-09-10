import {
  DEFAULT_PAYROLL_RUN,
  formatPayrollPeriodRange,
  type PayrollRunKind,
} from "@/lib/internal-payroll-period";
import { prisma } from "@/lib/prisma";

/**
 * A closed payroll period only reopens through the owner. Anyone with the
 * Payroll module may ask, the requester may withdraw their own request, and
 * every decision is written to the period's permanent change record.
 */
export type PayrollUnlockRequestView = {
  id: string;
  year: number;
  month: number;
  run: PayrollRunKind;
  periodLabel: string;
  reason: string;
  requestedByName: string | null;
  requestedById: string | null;
  requestedAt: string;
  /** True when the signed-in user raised it, so they may withdraw it. */
  own: boolean;
};

function toView(
  row: {
    id: string;
    year: number;
    month: number;
    run: PayrollRunKind;
    reason: string;
    requestedByName: string | null;
    requestedById: string | null;
    requestedAt: Date;
  },
  options: { userId?: string | null; bcp47?: string }
): PayrollUnlockRequestView {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    run: row.run,
    periodLabel: formatPayrollPeriodRange(
      row.year,
      row.month,
      options.bcp47,
      row.run
    ),
    reason: row.reason,
    requestedByName: row.requestedByName,
    requestedById: row.requestedById,
    requestedAt: row.requestedAt.toISOString(),
    own: Boolean(options.userId && row.requestedById === options.userId),
  };
}

const PENDING_SELECT = {
  id: true,
  year: true,
  month: true,
  run: true,
  reason: true,
  requestedByName: true,
  requestedById: true,
  requestedAt: true,
} as const;

/** The open request on one period, if there is one. */
export async function findPendingPayrollUnlockRequest(options: {
  companyId: string;
  year: number;
  month: number;
  run?: PayrollRunKind;
  userId?: string | null;
  bcp47?: string;
}): Promise<PayrollUnlockRequestView | null> {
  const row = await prisma.payrollUnlockRequest.findFirst({
    where: {
      companyId: options.companyId,
      year: options.year,
      month: options.month,
      run: options.run ?? DEFAULT_PAYROLL_RUN,
      status: "PENDING",
    },
    select: PENDING_SELECT,
    orderBy: { requestedAt: "desc" },
  });
  return row ? toView(row, options) : null;
}

/** Every open request, for the owner's Approvals queue. */
export async function listPendingPayrollUnlockRequests(options: {
  companyId: string;
  userId?: string | null;
  bcp47?: string;
}): Promise<PayrollUnlockRequestView[]> {
  const rows = await prisma.payrollUnlockRequest.findMany({
    where: { companyId: options.companyId, status: "PENDING" },
    select: PENDING_SELECT,
    orderBy: { requestedAt: "asc" },
  });
  return rows.map((row) => toView(row, options));
}

export async function countPendingPayrollUnlockRequests(
  companyId: string
): Promise<number> {
  return prisma.payrollUnlockRequest.count({
    where: { companyId, status: "PENDING" },
  });
}
