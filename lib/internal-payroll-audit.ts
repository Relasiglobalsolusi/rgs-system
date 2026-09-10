import type { Prisma } from "@prisma/client";

import {
  DEFAULT_PAYROLL_RUN,
  type PayrollRunKind,
} from "@/lib/internal-payroll-period";
import { prisma } from "@/lib/prisma";
import { writeRecordChange } from "@/lib/record-change";

/**
 * Permanent record of everything that happens to an Internal Payroll period —
 * the lock, an owner unlock and its reason, and every line changed afterwards.
 * These rows are never edited or deleted, so a closed month always shows who
 * changed what.
 */
export const INTERNAL_PAYROLL_AUDIT_ENTITY = "InternalPayroll";

export type InternalPayrollAuditAction =
  | "PAYROLL_LOCKED"
  | "PAYROLL_UNLOCK_REQUESTED"
  | "PAYROLL_UNLOCK_CANCELLED"
  | "PAYROLL_UNLOCK_APPROVED"
  | "PAYROLL_UNLOCK_REJECTED"
  | "PAYROLL_UNLOCKED"
  | "PAYROLL_EMPLOYEE_ADDED"
  | "PAYROLL_EMPLOYEE_REMOVED"
  | "PAYROLL_EMPLOYEE_CHANGED"
  | "PAYROLL_LINE_ADDED"
  | "PAYROLL_LINE_REMOVED"
  | "PAYROLL_DAY_PAY_SET";

export function internalPayrollAuditId(
  year: number,
  month: number,
  run: PayrollRunKind = DEFAULT_PAYROLL_RUN
): string {
  return `${year}-${String(month).padStart(2, "0")}-${run}`;
}

export async function recordInternalPayrollChange(options: {
  companyId: string;
  userId?: string | null;
  year: number;
  month: number;
  run?: PayrollRunKind;
  action: InternalPayrollAuditAction;
  description: string;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  db?: Pick<Prisma.TransactionClient, "auditLog"> | typeof prisma;
}): Promise<void> {
  await writeRecordChange({
    companyId: options.companyId,
    userId: options.userId ?? null,
    action: options.action,
    entity: INTERNAL_PAYROLL_AUDIT_ENTITY,
    entityId: internalPayrollAuditId(
      options.year,
      options.month,
      options.run ?? DEFAULT_PAYROLL_RUN
    ),
    description: options.description,
    oldValue: options.oldValue ?? null,
    newValue: options.newValue ?? null,
    db: options.db,
  });
}

export type InternalPayrollChangeRow = {
  id: string;
  action: string;
  description: string | null;
  actorName: string | null;
  at: string;
};

/** Change history for one period, newest first. Read-only. */
export async function listInternalPayrollChanges(options: {
  companyId: string;
  year: number;
  month: number;
  run?: PayrollRunKind;
  limit?: number;
}): Promise<InternalPayrollChangeRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      companyId: options.companyId,
      entity: INTERNAL_PAYROLL_AUDIT_ENTITY,
      entityId: internalPayrollAuditId(
        options.year,
        options.month,
        options.run ?? DEFAULT_PAYROLL_RUN
      ),
    },
    select: {
      id: true,
      action: true,
      description: true,
      createdAt: true,
      user: { select: { name: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 50,
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    description: row.description,
    actorName: row.user?.name?.trim() || row.user?.username || null,
    at: row.createdAt.toISOString(),
  }));
}
