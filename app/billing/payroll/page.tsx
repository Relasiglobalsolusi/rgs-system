import { redirect } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import PageIntro from "@/components/i18n/PageIntro";
import PayrollPanel, { type PayrollRow } from "@/components/billing/PayrollPanel";
import { calculateBpjsBreakdown } from "@/lib/employee-bpjs";
import { prisma } from "@/lib/prisma";
import {
  isClientPortalUser,
  isVendorPortalUser,
} from "@/lib/project-access";
import { decimalToNumber } from "@/lib/project-billing";
import { requireFinanceChild, toPermissionUser } from "@/lib/session";
import { jakartaYearMonth, utcRangeForJakartaMonth } from "@/lib/vat";

type SearchParams = Promise<{ year?: string; month?: string }>;

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFinanceChild("payroll");
  const user = toPermissionUser(session);
  if (isClientPortalUser(user) || isVendorPortalUser(user)) {
    redirect("/billing");
  }

  const params = await searchParams;
  const nowYm = jakartaYearMonth();
  const year = Math.max(2000, Math.min(2100, Number(params.year) || nowYm.year));
  const month = Math.max(1, Math.min(12, Number(params.month) || nowYm.month));

  const { start, endExclusive } = utcRangeForJakartaMonth(year, month);
  const companyId = session.user.companyId;

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      basePay: { not: null },
    },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
      basePay: true,
      bpjsKesehatanEnabled: true,
      bpjsKetenagakerjaanEnabled: true,
      jhtEnabled: true,
      jpEnabled: true,
      jkkEnabled: true,
      jkmEnabled: true,
      jkkPercent: true,
      _count: {
        select: {
          attendances: {
            where: {
              date: { gte: start, lt: endExclusive },
              checkIn: { not: null },
              checkOut: { not: null },
            },
          },
        },
      },
    },
    orderBy: [{ employeeNo: "asc" }],
  });

  const WORKING_DAYS_DIVISOR = 26;

  const rows: PayrollRow[] = employees.map((emp) => {
    const basePay = decimalToNumber(emp.basePay) ?? 0;
    const dailyRate = Math.round(basePay / WORKING_DAYS_DIVISOR);
    const daysWorked = emp._count.attendances;
    const wage = dailyRate * daysWorked;

    const bpjs = calculateBpjsBreakdown({
      basePay,
      bpjsKesehatanEnabled: emp.bpjsKesehatanEnabled,
      bpjsKetenagakerjaanEnabled: emp.bpjsKetenagakerjaanEnabled,
      jhtEnabled: emp.jhtEnabled,
      jpEnabled: emp.jpEnabled,
      jkkEnabled: emp.jkkEnabled,
      jkmEnabled: emp.jkmEnabled,
      jkkPercent: decimalToNumber(emp.jkkPercent),
    });

    const bpjsKesehatan =
      bpjs.lines.find((l) => l.key === "kesehatan")?.employeeAmount ?? 0;
    const bpjsTk = bpjs.lines
      .filter((l) => l.key === "jht" || l.key === "jp")
      .reduce((sum, l) => sum + l.employeeAmount, 0);

    const totalDeduction = bpjsKesehatan + bpjsTk;
    const netPay = wage - totalDeduction;

    return {
      employeeId: emp.id,
      employeeNo: emp.employeeNo,
      firstName: emp.firstName,
      lastName: emp.lastName,
      basePay,
      dailyRate,
      daysWorked,
      wage,
      bpjsKesehatan,
      bpjsTk,
      totalDeduction,
      netPay,
    };
  });

  return (
    <AppShell
      titleKey="pages.payroll.title"
      descriptionKey="pages.payroll.description"
    >
      <PageIntro
        titleKey="pages.payroll.directoryTitle"
        descriptionKey="pages.payroll.directoryDesc"
      />

      <PayrollPanel year={year} month={month} rows={rows} />
    </AppShell>
  );
}
