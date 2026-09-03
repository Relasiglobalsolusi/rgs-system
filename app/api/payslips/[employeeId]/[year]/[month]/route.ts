import { NextRequest, NextResponse } from "next/server";

import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import {
  loadEmployeePayslipMonth,
} from "@/lib/employee-payslips";
import { getServerLocale, localeToBcp47 } from "@/lib/i18n/locale";
import {
  snapshotToPayrollRows,
  getInternalPayrollLockRecord,
} from "@/lib/internal-payroll-lock";
import {
  toPayrollPdfEmployees,
  type InternalPayrollMonthRow,
} from "@/lib/internal-payroll-month";
import { buildInternalPayrollPdfBuffer } from "@/lib/internal-payroll-pdf";
import { formatPayrollPeriodRange } from "@/lib/internal-payroll-period";
import {
  canViewEmployeePayslip,
  loadPayslipAccess,
} from "@/lib/payslip-access";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ employeeId: string; year: string; month: string }> }
) {
  const access = await loadPayslipAccess();
  if (!access) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { employeeId, year: yearRaw, month: monthRaw } = await context.params;
  if (!canViewEmployeePayslip(employeeId, access)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    year < 2000 ||
    year > 2100
  ) {
    return NextResponse.json({ error: "Invalid year or month." }, { status: 400 });
  }

  const locale = await getServerLocale();
  const [lock, detail, company] = await Promise.all([
    getInternalPayrollLockRecord(
      access.session.user.companyId,
      year,
      month
    ),
    loadEmployeePayslipMonth({
      companyId: access.session.user.companyId,
      employeeId,
      year,
      month,
    }),
    loadCompanyForPdf(access.session.user.companyId),
  ]);

  const snapshotRows = snapshotToPayrollRows<InternalPayrollMonthRow>(
    lock?.snapshot ?? null
  );
  const snapshotRow =
    lock?.locked === true
      ? snapshotRows?.find((row) => row.employeeId === employeeId) ?? null
      : null;
  const row = snapshotRow ?? detail.row;
  if (!row) {
    return NextResponse.json(
      { error: "No payslip for this month." },
      { status: 404 }
    );
  }

  const periodLabel = formatPayrollPeriodRange(
    year,
    month,
    localeToBcp47(locale)
  );
  const buffer = await buildInternalPayrollPdfBuffer({
    year,
    month,
    periodLabel,
    employees: toPayrollPdfEmployees([row], locale),
    company,
    locale,
    title: locale === "id" ? "Slip Gaji" : "Payslip",
  });

  const filename = `Payslip-${row.employeeNo}-${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
