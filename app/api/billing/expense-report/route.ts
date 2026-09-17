import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import {
  groupExpenseReportLines,
  invoiceIncomeTaxLines,
  purchaseExpenseAmount,
  type ExpenseReportLine,
} from "@/lib/expense-report";
import { buildExpenseReportPdfBuffer } from "@/lib/expense-report-pdf";
import {
  financePeriodFilenameStamp,
  financePeriodRange,
  parseFinancePeriod,
} from "@/lib/finance-period";
import { localizeSubCategory } from "@/lib/i18n/labels";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { getPurchasePaymentDisplay } from "@/lib/invoice-period";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatBankAccountOptionLabel } from "@/lib/company-bank-accounts";
import { decimalToNumber, formatInvoicePeriodLabel } from "@/lib/project-billing";
import { formatVendorBankAccountLabel } from "@/lib/vendor-bank-accounts";
import { toPermissionUser } from "@/lib/session";

const PURCHASE_VIEWS = ["tax", "payments"] as const;
type PurchaseView = (typeof PURCHASE_VIEWS)[number];

function isPurchaseView(value: string | null): value is PurchaseView {
  return value != null && (PURCHASE_VIEWS as readonly string[]).includes(value);
}

const PURCHASE_EXPENSE_SELECT = {
  paidAt: true,
  invoiceDate: true,
  supplierName: true,
  invoiceRef: true,
  amount: true,
  paymentTermsDays: true,
  freeOfCharge: true,
  paidWithCash: true,
  purchaseCategory: true,
  governmentTaxKind: true,
  governmentOperatingAmount: true,
  origin: true,
  includesPpn: true,
  ppnRatePercent: true,
  importPpnAmountIdr: true,
  importValueIdr: true,
  pph22AmountIdr: true,
  transferFeeIdr: true,
  loanInterestAmount: true,
  loanPenaltyAmount: true,
  loanAdminFeeAmount: true,
  loanProvisionAmount: true,
  taxInvoiceFilePath: true,
  projectId: true,
  project: {
    select: {
      id: true,
      name: true,
      subCategory: true,
      client: { select: { name: true } },
    },
  },
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
} as const;

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
    const companyId = session.user.companyId;
    const [invoices, paidPeriods, catchUpExpenses, company] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where: {
          companyId,
          paidAt: { not: null, gte: start, lt: endExclusive },
          reversedAt: null,
          ...(purchaseView ? { purpose: { not: "PETTY_CASH" } } : {}),
        },
        select: PURCHASE_EXPENSE_SELECT,
        orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
      }),
      prisma.projectInvoicePeriod.findMany({
        where: {
          status: "PAID",
          paidAt: { not: null, gte: start, lt: endExclusive },
          project: { companyId },
        },
        select: {
          paidAt: true,
          label: true,
          amount: true,
          revisedInvoiceAmount: true,
          ppnRatePercent: true,
          taxInvoiceRequired: true,
          isDownPayment: true,
          periodStart: true,
          periodEnd: true,
          project: {
            select: {
              id: true,
              name: true,
              subCategory: true,
              billingMode: true,
              downPaymentPercent: true,
              chargedTaxKind: true,
              requiresTaxInvoice: true,
              pphRatePercent: true,
              isGovernmentContract: true,
              client: { select: { name: true } },
            },
          },
        },
        orderBy: [{ paidAt: "asc" }],
      }),
      prisma.projectExpense.findMany({
        where: {
          companyId,
          incurredAt: { gte: start, lt: endExclusive },
        },
        select: {
          incurredAt: true,
          category: true,
          reason: true,
          amount: true,
          project: {
            select: {
              id: true,
              name: true,
              subCategory: true,
              client: { select: { name: true } },
            },
          },
        },
        orderBy: [{ incurredAt: "asc" }],
      }),
      loadCompanyForPdf(companyId),
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
    const lines: ExpenseReportLine[] = [];

    for (const invoice of filtered) {
      const amount = purchaseExpenseAmount(invoice);
      if (amount <= 0) continue;
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
      lines.push({
        date: invoice.paidAt ?? invoice.invoiceDate,
        kind: "EXPENSE",
        projectId: invoice.project?.id ?? null,
        projectName: invoice.project?.name ?? null,
        clientName: invoice.project?.client?.name ?? null,
        subCategory: invoice.project?.subCategory ?? null,
        detail: invoice.supplierName,
        reference: invoice.invoiceRef,
        statusLabel,
        amount,
        payFromLabel: invoice.paidWithCash
          ? t("pages.billing.purchasePayFromCash")
          : invoice.bankAccount
            ? formatBankAccountOptionLabel(invoice.bankAccount)
            : null,
        payToLabel: invoice.vendorBankAccount
          ? formatVendorBankAccountLabel(invoice.vendorBankAccount)
          : invoice.purchaseCategory === "GOVERNMENT"
            ? invoice.invoiceRef
            : invoice.purchaseCategory === "EMPLOYEE_PAYMENT"
              ? invoice.supplierName
              : null,
      });
    }

    for (const period of paidPeriods) {
      const { dpp, tax } = invoiceIncomeTaxLines({
        amount: period.amount,
        revisedInvoiceAmount: period.revisedInvoiceAmount,
        ppnRatePercent: period.ppnRatePercent,
        chargedTaxKind: period.project.chargedTaxKind,
        requiresTaxInvoice:
          period.taxInvoiceRequired || period.project.requiresTaxInvoice,
        pphRatePercent: period.project.pphRatePercent,
        isGovernmentContract: period.project.isGovernmentContract,
      });
      if (dpp <= 0 || !period.paidAt) continue;
      lines.push({
        date: period.paidAt,
        kind: "INCOME",
        projectId: period.project.id,
        projectName: period.project.name,
        clientName: period.project.client?.name ?? null,
        subCategory: period.project.subCategory,
        detail: formatInvoicePeriodLabel(period, {
          billingMode: period.project.billingMode,
          locale,
          downPaymentPercent: decimalToNumber(period.project.downPaymentPercent),
        }),
        reference: period.label,
        statusLabel: t("pages.billing.vendorStatusPaid"),
        amount: dpp,
        tax,
      });
    }

    for (const expense of catchUpExpenses) {
      const amount = decimalToNumber(expense.amount) ?? 0;
      if (amount <= 0) continue;
      const detail =
        expense.category === "CATCH_UP_WAGE"
          ? t("pages.billing.expenseReportStaffCost")
          : expense.category === "CATCH_UP_INVENTORY"
            ? t("pages.billing.expenseReportMaterialCost")
            : expense.reason;
      lines.push({
        date: expense.incurredAt,
        kind: "EXPENSE",
        projectId: expense.project.id,
        projectName: expense.project.name,
        clientName: expense.project.client?.name ?? null,
        subCategory: expense.project.subCategory,
        detail,
        reference: null,
        statusLabel: t("pages.billing.vendorStatusPaid"),
        amount,
      });
    }

    const grouped = groupExpenseReportLines(lines, {
      unassignedTitle: t("pages.billing.expenseReportUnassigned"),
      subcategoryTitle: (subCategory) => localizeSubCategory(subCategory, locale),
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
      rows: [],
      grouped,
      totalAmount: grouped.expenseTotal,
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
