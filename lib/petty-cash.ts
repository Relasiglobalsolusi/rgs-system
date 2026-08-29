import type { Prisma } from "@prisma/client";

import { jakartaTodayAsUtcDateOnly } from "@/lib/leave-employment-status";
import { formatDateInput, parseDateInput, toUtcDateOnly } from "@/lib/invoice-period";
import { formatEmployeeName } from "@/lib/employee-user-link";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatContractPrice } from "@/lib/project-billing";

export type PettyCashDb = Pick<Prisma.TransactionClient, "pettyCashEntry">;

function pettyCashDelegate(db?: PettyCashDb) {
  return db?.pettyCashEntry ?? prisma.pettyCashEntry;
}

const OUTFLOW_KINDS = ["SPEND", "PART_TIME_PAY"] as const;
const INFLOW_KINDS = ["TOP_UP"] as const;
const HOLDER_INFLOW_KINDS = ["TOP_UP", "TRANSFER_IN"] as const;
const HOLDER_OUTFLOW_KINDS = ["SPEND", "TRANSFER_OUT", "PART_TIME_PAY"] as const;

export function pettyCashTopUpDescription(opts: {
  employeeName: string;
  invoiceRef: string;
  notes?: string | null;
}) {
  const note = opts.notes?.trim() ?? "";
  const base = `Top Up Petty Cash · ${opts.employeeName}`;
  if (note && note !== "Petty Cash top-up") {
    return `${base} · ${note} · ${opts.invoiceRef}`;
  }
  return `${base} · ${opts.invoiceRef}`;
}

export function pettyCashTransferOutDescription(toName: string, note?: string | null) {
  const trimmed = note?.trim() ?? "";
  return trimmed
    ? `Transfer Petty Cash to ${toName} · ${trimmed}`
    : `Transfer Petty Cash to ${toName}`;
}

export function pettyCashTransferInDescription(fromName: string, note?: string | null) {
  const trimmed = note?.trim() ?? "";
  return trimmed
    ? `Transfer Petty Cash from ${fromName} · ${trimmed}`
    : `Transfer Petty Cash from ${fromName}`;
}

export function pettyCashPartTimePaidDescription(opts: {
  existingDescription: string;
  payerName: string;
}) {
  const base = opts.existingDescription.replace(/\s·\sPaid from .+$/, "").trim();
  return `${base} · Paid from ${opts.payerName}`;
}

export function holderBalanceFromEntries(
  entries: Array<{ kind: string; status: string; amount: number }>
): number {
  return entries.reduce((sum, entry) => {
    if (entry.status !== "POSTED") return sum;
    if ((HOLDER_INFLOW_KINDS as readonly string[]).includes(entry.kind)) {
      return sum + entry.amount;
    }
    if ((HOLDER_OUTFLOW_KINDS as readonly string[]).includes(entry.kind)) {
      return sum - entry.amount;
    }
    return sum;
  }, 0);
}

export function parsePettyCashAmount(raw: string): number {
  const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) {
    throw new Error("Enter a valid amount.");
  }
  let normalized = cleaned;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const parts = cleaned.split(",");
    normalized =
      parts.length === 2 && parts[1]!.length <= 2
        ? `${parts[0]!.replace(/\./g, "")}.${parts[1]}`
        : cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }
  const num = Number(normalized);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error("Enter a valid amount.");
  }
  return Math.round(num);
}


function eachUtcDateInclusive(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cursor = toUtcDateOnly(start);
  const last = toUtcDateOnly(end);
  if (cursor.getTime() > last.getTime()) return days;
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor);
    cursor = new Date(Date.UTC(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth(),
      cursor.getUTCDate() + 1
    ));
  }
  return days;
}

export function isBackupAssignmentActiveOnJakartaDay(assignment: {
  isBackup: boolean;
  backupStartDate?: Date | null;
  backupEndDate?: Date | null;
}, referenceDate: Date = new Date()): boolean {
  if (!assignment.isBackup) return true;
  if (!assignment.backupStartDate || !assignment.backupEndDate) return false;
  const today = jakartaTodayAsUtcDateOnly(referenceDate);
  const start = toUtcDateOnly(assignment.backupStartDate);
  const end = toUtcDateOnly(assignment.backupEndDate);
  return today.getTime() >= start.getTime() && today.getTime() <= end.getTime();
}

