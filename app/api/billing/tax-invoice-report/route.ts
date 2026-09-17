import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import { getServerLocale } from "@/lib/i18n/locale";
import { canAccess } from "@/lib/permissions";
import { toPermissionUser } from "@/lib/session";
import {
  buildTaxInvoiceReportPdfBuffer,
  loadTaxInvoiceReportRows,
  pendingTaxInvoiceFileName,
} from "@/lib/tax-invoice-report";
import { parseTaxReportView } from "@/lib/tax-report-view";

export const dynamic = "force-dynamic";

function contentDispositionAttachment(fileName: string): string {
  const encoded = encodeURIComponent(fileName);
  const quoted = fileName.replace(/"/g, "");
  return `attachment; filename="${quoted}"; filename*=UTF-8''${encoded}`;
}

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
      { error: "You do not have permission to download pending tax invoices." },
      { status: 403 }
    );
  }

  try {
    const locale = await getServerLocale();
    const view = parseTaxReportView(request.nextUrl.searchParams.get("view"));
    const [rows, company] = await Promise.all([
      loadTaxInvoiceReportRows(session.user.companyId, locale, view),
      loadCompanyForPdf(session.user.companyId),
    ]);

    const buffer = await buildTaxInvoiceReportPdfBuffer({
      rows,
      view,
      company,
      locale,
    });

    const fileName = pendingTaxInvoiceFileName(locale, view);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDispositionAttachment(fileName),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/billing/tax-invoice-report]", error);
    return NextResponse.json(
      { error: "Could not generate the pending tax invoices PDF. Please try again." },
      { status: 500 }
    );
  }
}
