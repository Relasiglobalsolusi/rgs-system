import { NextRequest, NextResponse } from "next/server";

import { lockPayrollManagementPeriodForExport } from "@/app/billing/payroll-management-actions";
import { getCurrentSession } from "@/lib/auth";
import { getServerLocale, localeToBcp47 } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { buildInternalPayrollPdfBuffer } from "@/lib/internal-payroll-pdf";
import {
  formatPayrollManagementWindowLabel,
  payrollManagementWindowForCutoffMonth,
} from "@/lib/payroll-management";
import { reviewToPayrollPdfEmployees } from "@/lib/payroll-management-review";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { toPermissionUser } from "@/lib/session";
import { jakartaYearMonth } from "@/lib/vat";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = toPermissionUser(session);
  if (
    !canAccess(user, "invoicing") ||
    session.user.clientId ||
    session.user.vendorId
  ) {
    return NextResponse.json(
      { error: "You do not have permission to export Payroll Management." },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const now = jakartaYearMonth();
  const projectId = String(searchParams.get("projectId") ?? "").trim();
  const year = Number(searchParams.get("year")) || now.year;
  const month = Number(searchParams.get("month")) || now.month;

  if (
    !projectId ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    year < 2000 ||
    year > 2100
  ) {
    return NextResponse.json(
      { error: "Invalid project, year, or month." },
      { status: 400 }
    );
  }

  try {
    const locale = await getServerLocale();
    const actor =
      session.user.name?.trim() ||
      (typeof session.user.username === "string"
        ? session.user.username
        : "") ||
      "Head Office";
    const prepared = await lockPayrollManagementPeriodForExport({
      companyId: session.user.companyId,
      userId: session.user.id,
      actorName: actor,
      projectId,
      year,
      month,
    });
    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: {
        name: true,
        email: true,
        phone: true,
        address: true,
      },
    });

    const cutoffEnd = prepared.project.payrollCutoffEndDay ?? 1;
    const cutoffLabel = formatPayrollManagementWindowLabel(
      payrollManagementWindowForCutoffMonth({
        year,
        month,
        cutoffDay: cutoffEnd,
        contractStart: prepared.project.startDate,
        contractEnd: prepared.project.endDate,
      }),
      localeToBcp47(locale)
    );
    const title = translate(locale, "pages.billing.payrollMgmt.pdfTitle");
    const buffer = await buildInternalPayrollPdfBuffer({
      year,
      month,
      periodLabel: `${prepared.project.name} · ${cutoffLabel}`,
      employees: reviewToPayrollPdfEmployees(
        prepared.review,
        prepared.period.lines.map((line) => ({
          employeeName: line.employeeName,
          amount: decimalToNumber(line.amount) ?? 0,
          notes: line.notes,
        })),
        translate(locale, "pages.billing.payrollMgmt.clientAdjustment")
      ),
      company,
      locale,
      title,
    });

    const filename = `payroll-management-${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/payroll-management/export]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not generate the Payroll Management PDF.",
      },
      { status: 500 }
    );
  }
}
