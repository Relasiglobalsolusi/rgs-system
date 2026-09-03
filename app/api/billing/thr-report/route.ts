import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import { getIdulFitriDate, resolveThrTargetYear } from "@/lib/employee-thr";
import { formatEmployeeName } from "@/lib/employee-user-link";
import { getServerLocale } from "@/lib/i18n/locale";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { toPermissionUser } from "@/lib/session";
import { buildThrReportPdfBuffer } from "@/lib/thr-report-pdf";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.user.clientId || session.user.vendorId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const user = toPermissionUser(session);
  if (!canAccess(user, "thr")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const requestedYear = Number(request.nextUrl.searchParams.get("year"));
  const year = Number.isFinite(requestedYear)
    ? Math.max(2000, Math.min(2100, Math.round(requestedYear)))
    : resolveThrTargetYear() ?? new Date().getUTCFullYear();
  const locale = await getServerLocale();

  try {
    const [payments, company] = await Promise.all([
      prisma.thrPayment.findMany({
        where: { companyId: session.user.companyId, year },
        include: {
          employee: {
            select: { firstName: true, lastName: true, employeeNo: true },
          },
        },
        orderBy: [{ employee: { employeeNo: "asc" } }],
      }),
      loadCompanyForPdf(session.user.companyId),
    ]);

    const rows = payments.map((row) => ({
      employeeNo: row.employee.employeeNo,
      name: formatEmployeeName(row.employee),
      tenureMonths: row.tenureMonths,
      basePay: decimalToNumber(row.basePaySnapshot) ?? 0,
      amount: decimalToNumber(row.amount) ?? 0,
      status: row.status,
      paidAt: row.paidAt,
    }));

    const buffer = await buildThrReportPdfBuffer({
      year,
      periodLabel: `${year}`,
      hariRayaDate:
        payments[0]?.hariRayaDate ?? getIdulFitriDate(year) ?? null,
      rows,
      totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
      company,
      locale,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="thr-report-${year}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/billing/thr-report]", error);
    return NextResponse.json(
      { error: "Could not generate the THR Report PDF. Please try again." },
      { status: 500 }
    );
  }
}
