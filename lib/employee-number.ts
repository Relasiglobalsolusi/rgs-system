import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | {
  employee: Prisma.EmployeeDelegate;
  employeeCategory: Prisma.EmployeeCategoryDelegate;
};

async function resolveCategoryPrefix(
  db: DbClient,
  categoryId: string,
  companyId: string
): Promise<string> {
  const category = await db.employeeCategory.findFirst({
    where: {
      id: categoryId,
      companyId,
      active: true,
    },
  });

  if (!category) {
    throw new Error("Selected department was not found.");
  }

  const prefix = category.prefix.trim().toUpperCase();
  if (!prefix) {
    throw new Error("Department numbering prefix is not configured.");
  }

  return prefix;
}

/** Match PREFIX-001 or tombstoned PREFIX-001~deleted~… */
function parseSequence(employeeNo: string, prefix: string): number | null {
  const pattern = new RegExp(`^${prefix}-(\\d+)(?:~|$)`, "i");
  const match = employeeNo.match(pattern);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

function findLowestAvailableSequence(usedSequences: number[]): number {
  const used = new Set(usedSequences);
  let sequence = 1;

  while (used.has(sequence)) {
    sequence += 1;
  }

  return sequence;
}

function formatEmployeeNumber(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(3, "0")}`;
}

/**
 * Next employee number for a department prefix.
 * Never reuses numbers — soft-deleted and permanently archived tombstones
 * still occupy their original sequence.
 */
export async function getNextEmployeeNumber(
  companyId: string,
  categoryId: string,
  db: DbClient = prisma
): Promise<string> {
  const prefix = await resolveCategoryPrefix(db, categoryId, companyId);

  // Include archived tombstones so numbers are never reused.
  const employees = await db.employee.findMany({
    where: {
      companyId,
      employeeNo: { startsWith: `${prefix}-` },
    },
    select: { employeeNo: true },
  });

  const usedSequences = employees
    .map((employee) => parseSequence(employee.employeeNo, prefix))
    .filter((sequence): sequence is number => sequence !== null);

  const nextSequence = findLowestAvailableSequence(usedSequences);
  return formatEmployeeNumber(prefix, nextSequence);
}

export async function reassignEmployeeNumber(
  employeeId: string,
  newCategoryId: string,
  db: DbClient = prisma
): Promise<string> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { companyId: true, categoryId: true, employeeNo: true },
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  if (employee.categoryId === newCategoryId) {
    return employee.employeeNo;
  }

  return getNextEmployeeNumber(employee.companyId, newCategoryId, db);
}
