import type { Prisma, PrismaClient } from "@prisma/client";

import { decimalToNumber } from "@/lib/project-billing";

type Db = PrismaClient | Prisma.TransactionClient;

const OWED_DEDUCTION_TYPES = [
  "PENALTY",
  "OTHER",
  "LOST_STOCK",
  "CLIENT_COMPENSATION",
] as const;

export type EmployeeCompanyBalance = {
  employeeId: string;
  heldBpjsShare: number;
  unpaidDeductions: number;
  amountOwed: number;
  depositHeld: number;
};

export async function getEmployeeCompanyBalance(
  db: Db,
  employeeId: string
): Promise<EmployeeCompanyBalance | null> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      companyId: true,
      bpjsShareHeldIdr: true,
      depositHeldAmount: true,
    },
  });
  if (!employee) return null;

  const locks = await db.internalPayrollLock.findMany({
    where: { companyId: employee.companyId, locked: true },
    select: { year: true, month: true },
  });
  const lockedKeys = new Set(locks.map((row) => `${row.year}-${row.month}`));

  const extraLines = await db.payrollDeduction.findMany({
    where: {
      employeeId,
      type: { in: [...OWED_DEDUCTION_TYPES] },
    },
    select: { amount: true, year: true, month: true },
  });
  const unpaidDeductions = extraLines
    .filter((row) => !lockedKeys.has(`${row.year}-${row.month}`))
    .reduce(
      (sum, row) => sum + Math.max(0, Math.round(decimalToNumber(row.amount) ?? 0)),
      0
    );

  const heldBpjsShare = Math.max(
    0,
    Math.round(decimalToNumber(employee.bpjsShareHeldIdr) ?? 0)
  );
  const depositHeld = Math.max(
    0,
    Math.round(decimalToNumber(employee.depositHeldAmount) ?? 0)
  );

  return {
    employeeId,
    heldBpjsShare,
    unpaidDeductions,
    amountOwed: heldBpjsShare + unpaidDeductions,
    depositHeld,
  };
}

export async function getEmployeeCompanyBalances(
  db: Db,
  employeeIds: string[]
): Promise<Map<string, EmployeeCompanyBalance>> {
  const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
  const result = new Map<string, EmployeeCompanyBalance>();
  if (uniqueIds.length === 0) return result;

  const employees = await db.employee.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      companyId: true,
      bpjsShareHeldIdr: true,
      depositHeldAmount: true,
    },
  });
  if (employees.length === 0) return result;

  const companyIds = [...new Set(employees.map((row) => row.companyId))];
  const locks = await db.internalPayrollLock.findMany({
    where: { companyId: { in: companyIds }, locked: true },
    select: { companyId: true, year: true, month: true },
  });
  const lockedKeys = new Set(
    locks.map((row) => `${row.companyId}-${row.year}-${row.month}`)
  );

  const extraLines = await db.payrollDeduction.findMany({
    where: {
      employeeId: { in: uniqueIds },
      type: { in: [...OWED_DEDUCTION_TYPES] },
    },
    select: {
      employeeId: true,
      companyId: true,
      amount: true,
      year: true,
      month: true,
    },
  });
  const unpaidByEmployee = new Map<string, number>();
  for (const row of extraLines) {
    const key = `${row.companyId}-${row.year}-${row.month}`;
    if (lockedKeys.has(key)) continue;
    unpaidByEmployee.set(
      row.employeeId,
      (unpaidByEmployee.get(row.employeeId) ?? 0) +
        Math.max(0, Math.round(decimalToNumber(row.amount) ?? 0))
    );
  }

  for (const employee of employees) {
    const heldBpjsShare = Math.max(
      0,
      Math.round(decimalToNumber(employee.bpjsShareHeldIdr) ?? 0)
    );
    const unpaidDeductions = unpaidByEmployee.get(employee.id) ?? 0;
    result.set(employee.id, {
      employeeId: employee.id,
      heldBpjsShare,
      unpaidDeductions,
      amountOwed: heldBpjsShare + unpaidDeductions,
      depositHeld: Math.max(
        0,
        Math.round(decimalToNumber(employee.depositHeldAmount) ?? 0)
      ),
    });
  }
  return result;
}
