import {
  calculateBpjsBreakdown,
  type BpjsLine,
} from "@/lib/employee-bpjs";
import { formatEmployeeName } from "@/lib/employee-user-link";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import type { Prisma } from "@prisma/client";

export type BpjsPayableProgram = "kesehatan" | "ketenagakerjaan";

export type BpjsPayableLine = {
  key: BpjsLine["key"];
  wageBase: number;
  companyAmount: number;
  employeeAmount: number;
};

export type BpjsEmployeePayableRow = {
  id: string;
  employeeNo: string;
  name: string;
  hiredAt: Date | null;
  basePay: number;
  companyAmount: number;
  employeeAmount: number;
  lines: BpjsPayableLine[];
};

export type BpjsProgramPayable = {
  companyTotal: number;
  employeeCount: number;
};

export type BpjsPayableTotals = {
  kesehatan: BpjsProgramPayable;
  ketenagakerjaan: BpjsProgramPayable;
};

type EmployeeFinanceRow = {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  hiredAt: Date | null;
  basePay: Prisma.Decimal | null;
  bpjsKesehatanEnabled: boolean;
  bpjsKetenagakerjaanEnabled: boolean;
  jhtEnabled: boolean;
  jpEnabled: boolean;
  jkkEnabled: boolean;
  jkmEnabled: boolean;
  jkkPercent: Prisma.Decimal | null;
};

function programLines(
  lines: BpjsLine[],
  program: BpjsPayableProgram
): BpjsPayableLine[] {
  return lines
    .filter((line) =>
      program === "kesehatan" ? line.key === "kesehatan" : line.key !== "kesehatan"
    )
    .map((line) => ({
      key: line.key,
      wageBase: line.wageBase,
      companyAmount: line.companyAmount,
      employeeAmount: line.employeeAmount,
    }));
}

function toPayableRow(
  employee: EmployeeFinanceRow,
  program: BpjsPayableProgram
): BpjsEmployeePayableRow | null {
  if (program === "kesehatan" && !employee.bpjsKesehatanEnabled) return null;
  if (program === "ketenagakerjaan" && !employee.bpjsKetenagakerjaanEnabled) {
    return null;
  }

  const breakdown = calculateBpjsBreakdown({
    basePay: decimalToNumber(employee.basePay) ?? 0,
    bpjsKesehatanEnabled: employee.bpjsKesehatanEnabled,
    bpjsKetenagakerjaanEnabled: employee.bpjsKetenagakerjaanEnabled,
    jhtEnabled: employee.jhtEnabled,
    jpEnabled: employee.jpEnabled,
    jkkEnabled: employee.jkkEnabled,
    jkmEnabled: employee.jkmEnabled,
    jkkPercent: decimalToNumber(employee.jkkPercent),
  });
  const lines = programLines(breakdown.lines, program);
  if (lines.length === 0) return null;

  return {
    id: employee.id,
    employeeNo: employee.employeeNo,
    name: formatEmployeeName(employee),
    hiredAt: employee.hiredAt,
    basePay: decimalToNumber(employee.basePay) ?? 0,
    companyAmount: lines.reduce((sum, line) => sum + line.companyAmount, 0),
    employeeAmount: lines.reduce((sum, line) => sum + line.employeeAmount, 0),
    lines,
  };
}

async function loadEnrolledEmployees(
  companyId: string
): Promise<EmployeeFinanceRow[]> {
  return prisma.employee.findMany({
    where: {
      companyId,
      archivedFromDirectory: false,
      status: "ACTIVE",
      employmentType: "FULL_TIME",
      OR: [
        { bpjsKesehatanEnabled: true },
        { bpjsKetenagakerjaanEnabled: true },
      ],
    },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
      hiredAt: true,
      basePay: true,
      bpjsKesehatanEnabled: true,
      bpjsKetenagakerjaanEnabled: true,
      jhtEnabled: true,
      jpEnabled: true,
      jkkEnabled: true,
      jkmEnabled: true,
      jkkPercent: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

function sumProgram(
  employees: EmployeeFinanceRow[],
  program: BpjsPayableProgram
): BpjsProgramPayable {
  const rows = employees
    .map((employee) => toPayableRow(employee, program))
    .filter((row): row is BpjsEmployeePayableRow => row != null);
  return {
    companyTotal: rows.reduce((sum, row) => sum + row.companyAmount, 0),
    employeeCount: rows.length,
  };
}

export async function getBpjsPayableTotals(
  companyId: string
): Promise<BpjsPayableTotals> {
  const employees = await loadEnrolledEmployees(companyId);
  return {
    kesehatan: sumProgram(employees, "kesehatan"),
    ketenagakerjaan: sumProgram(employees, "ketenagakerjaan"),
  };
}

export async function listBpjsPayableEmployees(
  companyId: string,
  program: BpjsPayableProgram
): Promise<BpjsEmployeePayableRow[]> {
  const employees = await loadEnrolledEmployees(companyId);
  return employees
    .map((employee) => toPayableRow(employee, program))
    .filter((row): row is BpjsEmployeePayableRow => row != null);
}

export async function getBpjsPayableEmployee(
  companyId: string,
  employeeId: string,
  program: BpjsPayableProgram
): Promise<BpjsEmployeePayableRow | null> {
  const rows = await listBpjsPayableEmployees(companyId, program);
  return rows.find((row) => row.id === employeeId) ?? null;
}
