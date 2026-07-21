import { NextRequest, NextResponse } from "next/server";

import { getMonthlyReport } from "@/app/reports/actions";
import { getCurrentSession } from "@/lib/auth";
import { getServerLocale } from "@/lib/i18n/locale";
import { formatMonthLabel } from "@/lib/monthly-report";
import { buildMonthlyReportPdfBuffer } from "@/lib/monthly-report-pdf";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isProjectSubCategory } from "@/lib/project-subcategory";
import { toPermissionUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = toPermissionUser(session);
  if (!canAccess(user, "reports")) {
    return NextResponse.json(
      { error: "You do not have permission to access reports." },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getFullYear();
  const month = Number(searchParams.get("month")) || now.getMonth() + 1;

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

  const subCategoryParam = searchParams.get("subCategory") ?? undefined;
  const subCategory =
    subCategoryParam && isProjectSubCategory(subCategoryParam)
      ? subCategoryParam
      : undefined;
  const q = searchParams.get("q")?.trim() || undefined;

  try {
    const [report, company] = await Promise.all([
      getMonthlyReport(year, month, { subCategory, q }),
      prisma.company.findUnique({
        where: { id: session.user.companyId },
        select: {
          name: true,
          email: true,
          phone: true,
          address: true,
        },
      }),
    ]);

    const locale = await getServerLocale();
    const periodLabel = formatMonthLabel(year, month, locale);
    const buffer = await buildMonthlyReportPdfBuffer({
      year,
      month,
      periodLabel,
      projects: report.projects,
      company,
      locked: report.locked,
      locale,
    });

    const filename = `monthly-report-${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/reports/monthly-export]", error);
    return NextResponse.json(
      { error: "Could not generate the monthly report PDF. Please try again." },
      { status: 500 }
    );
  }
}
