import type { BpjsProgram, Prisma } from "@prisma/client";

import {
  listBpjsPayableEmployees,
  type BpjsEmployeePayableRow,
  type BpjsPayableLine,
} from "@/lib/financial-report-bpjs";
import {
  getInternalPayrollLockRecord,
  snapshotToPayrollRows,
} from "@/lib/internal-payroll-lock";
import { jakartaYearMonthDay } from "@/lib/internal-payroll-period";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";

export type BpjsFinanceProgramKey = "kesehatan" | "ketenagakerjaan";

export function parseBpjsFinanceProgramKey(
  value: string | null | undefined
): BpjsFinanceProgramKey | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "kesehatan" || raw === "ketenagakerjaan") return raw;
  return null;
}

export function bpjsProgramFromKey(key: BpjsFinanceProgramKey): BpjsProgram {
  return key === "kesehatan" ? "KESEHATAN" : "KETENAGAKERJAAN";
}

/**
 * Paying BPJS Kesehatan remits that month's employee share.
 * Reduce held share by the kesehatan employee amount so it does not keep accumulating.
 */
export async function releaseBpjsKesehatanHeldShare(
  tx: Prisma.TransactionClient,
  companyId: string
) {
  const rows = await listBpjsPayableEmployees(companyId, "kesehatan");
  for (const row of rows) {
    const release = Math.round(row.employeeAmount ?? 0);
    if (release <= 0) continue;
    const employee = await tx.employee.findUnique({
      where: { id: row.id },
      select: { bpjsShareHeldIdr: true },
    });
    if (!employee) continue;
    const held = Math.round(decimalToNumber(employee.bpjsShareHeldIdr) ?? 0);
    const next = Math.max(0, held - release);
    if (next === held) continue;
    await tx.employee.update({
      where: { id: row.id },
      data: { bpjsShareHeldIdr: next },
    });
  }
}

export type BpjsFinanceProgramLine = {
  key: BpjsFinanceProgramKey;
  program: BpjsProgram;
  employeeCount: number;
  employeeShare: number;
  companyShare: number;
  holding: number;
  companyDue: number;
  alreadyPaid: number;
  remaining: number;
  overdue: boolean;
};

export type BpjsFinanceRemittanceRow = {
  id: string;
  program: BpjsProgram;
  amount: number;
  paidAt: Date;
  reference: string | null;
  notes: string | null;
  purchaseInvoiceId: string | null;
};

export type BpjsFinancePeriodSnapshot = {
  year: number;
  month: number;
  dueDate: Date;
  overdue: boolean;
  holding: number;
  dueThisPeriod: number;
  overdueAmount: number;
  alreadyPaid: number;
  lines: BpjsFinanceProgramLine[];
  remittances: BpjsFinanceRemittanceRow[];
  /** Locked Internal Payroll snapshot supplies withheld employee amounts. */
  holdingSource: "payroll-lock" | "enrollment";
};

export type BpjsProgramEmployeeRow = {
  id: string;
  employeeNo: string;
  name: string;
  hiredAt: Date | null;
  basePay: number;
  employeeShare: number;
  companyShare: number;
  total: number;
  components: BpjsPayableLine[];
};

export type BpjsFinanceProgramDetail = {
  year: number;
  month: number;
  dueDate: Date;
  overdue: boolean;
  holdingSource: BpjsFinancePeriodSnapshot["holdingSource"];
  line: BpjsFinanceProgramLine;
  employees: BpjsProgramEmployeeRow[];
  remittances: BpjsFinanceRemittanceRow[];
};

export type BpjsFinanceEmployeeDetail = {
  year: number;
  month: number;
  dueDate: Date;
  holdingSource: BpjsFinancePeriodSnapshot["holdingSource"];
  programKey: BpjsFinanceProgramKey;
  employee: BpjsProgramEmployeeRow;
};

type PayrollBpjsSnapshotRow = {
  bpjsKesehatan?: number;
  bpjsTk?: number;
};

export function currentBpjsPeriod(now: Date = new Date()): {
  year: number;
  month: number;
} {
  const today = jakartaYearMonthDay(now);
  return { year: today.year, month: today.month };
}

/** Statutory remittance date: 15th of the following Jakarta calendar month. */
export function bpjsStatutoryDueDate(
  year: number,
  month: number
): Date {
  if (month >= 12) {
    return new Date(Date.UTC(year + 1, 0, 15));
  }
  return new Date(Date.UTC(year, month, 15));
}

