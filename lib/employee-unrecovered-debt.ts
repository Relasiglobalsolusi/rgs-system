import type { Prisma, PrismaClient } from "@prisma/client";

import { parseDateInput } from "@/lib/invoice-period";
import { toDecimal } from "@/lib/inventory";
import { decimalToNumber } from "@/lib/project-billing";

type Db = PrismaClient | Prisma.TransactionClient;

const UNRECOVERED_DEDUCTION_TYPES = [
  "PENALTY",
  "OTHER",
  "LOST_STOCK",
  "CLIENT_COMPENSATION",
] as const;

const SHORTFALL_PAY_PREFIX = "[SHORTFALL_PAY:";
const SHORTFALL_EXPENSE_MARK = "[SHORTFALL_EXPENSE]";

export function encodeResignShortfallDirective(opts: {
  employeePaysRest: boolean;
  bankAccountId?: string | null;
  paidAt?: string | null;
  proofPath?: string | null;
  note: string;
}): string {
  const body = opts.note.trim();
  if (opts.employeePaysRest) {
    const bank = (opts.bankAccountId ?? "").trim();
    const paidAt = (opts.paidAt ?? "").trim();
    const proof = (opts.proofPath ?? "").trim();
    const payload = [bank, paidAt, proof].join("|");
    return `${SHORTFALL_PAY_PREFIX}${payload}]${body ? ` ${body}` : ""}`;
  }
  return `${SHORTFALL_EXPENSE_MARK}${body ? ` ${body}` : ""}`;
}

function parseResignShortfallDirective(note: string | null | undefined): {
  employeePaysRest: boolean;
  bankAccountId: string | null;
  paidAt: string | null;
  proofPath: string | null;
} | null {
  const raw = (note ?? "").trim();
  if (raw.startsWith(SHORTFALL_PAY_PREFIX)) {
    const close = raw.indexOf("]");
    if (close < 0) {
      return {
        employeePaysRest: true,
        bankAccountId: null,
        paidAt: null,
        proofPath: null,
      };
    }
    const inner = raw.slice(SHORTFALL_PAY_PREFIX.length, close);
    const [bank = "", paidAt = "", ...proofParts] = inner.split("|");
    return {
      employeePaysRest: true,
      bankAccountId: bank.trim() || null,
      paidAt: paidAt.trim() || null,
      proofPath: proofParts.join("|").trim() || null,
    };
  }
  if (raw.startsWith(SHORTFALL_EXPENSE_MARK)) {
    return {
      employeePaysRest: false,
      bankAccountId: null,
      paidAt: null,
      proofPath: null,
    };
  }
  return null;
}

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
      resignNote: true,
      projectAssignments: {
        select: { projectId: true },
        orderBy: { assignedAt: "desc" },
      },
    },
  });
  if (!employee) return;

  // Each month holds one lock per run, so the run is part of the key.
  const locks = await db.internalPayrollLock.findMany({
    where: { companyId: employee.companyId, locked: true },
    select: { year: true, month: true, run: true },
  });
  const lockedKeys = new Set(
    locks.map((row) => `${row.year}-${row.month}-${row.run}`)
  );

  const extraLines = await db.payrollDeduction.findMany({
    where: {
      employeeId,
      type: { in: [...UNRECOVERED_DEDUCTION_TYPES] },
    },
    select: { id: true, amount: true, year: true, month: true, run: true },
  });
  const unrecoveredLines = extraLines.filter(
    (row) => !lockedKeys.has(`${row.year}-${row.month}-${row.run}`)
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

  if (deposit > 0 && employee.depositStatus !== "RETURNED") {
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
  const depositForNet =
    employee.depositStatus === "RETURNED" ? 0 : deposit;
  const surplus = Math.max(0, depositForNet - owed);
  const shortfall = Math.max(0, owed - depositForNet);

  if (surplus > 0 && employee.depositStatus !== "RETURNED") {
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
    const directive = parseResignShortfallDirective(employee.resignNote);
    const employeePaysRest = directive?.employeePaysRest === true;
    if (employeePaysRest) {
      let bankLabel = "";
      let bankAccountId: string | null = null;
      if (directive?.bankAccountId) {
        const bank = await db.companyBankAccount.findFirst({
          where: {
            id: directive.bankAccountId,
            companyId: employee.companyId,
          },
          select: { id: true, bankName: true, accountNumber: true, label: true },
        });
        if (bank) {
          bankAccountId = bank.id;
          bankLabel = ` Received in ${bank.label || bank.bankName} ${bank.accountNumber}.`;
        }
      }
      let incurredAt: Date | undefined;
      if (directive?.paidAt) {
        try {
          incurredAt = parseDateInput(directive.paidAt);
        } catch {
          incurredAt = undefined;
        }
      }
      await db.projectExpense.create({
        data: {
          companyId: employee.companyId,
          projectId: targetProjectId,
          employeeId,
          category: "EMPLOYEE_PAYING_BALANCE_DUE",
          amount: toDecimal(-shortfall),
          reason: `Employee Paying Balance Due for ${name}. Shortfall of ${shortfall.toLocaleString("id-ID")} received after security deposit.${bankLabel}`,
          ...(incurredAt ? { incurredAt } : {}),
          proofPath: directive?.proofPath ?? null,
          bankAccountId,
        },
      });
    } else {
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
}
