import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import {
  buildFinancialReportPdfBuffer,
  loadFinancialReportPdfData,
} from "@/lib/financial-report-pdf";
import { parseFinancialReportSelection } from "@/lib/financial-report-query";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { canAccess } from "@/lib/permissions";
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
  if (!canAccess(user, "financialReport")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const selection = parseFinancialReportSelection({
    year: request.nextUrl.searchParams.get("year") ?? undefined,
    month: request.nextUrl.searchParams.get("month") ?? undefined,
    bank: request.nextUrl.searchParams.get("bank") ?? undefined,
  });
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const periodLabel =
    selection.month == null
      ? String(selection.year)
      : `${t(`pages.reports.months.${selection.month}`)} ${selection.year}`;

  try {
    const [data, company] = await Promise.all([
      loadFinancialReportPdfData(session.user.companyId, selection, locale),
      loadCompanyForPdf(session.user.companyId),
    ]);

    const buffer = await buildFinancialReportPdfBuffer({
      ...data,
      periodLabel,
      company,
      locale,
    });

    const filename =
      selection.month == null
        ? `financial-report-${selection.year}.pdf`
        : `financial-report-${selection.year}-${selection.month}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/billing/financial-report]", error);
    return NextResponse.json(
      { error: "Could not generate the Financial Report PDF. Please try again." },
      { status: 500 }
    );
  }
}
