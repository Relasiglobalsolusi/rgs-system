import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import {
  currentBpjsPeriod,
  getBpjsFinancePeriod,
  getBpjsFinanceProgramDetail,
} from "@/lib/bpjs-finance";
import { buildBpjsReportPdfBuffer } from "@/lib/bpjs-report-pdf";
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
  if (!canAccess(user, "bpjs")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const current = currentBpjsPeriod();
  const year = Math.max(
    2000,
    Math.min(2100, Number(request.nextUrl.searchParams.get("year")) || current.year)
  );
  const month = Math.max(
    1,
    Math.min(12, Number(request.nextUrl.searchParams.get("month")) || current.month)
  );
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  try {
    const [snapshot, kesehatan, ketenagakerjaan, company] = await Promise.all([
      getBpjsFinancePeriod(session.user.companyId, year, month),
      getBpjsFinanceProgramDetail(
        session.user.companyId,
        year,
        month,
        "kesehatan"
      ),
      getBpjsFinanceProgramDetail(
        session.user.companyId,
        year,
        month,
        "ketenagakerjaan"
      ),
      loadCompanyForPdf(session.user.companyId),
    ]);

    const buffer = await buildBpjsReportPdfBuffer({
      periodLabel: `${t(`pages.reports.months.${month}`)} ${year}`,
      dueDate: snapshot.dueDate,
      overdue: snapshot.overdue,
      alreadyPaid: snapshot.alreadyPaid,
      stillToPay: Math.max(0, snapshot.dueThisPeriod),
      overdueAmount: snapshot.overdueAmount,
      holding: snapshot.holding,
      lines: snapshot.lines,
      kesehatan: kesehatan.employees,
      ketenagakerjaan: ketenagakerjaan.employees,
      remittances: snapshot.remittances,
      company,
      locale,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="bpjs-report-${year}-${month}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/billing/bpjs-report]", error);
    return NextResponse.json(
      { error: "Could not generate the BPJS Report PDF. Please try again." },
      { status: 500 }
    );
  }
}
