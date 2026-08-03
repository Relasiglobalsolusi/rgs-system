import { redirect } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import VatReportPanel, {
  type VatLedgerRow,
} from "@/components/billing/VatReportPanel";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { requireModule } from "@/lib/session";
import {
  DEFAULT_INCLUSIVE_PPN_RATE,
  isDateInJakartaMonth,
  jakartaYearMonth,
  ppnRateFromPercent,
  splitInclusiveVat,
  utcRangeForJakartaMonth,
} from "@/lib/vat";

type SearchParams = Promise<{
  year?: string;
  month?: string;
  view?: string;
}>;

function periodCommercialAmount(period: {
  revisedInvoiceAmount: Parameters<typeof decimalToNumber>[0];
  amount: Parameters<typeof decimalToNumber>[0];
  project: { contractPrice: Parameters<typeof decimalToNumber>[0] };
}): number {
  return (
    decimalToNumber(period.revisedInvoiceAmount) ??
    decimalToNumber(period.amount) ??
    decimalToNumber(period.project.contractPrice) ??
    0
  );
}

export default async function TaxInvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireModule("invoicing");
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  if (session.user.clientId) {
    redirect("/billing");
  }
  if (session.user.vendorId) {
    redirect("/billing/purchase-invoices?view=tax");
  }

  const params = await searchParams;
  const nowYm = jakartaYearMonth();
  const year = Math.max(
    2000,
    Math.min(2100, Number(params.year) || nowYm.year)
  );
  const month = Math.max(
    1,
    Math.min(12, Number(params.month) || nowYm.month)
  );
  const view = params.view === "input" ? "input" : "output";
  const { start, endExclusive } = utcRangeForJakartaMonth(year, month);
  const companyId = session.user.companyId;

  const [periods, purchaseRowsRaw] = await Promise.all([
    prisma.projectInvoicePeriod.findMany({
      where: {
        taxInvoiceRequired: true,
        project: { companyId },
        OR: [
          {
            taxInvoiceIssuedAt: {
              gte: start,
              lt: endExclusive,
            },
          },
          {
            taxInvoiceIssuedAt: null,
            dueAt: { gte: start, lt: endExclusive },
          },
          {
            taxInvoiceIssuedAt: null,
            dueAt: null,
            periodEnd: { gte: start, lt: endExclusive },
          },
        ],
      },
      select: {
        id: true,
        label: true,
        periodStart: true,
        periodEnd: true,
        dueAt: true,
        amount: true,
        revisedInvoiceAmount: true,
        taxInvoiceDocumentPath: true,
        taxInvoiceIssuedAt: true,
        taxInvoiceDoneAt: true,
        project: {
          select: {
            id: true,
            name: true,
            contractPrice: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ taxInvoiceIssuedAt: "desc" }, { periodEnd: "desc" }],
    }),
    prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        AND: [
          { OR: [{ includesPpn: true }, { taxInvoiceFilePath: { not: null } }] },
          {
            OR: [
              {
                taxInvoiceIssuedAt: {
                  gte: start,
                  lt: endExclusive,
                },
              },
              {
                taxInvoiceIssuedAt: null,
                invoiceDate: { gte: start, lt: endExclusive },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        supplierName: true,
        invoiceRef: true,
        invoiceDate: true,
        amount: true,
        includesPpn: true,
        purchaseCategory: true,
        ppnRatePercent: true,
        taxInvoiceFilePath: true,
        taxInvoiceIssuedAt: true,
        vendor: { select: { id: true, name: true } },
      },
      orderBy: [{ taxInvoiceIssuedAt: "desc" }, { invoiceDate: "desc" }],
    }),
  ]);

  const outputRows: VatLedgerRow[] = periods
    .filter((period) => {
      const anchor =
        period.taxInvoiceIssuedAt ?? period.dueAt ?? period.periodEnd;
      return isDateInJakartaMonth(anchor, year, month);
    })
    .map((period) => {
      const gross = periodCommercialAmount(period);
      const split = splitInclusiveVat(gross);
      const fakturReady = Boolean(
        period.taxInvoiceDocumentPath || period.taxInvoiceDoneAt
      );
      const clientId = period.project.client?.id;
      return {
        id: period.id,
        partyName: period.project.client?.name ?? "—",
        detail: [
          period.project.name,
          period.label?.trim() || t("pages.vat.invoicePeriodFallback"),
        ].join(" · "),
        date: (period.taxInvoiceIssuedAt ?? period.dueAt ?? period.periodEnd)
          .toISOString(),
        gross: split.gross,
        dpp: split.dpp,
        ppn: split.ppn,
        fakturReady,
        href: clientId
          ? `/billing/tax-invoices/${clientId}`
          : `/billing/tax-invoices`,
      };
    });

  const inputRows: VatLedgerRow[] = purchaseRowsRaw.map((purchase) => {
    const gross = decimalToNumber(purchase.amount) ?? 0;
    const storedRatePercent = decimalToNumber(purchase.ppnRatePercent);
    const rate =
      storedRatePercent != null && storedRatePercent > 0
        ? ppnRateFromPercent(storedRatePercent)
        : DEFAULT_INCLUSIVE_PPN_RATE;
    const split = splitInclusiveVat(gross, rate);
    const fakturReady = Boolean(purchase.taxInvoiceFilePath);
    const categoryLabel =
      purchase.purchaseCategory === "SERVICE"
        ? t("pages.billing.purchaseCategoryService")
        : t("pages.billing.purchaseCategoryProduct");
    const rateLabel =
      storedRatePercent != null ? `${storedRatePercent}%` : null;
    return {
      id: purchase.id,
      partyName: purchase.vendor?.name ?? purchase.supplierName,
      detail: [purchase.invoiceRef, categoryLabel, rateLabel]
        .filter(Boolean)
        .join(" · "),
      date: (purchase.taxInvoiceIssuedAt ?? purchase.invoiceDate).toISOString(),
      gross: split.gross,
      dpp: split.dpp,
      ppn: split.ppn,
      fakturReady,
      href: `/billing/purchase-invoices?view=tax`,
    };
  });

  const outputTotal = outputRows.reduce((sum, row) => sum + row.ppn, 0);
  const inputTotal = inputRows.reduce((sum, row) => sum + row.ppn, 0);
  const net = outputTotal - inputTotal;
  const outputPending = outputRows.filter((row) => !row.fakturReady).length;
  const inputPending = inputRows.filter((row) => !row.fakturReady).length;

  return (
    <AppShell
      titleKey="pages.billing.taxInvoice"
      descriptionKey="pages.billing.taxInvoiceDescription"
    >
      <BillingBreadcrumbs
        items={[{ label: t("pages.billing.taxInvoice") }]}
      />
      <VatReportPanel
        year={year}
        month={month}
        view={view}
        outputTotal={outputTotal}
        inputTotal={inputTotal}
        net={net}
        outputRows={outputRows}
        inputRows={inputRows}
        outputPending={outputPending}
        inputPending={inputPending}
        basePath="/billing/tax-invoices"
        hideOutputLink
      />
    </AppShell>
  );
}
