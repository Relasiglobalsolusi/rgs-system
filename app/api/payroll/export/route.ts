import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import { getServerLocale, localeToBcp47 } from "@/lib/i18n/locale";
import {
  getInternalPayrollLockRecord,
  snapshotToPayrollRows,
} from "@/lib/internal-payroll-lock";
import {
  toPayrollPdfEmployees,
  type InternalPayrollMonthRow,
} from "@/lib/internal-payroll-month";
import { buildInternalPayrollPdfBuffer } from "@/lib/internal-payroll-pdf";
import {
  formatPayrollPeriodRange,
  isPayrollPeriodReconciled,
  parsePayrollRunKind,
} from "@/lib/internal-payroll-period";
import { canAccess } from "@/lib/permissions";
import { toPermissionUser } from "@/lib/session";
import { jakartaYearMonth } from "@/lib/vat";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = toPermissionUser(session);
  if (
    !canAccess(user, "payroll")
  ) {
    return NextResponse.json(
      { error: "You do not have permission to access Internal Payroll." },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const now = jakartaYearMonth();
  const run = parsePayrollRunKind(searchParams.get("run"));
  const year = Number(searchParams.get("year")) || now.year;
  const month = Number(searchParams.get("month")) || now.month;

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    year < 2000 ||
    year > 2100
  ) {
    return NextResponse.json(
      { error: "Invalid year or month." },
      { status: 400 }
    );
  }

  try {
    const locale = await getServerLocale();
    const [company, existingLock] = await Promise.all([
      loadCompanyForPdf(session.user.companyId),
      getInternalPayrollLockRecord(session.user.companyId, year, month, run),
    ]);
    let rows: InternalPayrollMonthRow[];

    if (existingLock?.locked) {
      const frozenRows = snapshotToPayrollRows<InternalPayrollMonthRow>(
        existingLock.snapshot
      );
      if (!frozenRows) {
        return NextResponse.json(
          {
            error:
              "The locked payroll snapshot is missing. Request an unlock and generate this period again.",
          },
          { status: 409 }
        );
      }
      rows = frozenRows;
    } else {
      if (!isPayrollPeriodReconciled(year, month, new Date(), run)) {
        return NextResponse.json(
          {
            error:
              "This payroll run has not finished yet. Review and generate it only after the pay-period closing day.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error:
            "Generate and lock this payroll period first. The PDF is built from the locked snapshot.",
        },
        { status: 409 }
      );
    }

    const periodLabel = formatPayrollPeriodRange(
      year,
      month,
      localeToBcp47(locale),
      run
    );

    const buffer = await buildInternalPayrollPdfBuffer({
      year,
      month,
      periodLabel,
      employees: toPayrollPdfEmployees(rows, locale),
      company,
      locale,
    });

    const filename = `internal-payroll-${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/payroll/export]", error);
    return NextResponse.json(
      { error: "Could not generate the Internal Payroll PDF. Please try again." },
      { status: 500 }
    );
  }
}
