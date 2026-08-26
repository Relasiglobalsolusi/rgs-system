import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import { buildExpenseReportPdfBuffer } from "@/lib/expense-report-pdf";
import {
  financePeriodFilenameStamp,
  financePeriodRange,
  parseFinancePeriod,
} from "@/lib/finance-period";
import {
  FINANCIAL_REPORT_ALL_BANKS,
  bankAccountWhere,
} from "@/lib/financial-report-query";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { getPurchasePaymentDisplay } from "@/lib/invoice-period";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatBankAccountOptionLabel } from "@/lib/company-bank-accounts";
import { decimalToNumber } from "@/lib/project-billing";
import { formatVendorBankAccountLabel } from "@/lib/vendor-bank-accounts";
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
    return NextResponse.json(
      { error: "You do not have permission to download this report." },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const period = parseFinancePeriod({
    year: searchParams.get("year") ?? undefined,
    month: searchParams.get("month") ?? undefined,
    day: searchParams.get("day") ?? undefined,
  });
  const clientId = String(searchParams.get("clientId") ?? "").trim();
  const bank = String(searchParams.get("bank") ?? FINANCIAL_REPORT_ALL_BANKS);
  const { start, endExclusive } = financePeriodRange(period);

  try {
    const locale = await getServerLocale();
    const t = createTranslator(locale);
    const [invoices, company] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where: {
          companyId: session.user.companyId,
          invoiceDate: { gte: start, lt: endExclusive },
          reversedAt: null,
          paidAt: { not: null },
          ...bankAccountWhere(bank),
          ...(clientId
            ? { project: { clientId } }
            : {}),
        },
        include: {
          bankAccount: {
            select: {
              bankName: true,
              accountNumber: true,
              accountHolder: true,
              label: true,
              sortOrder: true,
            },
          },
          vendorBankAccount: {
            select: {
              bankName: true,
              accountNumber: true,
              accountHolder: true,
              label: true,
            },
          },
          project: {
            select: { client: { select: { name: true } } },
          },
        },
        orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
      }),
      loadCompanyForPdf(session.user.companyId),
    ]);

    const now = new Date();
    const rows = invoices.map((invoice) => {
      const payment = getPurchasePaymentDisplay(
        {
          invoiceDate: invoice.invoiceDate,
          paidAt: invoice.paidAt,
          paymentTermsDays: invoice.paymentTermsDays ?? 14,
        },
        now
      );
      const clientName = invoice.project?.client?.name;
      const payTo = invoice.vendorBankAccount
        ? formatVendorBankAccountLabel(invoice.vendorBankAccount)
        : invoice.supplierName;
      return {
        invoiceDate: invoice.invoiceDate,
        supplierName: clientName
          ? `${clientName} · ${invoice.supplierName}`
          : invoice.supplierName,
        invoiceRef: invoice.invoiceRef,
        amount: decimalToNumber(invoice.amount) ?? 0,
        statusLabel: invoice.paidAt
          ? t("pages.billing.vendorStatusPaid")
          : payment.key === "overdue"
            ? t("pages.billing.vendorStatusOverdue")
            : t("pages.billing.vendorStatusOpen"),
        payFromLabel: invoice.bankAccount
          ? formatBankAccountOptionLabel(invoice.bankAccount)
          : null,
        payToLabel: payTo,
      };
    });

    const periodLabel =
      period.month == null
        ? t("pages.billing.expenseReportPeriodYear", {
            year: String(period.year),
          })
        : t("pages.billing.expenseReportPeriodMonth", {
            month: t(`pages.reports.months.${period.month}`),
            year: String(period.year),
          });

    const buffer = await buildExpenseReportPdfBuffer({
      periodLabel: `${t("pages.financialReport.transferReport")} · ${periodLabel}`,
      rows,
      totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
      company,
      locale,
    });

    const filename = `Transfer-Report_${financePeriodFilenameStamp(period)}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/billing/transfer-report]", error);
    return NextResponse.json(
      { error: "Could not generate the Transfer Report PDF." },
      { status: 500 }
    );
  }
}