export function isBpjsPeriodOverdue(
  year: number,
  month: number,
  now: Date = new Date()
): boolean {
  const due = bpjsStatutoryDueDate(year, month);
  const dueParts = jakartaYearMonthDay(due);
  const today = jakartaYearMonthDay(now);
  if (today.year !== dueParts.year) return today.year > dueParts.year;
  if (today.month !== dueParts.month) return today.month > dueParts.month;
  return today.day > dueParts.day;
}

/**
 * Remittance clears employee holding first, then company share.
 * Holding is a liability (withheld wages), not company cost.
 */
function allocateBpjsRemittance(options: {
  employeeShare: number;
  companyShare: number;
  paid: number;
}): {
  holding: number;
  companyDue: number;
  remaining: number;
} {
  const employeeShare = Math.max(0, Math.round(options.employeeShare));
  const companyShare = Math.max(0, Math.round(options.companyShare));
  const paid = Math.max(0, Math.round(options.paid));
  const paidToEmployee = Math.min(employeeShare, paid);
  const paidToCompany = Math.min(
    companyShare,
    Math.max(0, paid - employeeShare)
  );
  const holding = employeeShare - paidToEmployee;
  const companyDue = companyShare - paidToCompany;
  return {
    holding,
    companyDue,
    remaining: holding + companyDue,
  };
}

