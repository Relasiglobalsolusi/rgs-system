import type { Prisma, PrismaClient } from "@prisma/client";

import { toDecimal } from "@/lib/inventory";
import { decimalToNumber } from "@/lib/project-billing";

type Db = PrismaClient | Prisma.TransactionClient;

const UNRECOVERED_DEDUCTION_TYPES = [
  "PENALTY",
  "OTHER",
  "LOST_STOCK",
  "CLIENT_COMPENSATION",
] as const;

/**
 * When an employee leaves, net any amount they still owe against the
 * security deposit first. Leftover deposit is project profit. A shortfall
 * is a project expense. Never leave the balance as a receivable.
 */
export async function writeOffUnrecoveredEmployeeDebt(
  db: Db,
  employeeId: string
): Promise<void> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      companyId: true,
      firstName: true,
      lastName: true,
      bpjsShareHeldIdr: true,
      depositHeldAmount: true,
      depositStatus: true,
      depositSourceProjectId: true,
      projectAssignments: {
        select: { projectId: true },
        orderBy: { assignedAt: "desc" },
      },
    },
  });
  if (!employee) return;

  const locks = await db.internalPayrollLock.findMany({
    where: { companyId: employee.companyId, locked: true },
    select: { year: true, month: true },
  });
  const lockedKeys = new Set(locks.map((row) => `${row.year}-${row.month}`));

  const extraLines = await db.payrollDeduction.findMany({
    where: {
      employeeId,
      type: { in: [...UNRECOVERED_DEDUCTION_TYPES] },
    },
    select: { id: true, amount: true, year: true, month: true },
  });
  const unrecoveredLines = extraLines.filter(
    (row) => !lockedKeys.has(`${row.year}-${row.month}`)
  );

  const held = Math.max(
    0,
    Math.round(decimalToNumber(employee.bpjsShareHeldIdr) ?? 0)
  );
  const extra = unrecoveredLines.reduce(
    (sum, row) =>
      sum + Math.max(0, Math.round(decimalToNumber(row.amount) ?? 0)),
    0
  );
  const owed = held + extra;
  const deposit = Math.max(
    0,
    Math.round(decimalToNumber(employee.depositHeldAmount) ?? 0)
  );

  const projectIds = [
    ...new Set(
      [
        employee.depositSourceProjectId,
        ...employee.projectAssignments.map((row) => row.projectId),
      ].filter((id): id is string => Boolean(id))
    ),
  ];

  if (unrecoveredLines.length > 0) {
    await db.payrollDeduction.deleteMany({
      where: { id: { in: unrecoveredLines.map((row) => row.id) } },
    });
  }

  if (held > 0) {
    await db.employee.update({
      where: { id: employeeId },
      data: { bpjsShareHeldIdr: toDecimal(0) },
    });
  }

  if (deposit > 0) {
    await db.employee.update({
      where: { id: employeeId },
      data: {
        depositHeldAmount: toDecimal(0),
        depositStatus: "KEPT_BY_COMPANY",
      },
    });
  }

  const targetProjectId = projectIds[0];
  if (!targetProjectId) return;

  const name = `${employee.firstName} ${employee.lastName}`.trim();
  const surplus = Math.max(0, deposit - owed);
  const shortfall = Math.max(0, owed - deposit);

  if (surplus > 0) {
    await db.projectExpense.create({
      data: {
        companyId: employee.companyId,
        projectId: targetProjectId,
        employeeId,
        category: "EMPLOYEE_DEPOSIT_SURPLUS",
        amount: toDecimal(-surplus),
        reason: `Security deposit applied against the outstanding balance of ${name}. Remaining deposit of ${surplus.toLocaleString("id-ID")} booked as project income.`,
      },
    });
  }

  if (shortfall > 0) {
    await db.projectExpense.create({
      data: {
        companyId: employee.companyId,
        projectId: targetProjectId,
        employeeId,
        category: "EMPLOYEE_UNRECOVERED_DEBT",
        amount: toDecimal(shortfall),
        reason: `Unrecovered employee balance after security deposit for ${name}. Shortfall of ${shortfall.toLocaleString("id-ID")} booked as project expense.`,
      },
    });
  }
}
