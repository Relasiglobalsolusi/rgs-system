import { NextRequest, NextResponse } from "next/server";

import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/lib/auth";
import { getServerLocale, localeToBcp47 } from "@/lib/i18n/locale";
import {
  getInternalPayrollLockRecord,
  lockInternalPayrollPeriod,
} from "@/lib/internal-payroll-lock";
import {
  loadInternalPayrollMonth,
  toPayrollPdfEmployees,
} from "@/lib/internal-payroll-month";
import { buildInternalPayrollPdfBuffer } from "@/lib/internal-payroll-pdf";
import { formatPayrollPeriodRange } from "@/lib/internal-payroll-period";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
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
    const [rows, company, existingLock] = await Promise.all([
      loadInternalPayrollMonth({
        companyId: session.user.companyId,
        year,
        month,
      }),
      prisma.company.findUnique({
        where: { id: session.user.companyId },
        select: {
          name: true,
          email: true,
          phone: true,
          address: true,
        },
      }),
      getInternalPayrollLockRecord(session.user.companyId, year, month),
    ]);

    if (!existingLock?.locked) {
      const actorName =
        session.user.name?.trim() ||
        (typeof session.user.username === "string"
          ? session.user.username
          : "") ||
        "Head Office";
      await lockInternalPayrollPeriod({
        companyId: session.user.companyId,
        year,
        month,
        actor: { id: session.user.id, name: actorName },
        snapshot: rows,
      });
      revalidatePath("/billing/payroll");
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
