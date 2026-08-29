import { formatEmployeeName } from "@/lib/employee-user-link";
import { holderBalanceFromEntries } from "@/lib/petty-cash";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";

export type PettyCashHolderEntryView = {
  id: string;
  kind: string;
  status: string;
  amount: number;
  entryDate: string;
  description: string;
  proofPath: string | null;
  projectName: string | null;
  clientName: string | null;
  relatedEmployeeName: string | null;
};

export type PettyCashHolderView = {
  id: string;
  employeeId: string | null;
  name: string;
  employeeNo: string | null;
  balance: number;
  entries: PettyCashHolderEntryView[];
};

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export type UnpaidPartTimeWageView = {
  id: string;
  employeeId: string | null;
  employeeName: string;
  employeeNo: string | null;
  projectName: string | null;
  entryDate: string;
  amount: number;
  description: string;
};

export async function loadUnpaidPartTimeWages(
  companyId: string
): Promise<UnpaidPartTimeWageView[]> {
  const rows = await prisma.pettyCashEntry.findMany({
    where: {
      companyId,
      kind: "PART_TIME_PAY",
      status: "UNPAID",
    },
    include: {
      employee: {
        select: { firstName: true, lastName: true, employeeNo: true },
      },
      project: { select: { name: true } },
    },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee ? formatEmployeeName(row.employee) : row.description,
    employeeNo: row.employee?.employeeNo ?? null,
    projectName: row.project?.name ?? null,
    entryDate: dateKey(row.entryDate),
    amount: decimalToNumber(row.amount) ?? 0,
    description: row.description,
  }));
}

export async function loadPettyCashHolders(
  companyId: string
): Promise<PettyCashHolderView[]> {
  const entries = await prisma.pettyCashEntry.findMany({
    where: {
      companyId,
      holderEmployeeId: { not: null },
      NOT: {
        kind: "PART_TIME_PAY",
        status: { not: "POSTED" },
      },
    },
    include: {
      project: { select: { name: true } },
      client: { select: { name: true } },
      holderEmployee: {
        select: { firstName: true, lastName: true, employeeNo: true },
      },
      relatedEmployee: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
  });

  const byHolder = new Map<
    string,
    {
      employeeId: string | null;
      name: string;
      employeeNo: string | null;
      rows: PettyCashHolderEntryView[];
    }
  >();

  for (const entry of entries) {
    if (!entry.holderEmployeeId || !entry.holderEmployee) continue;
    const holderId = entry.holderEmployeeId;
    const current = byHolder.get(holderId) ?? {
      employeeId: entry.holderEmployeeId,
      name: formatEmployeeName(entry.holderEmployee),
      employeeNo: entry.holderEmployee.employeeNo ?? null,
      rows: [],
    };
    current.rows.push({
      id: entry.id,
      kind: entry.kind,
      status: entry.status,
      amount: decimalToNumber(entry.amount) ?? 0,
      entryDate: dateKey(entry.entryDate),
      description: entry.description,
      proofPath: entry.proofPath,
      projectName: entry.project?.name ?? null,
      clientName: entry.client?.name ?? null,
      relatedEmployeeName: entry.relatedEmployee
        ? formatEmployeeName(entry.relatedEmployee)
        : null,
    });
    byHolder.set(holderId, current);
  }

  const holders = [...byHolder.entries()].map(([id, holder]) => ({
    id,
    employeeId: holder.employeeId,
    name: holder.name,
    employeeNo: holder.employeeNo,
    balance: holderBalanceFromEntries(holder.rows),
    entries: holder.rows,
  }));

  return holders.sort((left, right) => left.name.localeCompare(right.name));
}