function snapshotProgramHolding(
  rows: PayrollBpjsSnapshotRow[] | null,
  program: BpjsFinanceProgramKey
): number | null {
  if (!rows || rows.length === 0) return null;
  const total = rows.reduce((sum, row) => {
    const amount =
      program === "kesehatan" ? row.bpjsKesehatan ?? 0 : row.bpjsTk ?? 0;
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  return Math.round(total);
}

export async function getBpjsFinancePeriod(
  companyId: string,
  year: number,
  month: number
): Promise<BpjsFinancePeriodSnapshot> {
  const dueDate = bpjsStatutoryDueDate(year, month);
  const overdue = isBpjsPeriodOverdue(year, month);

  const [kesehatanRows, ketenagakerjaanRows, remittanceRows, lock] =
    await Promise.all([
      listBpjsPayableEmployees(companyId, "kesehatan"),
      listBpjsPayableEmployees(companyId, "ketenagakerjaan"),
      prisma.bpjsRemittance.findMany({
        where: { companyId, year, month },
        select: {
          id: true,
          program: true,
          amount: true,
          paidAt: true,
          reference: true,
          notes: true,
          purchaseInvoiceId: true,
        },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      }),
      getInternalPayrollLockRecord(companyId, year, month),
    ]);

  const payrollSnapshot = lock?.locked
    ? snapshotToPayrollRows<PayrollBpjsSnapshotRow>(lock.snapshot)
    : null;
  const snapshotHoldingKesehatan = snapshotProgramHolding(
    payrollSnapshot,
    "kesehatan"
  );
  const snapshotHoldingTk = snapshotProgramHolding(
    payrollSnapshot,
    "ketenagakerjaan"
  );
  const holdingSource: BpjsFinancePeriodSnapshot["holdingSource"] =
    snapshotHoldingKesehatan != null || snapshotHoldingTk != null
      ? "payroll-lock"
      : "enrollment";

  const remittances: BpjsFinanceRemittanceRow[] = remittanceRows.map((row) => ({
    id: row.id,
    program: row.program,
    amount: decimalToNumber(row.amount) ?? 0,
    paidAt: row.paidAt,
    reference: row.reference,
    notes: row.notes,
    purchaseInvoiceId: row.purchaseInvoiceId,
  }));

  const paidByProgram: Record<BpjsProgram, number> = {
    KESEHATAN: 0,
    KETENAGAKERJAAN: 0,
  };
  for (const row of remittances) {
    paidByProgram[row.program] += row.amount;
  }

  const kesehatanEmployeeShare =
    snapshotHoldingKesehatan ??
    kesehatanRows.reduce((sum, row) => sum + row.employeeAmount, 0);
  const ketenagakerjaanEmployeeShare =
    snapshotHoldingTk ??
    ketenagakerjaanRows.reduce((sum, row) => sum + row.employeeAmount, 0);

  const lines: BpjsFinanceProgramLine[] = [
    buildProgramLine({
      key: "kesehatan",
      program: "KESEHATAN",
      employeeCount: kesehatanRows.length,
      employeeShare: kesehatanEmployeeShare,
      companyShare: kesehatanRows.reduce(
        (sum, row) => sum + row.companyAmount,
        0
      ),
      alreadyPaid: paidByProgram.KESEHATAN,
      overdue,
    }),
    buildProgramLine({
      key: "ketenagakerjaan",
      program: "KETENAGAKERJAAN",
      employeeCount: ketenagakerjaanRows.length,
      employeeShare: ketenagakerjaanEmployeeShare,
      companyShare: ketenagakerjaanRows.reduce(
        (sum, row) => sum + row.companyAmount,
        0
      ),
      alreadyPaid: paidByProgram.KETENAGAKERJAAN,
      overdue,
    }),
  ];

  const holding = lines.reduce((sum, line) => sum + line.holding, 0);
  const dueThisPeriod = lines.reduce((sum, line) => sum + line.remaining, 0);
  const alreadyPaid = lines.reduce((sum, line) => sum + line.alreadyPaid, 0);

  return {
    year,
    month,
    dueDate,
    overdue,
    holding,
    dueThisPeriod,
    overdueAmount: overdue ? dueThisPeriod : 0,
    alreadyPaid,
    lines,
    remittances,
    holdingSource,
  };
}

type PayrollEmployeeBpjsRow = PayrollBpjsSnapshotRow & {
  employeeId?: string;
};

function lockedEmployeeShare(
  rows: PayrollEmployeeBpjsRow[] | null,
  employeeId: string,
  program: BpjsFinanceProgramKey
): number | null {
  if (!rows) return null;
  const row = rows.find((item) => item.employeeId === employeeId);
  if (!row) return null;
  const amount =
    program === "kesehatan" ? row.bpjsKesehatan ?? 0 : row.bpjsTk ?? 0;
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
}

function toProgramEmployee(
  row: BpjsEmployeePayableRow,
  lockedShare: number | null
): BpjsProgramEmployeeRow {
  const employeeShare = lockedShare ?? Math.round(row.employeeAmount);
  const companyShare = Math.round(row.companyAmount);
  return {
    id: row.id,
    employeeNo: row.employeeNo,
    name: row.name,
    hiredAt: row.hiredAt,
    basePay: row.basePay,
    employeeShare,
    companyShare,
    total: employeeShare + companyShare,
    components: row.lines,
  };
}

export async function getBpjsFinanceProgramDetail(
  companyId: string,
  year: number,
  month: number,
  programKey: BpjsFinanceProgramKey
): Promise<BpjsFinanceProgramDetail> {
  const period = await getBpjsFinancePeriod(companyId, year, month);
  const line = period.lines.find((item) => item.key === programKey);
  if (!line) {
    throw new Error("Choose BPJS Kesehatan or BPJS Ketenagakerjaan.");
  }

  const [employees, lock] = await Promise.all([
    listBpjsPayableEmployees(companyId, programKey),
    getInternalPayrollLockRecord(companyId, year, month),
  ]);
  const payrollSnapshot = lock?.locked
    ? snapshotToPayrollRows<PayrollEmployeeBpjsRow>(lock.snapshot)
    : null;

  return {
    year,
    month,
    dueDate: period.dueDate,
    overdue: period.overdue,
    holdingSource: period.holdingSource,
    line,
    employees: employees.map((row) =>
      toProgramEmployee(
        row,
        lockedEmployeeShare(payrollSnapshot, row.id, programKey)
      )
    ),
    remittances: period.remittances.filter(
      (row) => row.program === bpjsProgramFromKey(programKey)
    ),
  };
}

export async function getBpjsFinanceEmployeeDetail(
  companyId: string,
  year: number,
  month: number,
  programKey: BpjsFinanceProgramKey,
  employeeId: string
): Promise<BpjsFinanceEmployeeDetail | null> {
  const program = await getBpjsFinanceProgramDetail(
    companyId,
    year,
    month,
    programKey
  );
  const employee = program.employees.find((row) => row.id === employeeId);
  if (!employee) return null;
  return {
    year,
    month,
    dueDate: program.dueDate,
    holdingSource: program.holdingSource,
    programKey,
    employee,
  };
}

function buildProgramLine(options: {
  key: BpjsFinanceProgramKey;
  program: BpjsProgram;
  employeeCount: number;
  employeeShare: number;
  companyShare: number;
  alreadyPaid: number;
  overdue: boolean;
}): BpjsFinanceProgramLine {
  const allocated = allocateBpjsRemittance({
    employeeShare: options.employeeShare,
    companyShare: options.companyShare,
    paid: options.alreadyPaid,
  });
  return {
    key: options.key,
    program: options.program,
    employeeCount: options.employeeCount,
    employeeShare: Math.round(options.employeeShare),
    companyShare: Math.round(options.companyShare),
    holding: allocated.holding,
    companyDue: allocated.companyDue,
    alreadyPaid: Math.round(options.alreadyPaid),
    remaining: allocated.remaining,
    overdue: options.overdue && allocated.remaining > 0,
  };
}