/**
 * Backup still holds this project until the end date (inclusive).
 * After that Jakarta day they are free for another site. Regulars always occupy.
 */
export function isBackupAssignmentOccupyingProject(
  assignment: {
    isBackup: boolean;
    backupEndDate?: Date | null;
  },
  referenceDate: Date = new Date()
): boolean {
  if (!assignment.isBackup) return true;
  if (!assignment.backupEndDate) return false;
  return (
    toUtcDateOnly(assignment.backupEndDate).getTime() >=
    jakartaTodayAsUtcDateOnly(referenceDate).getTime()
  );
}

/** Regular assignments, plus backups whose end date has not passed. */
export function occupyingProjectAssignmentWhere(
  referenceDate: Date = new Date()
): Prisma.ProjectAssignmentWhereInput {
  const today = jakartaTodayAsUtcDateOnly(referenceDate);
  return {
    OR: [
      { isBackup: false },
      { isBackup: true, backupEndDate: { gte: today } },
    ],
  };
}

export function buildPartTimePayDescription(opts: {
  projectName: string;
  employeeFirstName: string;
  employeeLastName: string;
  employeeNo?: string | null;
  dailyRate: number;
}): string {
  const name = formatEmployeeName({
    firstName: opts.employeeFirstName,
    lastName: opts.employeeLastName,
  });
  const rate = formatContractPrice(opts.dailyRate);
  return `Backup · ${opts.projectName} · ${name} · Daily rate ${rate}`;
}

export async function mergeBackupEmployeeIds(
  db: Pick<Prisma.TransactionClient, "projectAssignment">,
  projectId: string,
  nextIds: string[]
): Promise<string[]> {
  const backups = await db.projectAssignment.findMany({
    where: { projectId, isBackup: true },
    select: { employeeId: true },
  });
  return [...new Set([...nextIds, ...backups.map((row) => row.employeeId)])];
}

