import {
  calculateThrAmount,
  getIdulFitriDate,
  isWithinThrGenerateWindow,
  resolveThrTargetYear,
  tenureMonthsAt,
  utcToday,
} from "@/lib/employee-thr";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";

export type ThrGenerateResult = {
  year: number;
  hariRayaDate: Date;
  created: number;
  updated: number;
  skipped: number;
  inWindow: boolean;
};

/**
 * Idempotent THR generation for a company/year.
 * Skips employees without base pay, tenure &lt; 1 month, or PAID rows.
 * Updates DRAFT/GENERATED rows when regenerating.
 */
export async function generateThrPaymentsForCompany(
  companyId: string,
  options?: { year?: number; forceOutsideWindow?: boolean }
): Promise<ThrGenerateResult> {
  const today = utcToday();
  const year = options?.year ?? resolveThrTargetYear(today);
  if (year == null) {
    throw new Error("Could not resolve an Idul Fitri date for the target year.");
  }

  const hariRayaDate = getIdulFitriDate(year);
  if (!hariRayaDate) {
    throw new Error(`Could not compute Idul Fitri date for ${year}.`);
  }

  const inWindow = isWithinThrGenerateWindow(hariRayaDate, today);
  if (!inWindow && !options?.forceOutsideWindow) {
    return {
      year,
      hariRayaDate,
      created: 0,
      updated: 0,
      skipped: 0,
      inWindow: false,
    };
  }

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      status: { in: ["ACTIVE", "ON_LEAVE"] },
      archivedFromDirectory: false,
      basePay: { not: null },
    },
    select: {
      id: true,
      hiredAt: true,
      basePay: true,
      status: true,
    },
  });

  const existing = await prisma.thrPayment.findMany({
    where: { companyId, year },
    select: { employeeId: true, status: true },
  });
  const existingByEmployee = new Map(
    existing.map((row) => [row.employeeId, row.status])
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const employee of employees) {
    const basePay = decimalToNumber(employee.basePay) ?? 0;
    const tenureMonths = tenureMonthsAt(employee.hiredAt, hariRayaDate);
    const amount = calculateThrAmount(basePay, tenureMonths);

    if (basePay <= 0 || amount <= 0) {
      skipped += 1;
      continue;
    }

    const prior = existingByEmployee.get(employee.id);
    if (prior === "PAID") {
      skipped += 1;
      continue;
    }

    await prisma.thrPayment.upsert({
      where: {
        employeeId_year: { employeeId: employee.id, year },
      },
      create: {
        companyId,
        employeeId: employee.id,
        year,
        hariRayaDate,
        amount,
        basePaySnapshot: basePay,
        tenureMonths,
        status: "GENERATED",
        generatedAt: new Date(),
      },
      update: {
        hariRayaDate,
        amount,
        basePaySnapshot: basePay,
        tenureMonths,
        status: "GENERATED",
        generatedAt: new Date(),
      },
    });

    if (prior) updated += 1;
    else created += 1;
  }

  return { year, hariRayaDate, created, updated, skipped, inWindow };
}
