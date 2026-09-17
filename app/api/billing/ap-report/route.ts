import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { apReportMonthKey, buildApReportPdfBuffer } from "@/lib/ap-report-pdf";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import {
  financePeriodFilenameStamp,
  financePeriodRange,
  parseFinancePeriod,
} from "@/lib/finance-period";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { getPurchasePaymentDisplay, utcMonthLong } from "@/lib/invoice-period";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
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
  if (!canAccess(user, "purchaseInvoices")) {
    return NextResponse.json(
      { error: "You do not have permission to download the Accounts Payable Report." },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const period = parseFinancePeriod({
    year: searchParams.get("year") ?? undefined,
    month: searchParams.get("month") ?? undefined,
    day: searchParams.get("day") ?? undefined,
  });
  const { start, endExclusive } = financePeriodRange(period);

  try {
    const locale = await getServerLocale();
    const t = createTranslator(locale);
    const [invoices, company] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where: {
          companyId: session.user.companyId,
          paidAt: null,
          reversedAt: null,
          freeOfCharge: false,
        },
        select: {
          invoiceDate: true,
          supplierName: true,
          invoiceRef: true,
          amount: true,
          paymentTermsDays: true,
        },
        orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
      }),
      loadCompanyForPdf(session.user.companyId),
    ]);

    const now = new Date();
    const rows = invoices
      .map((invoice) => {
        const payment = getPurchasePaymentDisplay(
          {
            invoiceDate: invoice.invoiceDate,
            paidAt: null,
            paymentTermsDays: invoice.paymentTermsDays ?? 14,
          },
          now
        );
        const dueAt = payment.dueAt ?? invoice.invoiceDate;
        return {
          dueAt,
          supplierName: invoice.supplierName,
          invoiceRef: invoice.invoiceRef,
          amount: decimalToNumber(invoice.amount) ?? 0,
          statusLabel:
            payment.key === "overdue"
              ? t("pages.billing.vendorStatusOverdue")
              : t("pages.billing.vendorStatusOpen"),
        };
      })
      .filter((row) => row.dueAt.getTime() < endExclusive.getTime());

    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = apReportMonthKey(row.dueAt);
      const list = grouped.get(key) ?? [];
      list.push(row);
      grouped.set(key, list);
    }

    const sections = [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, monthRows]) => {
        const due = monthRows[0]?.dueAt ?? start;
        return {
          monthKey,
          title: `${utcMonthLong(due)} ${due.getUTCFullYear()}`,
          rows: monthRows,
          totalAmount: monthRows.reduce((sum, row) => sum + row.amount, 0),
        };
      });

    const periodLabel =
      period.month == null
        ? t("pages.billing.expenseReportPeriodYear", {
            year: String(period.year),
          })
        : period.day != null
          ? t("pages.billing.expenseReportPeriodDay", {
              day: String(period.day),
              month: t(`pages.reports.months.${period.month}`),
              year: String(period.year),
            })
          : t("pages.billing.expenseReportPeriodMonth", {
              month: t(`pages.reports.months.${period.month}`),
              year: String(period.year),
            });

    const buffer = await buildApReportPdfBuffer({
      periodLabel,
      sections,
      totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
      company,
      locale,
    });

    const stamp = financePeriodFilenameStamp(period);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="accounts-payable-report-${stamp}.pdf"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build the Accounts Payable Report.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
