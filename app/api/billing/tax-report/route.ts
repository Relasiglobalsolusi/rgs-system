import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import {
  financePeriodFilenameStamp,
  parseFinancePeriod,
} from "@/lib/finance-period";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { canAccess } from "@/lib/permissions";
import { toPermissionUser } from "@/lib/session";
import { buildTaxReportPdfBuffer } from "@/lib/tax-report-pdf";
import { loadVatTaxWorkspace } from "@/lib/vat-ledger";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.user.clientId || session.user.vendorId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const user = toPermissionUser(session);
  if (!canAccess(user, "taxInvoices")) {
    return NextResponse.json(
      { error: "You do not have permission to download the Tax Report." },
      { status: 403 }
    );
  }

  const period = parseFinancePeriod({
    year: request.nextUrl.searchParams.get("year") ?? undefined,
    month: request.nextUrl.searchParams.get("month") ?? undefined,
  });
  const year = period.year;
  const month = period.month;

  try {
    const locale = await getServerLocale();
    const t = createTranslator(locale);
    const [workspace, company] = await Promise.all([
      loadVatTaxWorkspace({
        companyId: session.user.companyId,
        year,
        month,
        t,
      }),
      loadCompanyForPdf(session.user.companyId),
    ]);

    const periodLabel =
      month == null
        ? t("pages.vat.taxReportPeriodYear", { year: String(year) })
        : t("pages.vat.taxReportPeriodMonth", {
            month: t(`pages.reports.months.${month}`),
            year: String(year),
          });

    const buffer = await buildTaxReportPdfBuffer({
      periodLabel,
      outputTotal: workspace.outputTotal,
      inputTotal: workspace.inputTotal,
      net: workspace.net,
      creditBroughtForward: workspace.creditBroughtForward,
      outputRows: workspace.outputRows,
      inputRows: workspace.inputRows,
      incomeRows: workspace.incomeRows,
      otherRows: workspace.otherRows,
      company,
      locale,
    });

    const filename = `Tax-Report_${financePeriodFilenameStamp({
      year,
      month,
      day: null,
    })}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/billing/tax-report]", error);
    return NextResponse.json(
      { error: "Could not generate the Tax Report PDF. Please try again." },
      { status: 500 }
    );
  }
}
