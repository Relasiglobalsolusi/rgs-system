import { NextRequest, NextResponse } from "next/server";

import { listInventorySales } from "@/app/inventory/actions";
import { getCurrentSession } from "@/lib/auth";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import {
  financePeriodFilenameStamp,
  financePeriodRange,
  parseFinancePeriod,
} from "@/lib/finance-period";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { canAccess } from "@/lib/permissions";
import { buildSalesReportPdfBuffer } from "@/lib/sales-report-pdf";
import { toPermissionUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.user.clientId || session.user.vendorId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const user = toPermissionUser(session);
  if (!canAccess(user, "sales")) {
    return NextResponse.json(
      { error: "You do not have permission to download the Sales Report." },
      { status: 403 }
    );
  }

  const period = parseFinancePeriod({
    year: request.nextUrl.searchParams.get("year") ?? undefined,
    month: request.nextUrl.searchParams.get("month") ?? undefined,
    day: request.nextUrl.searchParams.get("day") ?? undefined,
  });
  const { start, endExclusive } = financePeriodRange(period);

  try {
    const locale = await getServerLocale();
    const t = createTranslator(locale);
    const [sales, company] = await Promise.all([
      listInventorySales({ start, endExclusive, take: 2000 }),
      loadCompanyForPdf(session.user.companyId),
    ]);

    const periodLabel =
      period.month == null
        ? t("pages.sales.salesReportPeriodYear", { year: String(period.year) })
        : period.day != null
          ? t("pages.sales.salesReportPeriodDay", {
              day: String(period.day),
              month: t(`pages.reports.months.${period.month}`),
              year: String(period.year),
            })
          : t("pages.sales.salesReportPeriodMonth", {
              month: t(`pages.reports.months.${period.month}`),
              year: String(period.year),
            });

    const rows = sales.map((row) => ({
      soldAt: new Date(row.soldAt),
      itemName: row.item.name,
      buyer: row.buyer,
      totalPrice: row.totalPrice,
    }));

    const buffer = await buildSalesReportPdfBuffer({
      periodLabel,
      rows,
      totalAmount: rows.reduce((sum, row) => sum + row.totalPrice, 0),
      company,
      locale,
    });

    const filename = `Sales-Report_${financePeriodFilenameStamp(period)}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/billing/sales-report]", error);
    return NextResponse.json(
      { error: "Could not generate the Sales Report PDF. Please try again." },
      { status: 500 }
    );
  }
}
