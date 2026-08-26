import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import { buildExpenseReportPdfBuffer } from "@/lib/expense-report-pdf";
import {
  financePeriodFilenameStamp,
  financePeriodRange,
  parseFinancePeriod,
} from "@/lib/finance-period";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { getPurchasePaymentDisplay } from "@/lib/invoice-period";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatBankAccountOptionLabel } from "@/lib/company-bank-accounts";
import { decimalToNumber } from "@/lib/project-billing";
import { formatVendorBankAccountLabel } from "@/lib/vendor-bank-accounts";
import { toPermissionUser } from "@/lib/session";

const PURCHASE_VIEWS = ["tax", "payments"] as const;
type PurchaseView = (typeof PURCHASE_VIEWS)[number];

function isPurchaseView(value: string | null): value is PurchaseView {
  return value != null && (PURCHASE_VIEWS as readonly string[]).includes(value);
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
  if (!canAccess(user, "purchaseInvoices")) {
    return NextResponse.json(
      { error: "You do not have permission to download the Expense Report." },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const period = parseFinancePeriod({
    year: searchParams.get("year") ?? undefined,
    month: searchParams.get("month") ?? undefined,
    day: searchParams.get("day") ?? undefined,
  });
  const purchaseView = isPurchaseView(searchParams.get("view"))
    ? searchParams.get("view")
    : null;
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
          ...(purchaseView ? { purpose: { not: "PETTY_CASH" } } : {}),
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
        },
        orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
      }),
      loadCompanyForPdf(session.user.companyId),
    ]);

    let filtered = invoices;
    if (purchaseView === "tax") {
      filtered = invoices.filter(
        (invoice) =>
          invoice.purchaseCategory !== "GOVERNMENT" &&
          (invoice.includesPpn || Boolean(invoice.taxInvoiceFilePath))
      );
    }

    const now = new Date();
    const rows = filtered.map((invoice) => {
      const payment = getPurchasePaymentDisplay(
        {
          invoiceDate: invoice.invoiceDate,
          paidAt: invoice.paidAt,
          paymentTermsDays: invoice.paymentTermsDays ?? 14,
        },
        now
      );
      const statusLabel = invoice.freeOfCharge
        ? t("pages.billing.purchaseFreeOfChargeChip")
        : invoice.paidAt
          ? t("pages.billing.vendorStatusPaid")
          : payment.key === "overdue"
            ? t("pages.billing.vendorStatusOverdue")
            : t("pages.billing.vendorStatusOpen");

      return {
        invoiceDate: invoice.invoiceDate,
        supplierName: invoice.supplierName,
        invoiceRef: invoice.invoiceRef,
        amount: decimalToNumber(invoice.amount) ?? 0,
        statusLabel,
        payFromLabel: invoice.bankAccount
          ? formatBankAccountOptionLabel(invoice.bankAccount)
          : null,
        payToLabel: invoice.vendorBankAccount
          ? formatVendorBankAccountLabel(invoice.vendorBankAccount)
          : invoice.purchaseCategory === "GOVERNMENT"
            ? invoice.invoiceRef
            : invoice.purchaseCategory === "EMPLOYEE_PAYMENT"
              ? invoice.supplierName
              : null,
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

    const buffer = await buildExpenseReportPdfBuffer({
      periodLabel,
      rows,
      totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
      company,
      locale,
    });

    const filename = `Expense-Report_${financePeriodFilenameStamp(period)}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/billing/expense-report]", error);
    return NextResponse.json(
      { error: "Could not generate the Expense Report PDF. Please try again." },
      { status: 500 }
    );
  }
}