export async function voidScheduledPartTimePays(
  db: PettyCashDb,
  opts: { projectId?: string; employeeIds: string[] }
): Promise<void> {
  const uniqueIds = [...new Set(opts.employeeIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;
  const entries = pettyCashDelegate(db);
  if (!entries) return;
  await entries.updateMany({
    where: {
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      employeeId: { in: uniqueIds },
      kind: "PART_TIME_PAY",
      status: "SCHEDULED",
    },
    data: { status: "VOIDED" },
  });
}

async function backupDayHasCompleteCico(opts: {
  employeeId: string;
  projectId: string;
  workDay: Date;
}): Promise<boolean> {
  const workDay = toUtcDateOnly(opts.workDay);
  const attendance = await prisma.attendance.findFirst({
    where: {
      employeeId: opts.employeeId,
      projectId: opts.projectId,
      date: workDay,
      checkIn: { not: null },
      checkOut: { not: null },
    },
    select: { id: true },
  });
  return Boolean(attendance);
}

function isBackupWorkDayInWindow(
  assignment: {
    isBackup: boolean;
    backupStartDate?: Date | null;
    backupEndDate?: Date | null;
  },
  workDay: Date
): boolean {
  if (!assignment.isBackup) return false;
  if (!assignment.backupStartDate || !assignment.backupEndDate) return false;
  const day = toUtcDateOnly(workDay).getTime();
  return (
    day >= toUtcDateOnly(assignment.backupStartDate).getTime() &&
    day <= toUtcDateOnly(assignment.backupEndDate).getTime()
  );
}

/**
 * After complete check-in and check-out, the day's wage floats as UNPAID.
 * Nobody's wallet is deducted until someone clicks Pay on Petty Cash.
 */
export async function tryPostPartTimePayForCompletedDay(opts: {
  db?: PettyCashDb;
  employeeId: string;
  projectId: string;
  workDay: Date;
}): Promise<boolean> {
  try {
    const workDay = toUtcDateOnly(opts.workDay);
    const ready = await backupDayHasCompleteCico({
      employeeId: opts.employeeId,
      projectId: opts.projectId,
      workDay,
    });
    if (!ready) return false;

    const assignment = await prisma.projectAssignment.findFirst({
      where: {
        employeeId: opts.employeeId,
        projectId: opts.projectId,
        isBackup: true,
      },
      select: {
        id: true,
        isBackup: true,
        backupStartDate: true,
        backupEndDate: true,
        dailyRate: true,
        employee: { select: { firstName: true, lastName: true } },
        project: { select: { name: true, companyId: true } },
      },
    });
    if (!assignment || !isBackupWorkDayInWindow(assignment, workDay)) {
      return false;
    }

    const entries = pettyCashDelegate(opts.db);
    if (!entries) return false;

    const existing = await entries.findFirst({
      where: {
        employeeId: opts.employeeId,
        projectId: opts.projectId,
        entryDate: workDay,
        kind: "PART_TIME_PAY",
        status: { in: ["SCHEDULED", "POSTED"] },
      },
      select: { id: true, status: true },
    });
    if (existing?.status === "POSTED" || existing?.status === "UNPAID") {
      return true;
    }
    if (existing?.status === "SCHEDULED") {
      await entries.update({
        where: { id: existing.id },
        data: { status: "UNPAID", postedAt: null },
      });
      return true;
    }

    const amount = Math.round(decimalToNumber(assignment.dailyRate) ?? 0);
    if (amount <= 0) return false;

    await entries.create({
      data: {
        companyId: assignment.project.companyId,
        kind: "PART_TIME_PAY",
        status: "UNPAID",
        amount,
        entryDate: workDay,
        description: buildPartTimePayDescription({
          projectName: assignment.project.name,
          employeeFirstName: assignment.employee.firstName,
          employeeLastName: assignment.employee.lastName,
          dailyRate: amount,
        }),
        projectId: opts.projectId,
        employeeId: opts.employeeId,
        assignmentId: assignment.id,
        postedAt: null,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function processScheduledPettyCashPays(
  db: PettyCashDb,
  companyId: string,
  referenceDate: Date = new Date()
): Promise<number> {
  try {
    const entries = pettyCashDelegate(db);
    if (!entries?.findMany) return 0;
    const today = jakartaTodayAsUtcDateOnly(referenceDate);
    const due = await entries.findMany({
      where: {
        companyId,
        kind: "PART_TIME_PAY",
        status: "SCHEDULED",
        entryDate: { lte: today },
        employeeId: { not: null },
        projectId: { not: null },
      },
      select: { employeeId: true, projectId: true, entryDate: true },
    });
    let posted = 0;
    for (const row of due) {
      if (!row.employeeId || !row.projectId) continue;
      const ok = await tryPostPartTimePayForCompletedDay({
        db,
        employeeId: row.employeeId,
        projectId: row.projectId,
        workDay: row.entryDate,
      });
      if (ok) posted += 1;
    }
    return posted;
  } catch {
    return 0;
  }
}

export async function schedulePartTimePays(opts: {
  db: PettyCashDb;
  companyId: string;
  projectId: string;
  employeeId: string;
  assignmentId: string;
  createdById: string;
  projectName: string;
  employeeFirstName: string;
  employeeLastName: string;
  dailyRate: number;
  start: Date;
  end: Date;
}): Promise<void> {
  const days = eachUtcDateInclusive(opts.start, opts.end);
  if (days.length === 0) {
    throw new Error("Choose a valid backup date range.");
  }
  const amount = Math.round(opts.dailyRate);
  if (amount <= 0) {
    throw new Error("Enter a daily rate greater than zero.");
  }
  const description = buildPartTimePayDescription({
    projectName: opts.projectName,
    employeeFirstName: opts.employeeFirstName,
    employeeLastName: opts.employeeLastName,
    dailyRate: amount,
  });
  const entries = pettyCashDelegate(opts.db);
  if (!entries) {
    throw new Error("Petty Cash is not ready. Restart the app and try again.");
  }
  await entries.createMany({
    data: days.map((entryDate) => ({
      companyId: opts.companyId,
      kind: "PART_TIME_PAY" as const,
      status: "SCHEDULED" as const,
      amount,
      entryDate,
      description,
      projectId: opts.projectId,
      employeeId: opts.employeeId,
      assignmentId: opts.assignmentId,
      createdById: opts.createdById,
      postedAt: null,
    })),
  });
}

export type PettyCashTotals = {
  balance: number;
  lifetimeIn: number;
  monthIn: number;
  lifetimeOut: number;
  monthOut: number;
  upcomingOut: number;
  unpaidOut: number;
};

async function sumPosted(
  db: PettyCashDb,
  companyId: string,
  kinds: readonly string[],
  from?: Date,
  toExclusive?: Date
): Promise<number> {
  const entries = pettyCashDelegate(db);
  if (!entries) return 0;
  const agg = await entries.aggregate({
    where: {
      companyId,
      status: "POSTED",
      kind: { in: [...kinds] as Array<"TOP_UP" | "SPEND" | "PART_TIME_PAY"> },
      ...(from || toExclusive
        ? {
            entryDate: {
              ...(from ? { gte: from } : {}),
              ...(toExclusive ? { lt: toExclusive } : {}),
            },
          }
        : {}),
    },
    _sum: { amount: true },
  });
  return decimalToNumber(agg._sum.amount) ?? 0;
}

export async function getPettyCashTotals(
  db: PettyCashDb,
  companyId: string,
  monthStart: Date,
  monthEndExclusive: Date
): Promise<PettyCashTotals> {
  const [lifetimeIn, monthIn, lifetimeOut, monthOut, upcoming, unpaid] = await Promise.all([
    sumPosted(db, companyId, INFLOW_KINDS),
    sumPosted(db, companyId, INFLOW_KINDS, monthStart, monthEndExclusive),
    sumPosted(db, companyId, OUTFLOW_KINDS),
    sumPosted(db, companyId, OUTFLOW_KINDS, monthStart, monthEndExclusive),
    pettyCashDelegate(db)?.aggregate({
      where: {
        companyId,
        kind: "PART_TIME_PAY",
        status: "SCHEDULED",
      },
      _sum: { amount: true },
    }) ?? Promise.resolve(null),
    pettyCashDelegate(db)?.aggregate({
      where: {
        companyId,
        kind: "PART_TIME_PAY",
        status: "UNPAID",
      },
      _sum: { amount: true },
    }) ?? Promise.resolve(null),
  ]);
  return {
    balance: lifetimeIn - lifetimeOut,
    lifetimeIn,
    monthIn,
    lifetimeOut,
    monthOut,
    upcomingOut: decimalToNumber(upcoming?._sum.amount) ?? 0,
    unpaidOut: decimalToNumber(unpaid?._sum.amount) ?? 0,
  };
}

export async function getProjectPettyCashOutflowsByProjectIds(
  db: PettyCashDb,
  companyId: string,
  projectIds: string[],
  from?: Date,
  toExclusive?: Date
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (projectIds.length === 0) return totals;
  const entries = pettyCashDelegate(db);
  if (!entries) return totals;
  const groups = await entries.groupBy({
    by: ["projectId"],
    where: {
      companyId,
      projectId: { in: projectIds },
      status: "POSTED",
      kind: { in: [...OUTFLOW_KINDS] },
      ...(from || toExclusive
        ? {
            entryDate: {
              ...(from ? { gte: from } : {}),
              ...(toExclusive ? { lt: toExclusive } : {}),
            },
          }
        : {}),
    },
    _sum: { amount: true },
  });
  for (const row of groups) {
    if (!row.projectId) continue;
    totals.set(row.projectId, decimalToNumber(row._sum.amount) ?? 0);
  }
  return totals;
}

export async function getClientPettyCashOutflowsByClientIds(
  db: PettyCashDb,
  companyId: string,
  clientIds: string[],
  from?: Date,
  toExclusive?: Date
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (clientIds.length === 0) return totals;
  const entries = pettyCashDelegate(db);
  if (!entries) return totals;
  const groups = await entries.groupBy({
    by: ["clientId"],
    where: {
      companyId,
      clientId: { in: clientIds },
      projectId: null,
      status: "POSTED",
      kind: { in: [...OUTFLOW_KINDS] },
      ...(from || toExclusive
        ? {
            entryDate: {
              ...(from ? { gte: from } : {}),
              ...(toExclusive ? { lt: toExclusive } : {}),
            },
          }
        : {}),
    },
    _sum: { amount: true },
  });
  for (const row of groups) {
    if (!row.clientId) continue;
    totals.set(row.clientId, decimalToNumber(row._sum.amount) ?? 0);
  }
  return totals;
}

export function nextPettyCashTopUpRef(date: Date = new Date()): string {
  const day = formatDateInput(jakartaTodayAsUtcDateOnly(date)).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PC-${day}-${suffix}`;
}

export { parseDateInput };
