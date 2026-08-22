import { redirect } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import VatReportPanel, {
  type IncomeTaxCreditRow,
  type VatLedgerRow,
} from "@/components/billing/VatReportPanel";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import {
  governmentTaxKindLabelKey,
  isGovernmentOperatingExpense,
} from "@/lib/government-tax";
import { purchaseImportInputVat } from "@/lib/import-landed-cost";
import { decimalToNumber } from "@/lib/project-billing";
import { requireFinanceChild } from "@/lib/session";
import {
  DEFAULT_INCLUSIVE_PPN_RATE,
  isDateInJakartaMonth,
  jakartaYearMonth,
  ppnRateFromPercent,
  splitInclusiveVat,
  utcRangeForJakartaMonth,
  utcRangeForJakartaYear,
} from "@/lib/vat";

type SearchParams = Promise<{
  year?: string;
  month?: string;
  view?: string;
}>;

function periodCommercialAmount(period: {
  revisedInvoiceAmount: Parameters<typeof decimalToNumber>[0];
  amount: Parameters<typeof decimalToNumber>[0];
}): number {
  return (
    decimalToNumber(period.revisedInvoiceAmount) ??
    decimalToNumber(period.amount) ??
    0
  );
}

export default async function TaxInvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFinanceChild("taxInvoices");
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
  const view =
    params.view === "input"
      ? "input"
      : params.view === "income"
        ? "income"
        : params.view === "other"
          ? "other"
          : "output";
  const { start, endExclusive } = utcRangeForJakartaMonth(year, month);
  const yearRange = utcRangeForJakartaYear(year);
  const companyId = session.user.companyId;

  const [periods, purchaseRowsRaw, governmentPayments, incomePurchases, otherPurchases] =
    await Promise.all([
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
        ppnRatePercent: true,
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
        reversedAt: null,
        AND: [
          {
            OR: [
              { includesPpn: true },
              { taxInvoiceFilePath: { not: null } },
              { origin: "IMPORT", importPpnAmountIdr: { gt: 0 } },
              { handlingFeeIncludesPpn: true },
            ],
          },
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
        origin: true,
        importPpnAmountIdr: true,
        importValueIdr: true,
        handlingFeeIncludesPpn: true,
        handlingFeeIdr: true,
        handlingFeeAmountPaidIdr: true,
        handlingVendor: { select: { name: true } },
        taxInvoiceFilePath: true,
        taxInvoiceIssuedAt: true,
        vendor: { select: { id: true, name: true } },
      },
      orderBy: [{ taxInvoiceIssuedAt: "desc" }, { invoiceDate: "desc" }],
    }),
    prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        reversedAt: null,
        purchaseCategory: "GOVERNMENT",
        governmentTaxKind: "PPN",
        invoiceDate: { gte: start, lt: endExclusive },
      },
      select: { amount: true },
    }),
    prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        reversedAt: null,
        invoiceDate: { gte: yearRange.start, lt: yearRange.endExclusive },
        OR: [
          { origin: "IMPORT", pph22Applied: true },
          {
            purchaseCategory: "GOVERNMENT",
            governmentTaxKind: { in: ["PPH_22", "PPH_25", "PPH_29"] },
          },
        ],
      },
      select: {
        id: true,
        origin: true,
        purchaseCategory: true,
        governmentTaxKind: true,
        invoiceRef: true,
        invoiceDate: true,
        notes: true,
        supplierName: true,
        pph22AmountIdr: true,
        amount: true,
      },
      orderBy: { invoiceDate: "desc" },
    }),
    prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        reversedAt: null,
        purchaseCategory: "GOVERNMENT",
        governmentTaxKind: {
          in: [
            "PPH_21",
            "PPH_23",
            "PPH_4_2",
            "STAMP_DUTY",
            "PBB",
            "OTHER",
            "BPJS_KESEHATAN",
            "BPJS_KETENAGAKERJAAN",
          ],
        },
        invoiceDate: { gte: start, lt: endExclusive },
      },
      select: {
        id: true,
        invoiceRef: true,
        invoiceDate: true,
        notes: true,
        amount: true,
        governmentTaxKind: true,
      },
      orderBy: { invoiceDate: "desc" },
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
      const storedRatePercent = decimalToNumber(period.ppnRatePercent);
      const rate =
        storedRatePercent != null && storedRatePercent > 0
          ? ppnRateFromPercent(storedRatePercent)
          : DEFAULT_INCLUSIVE_PPN_RATE;
      const split = splitInclusiveVat(gross, rate);
      const fakturReady = Boolean(
        period.taxInvoiceDocumentPath || period.taxInvoiceDoneAt
      );
      const rateLabel =
        storedRatePercent != null ? `${storedRatePercent}%` : null;
      return {
        id: period.id,
        partyName: period.project.client?.name ?? "—",
        detail: [
          period.project.name,
          period.label?.trim() || t("pages.vat.invoicePeriodFallback"),
          rateLabel,
        ]
          .filter(Boolean)
          .join(" · "),
        date: (period.taxInvoiceIssuedAt ?? period.dueAt ?? period.periodEnd)
          .toISOString(),
        gross: split.gross,
        dpp: split.dpp,
        ppn: split.ppn,
        fakturReady,
        href: `/billing/tax-invoices/period/${period.id}`,
      };
    });

  const inputRows: VatLedgerRow[] = [];
  for (const purchase of purchaseRowsRaw) {
    const storedRatePercent = decimalToNumber(purchase.ppnRatePercent);
    const split = purchaseImportInputVat({
      origin: purchase.origin,
      amount: decimalToNumber(purchase.amount) ?? 0,
      includesPpn: purchase.includesPpn,
      ppnRatePercent: storedRatePercent,
      importPpnAmountIdr: decimalToNumber(purchase.importPpnAmountIdr),
      importValueIdr: decimalToNumber(purchase.importValueIdr),
    });
    const handlingDpp = decimalToNumber(purchase.handlingFeeIdr) ?? 0;
    const handlingPaid =
      decimalToNumber(purchase.handlingFeeAmountPaidIdr) ?? handlingDpp;
    const handlingPpn = purchase.handlingFeeIncludesPpn
      ? Math.max(0, handlingPaid - handlingDpp)
      : 0;
    const date = (
      purchase.taxInvoiceIssuedAt ?? purchase.invoiceDate
    ).toISOString();
    const href = `/billing/tax-invoices/purchase/${purchase.id}`;
    const vendorName = purchase.vendor?.name ?? purchase.supplierName;

    if (split.ppn > 0) {
      const sourceLabel =
        purchase.origin === "IMPORT"
          ? t("pages.vat.inputSourceImport")
          : purchase.purchaseCategory === "SERVICE"
            ? t("pages.vat.inputSourceService")
            : purchase.purchaseCategory === "VEHICLE"
              ? t("pages.vat.inputSourceVehicle")
              : t("pages.vat.inputSourceItems");
      const rateLabel =
        storedRatePercent != null ? `${storedRatePercent}%` : null;
      inputRows.push({
        id: `${purchase.id}-goods`,
        partyName: vendorName,
        detail: [purchase.invoiceRef, sourceLabel, rateLabel]
          .filter(Boolean)
          .join(" · "),
        date,
        gross: split.gross,
        dpp: split.dpp,
        ppn: split.ppn,
        fakturReady:
          purchase.origin === "IMPORT" || Boolean(purchase.taxInvoiceFilePath),
        href,
      });
    }

    if (handlingPpn > 0) {
      inputRows.push({
        id: `${purchase.id}-handling`,
        partyName: purchase.handlingVendor?.name ?? vendorName,
        detail: [purchase.invoiceRef, t("pages.vat.inputSourceHandling")].join(
          " · "
        ),
        date,
        gross: handlingPaid,
        dpp: handlingDpp,
        ppn: handlingPpn,
        fakturReady: Boolean(purchase.taxInvoiceFilePath),
        href,
      });
    }
  }

  const outputTotal = outputRows.reduce((sum, row) => sum + row.ppn, 0);
  const inputTotal = inputRows.reduce((sum, row) => sum + row.ppn, 0);
  const net = inputTotal - outputTotal;
  const vatPaid = governmentPayments.reduce(
    (sum, row) => sum + (decimalToNumber(row.amount) ?? 0),
    0
  );
  const outputPending = outputRows.filter((row) => !row.fakturReady).length;
  const inputPending = inputRows.filter((row) => !row.fakturReady).length;

  const incomeRows: IncomeTaxCreditRow[] = [];
  for (const purchase of incomePurchases) {
    const isImportCredit =
      purchase.origin === "IMPORT" && purchase.purchaseCategory !== "GOVERNMENT";
    const amount = isImportCredit
      ? decimalToNumber(purchase.pph22AmountIdr) ?? 0
      : decimalToNumber(purchase.amount) ?? 0;
    if (amount <= 0) continue;
    incomeRows.push({
      id: purchase.id,
      source: isImportCredit
        ? t("pages.vat.incomeSourceImport")
        : t("pages.vat.incomeSourceGovernment"),
      detail: [
        isImportCredit
          ? purchase.supplierName
          : purchase.governmentTaxKind === "PPH_29"
            ? t("pages.billing.governmentTaxKindPph29")
            : purchase.governmentTaxKind === "PPH_22"
              ? t("pages.billing.governmentTaxKindPph22")
              : t("pages.billing.governmentTaxKindPph25"),
        purchase.invoiceRef,
        purchase.notes,
      ]
        .filter(Boolean)
        .join(" · "),
      date: purchase.invoiceDate.toISOString(),
      amount,
      href: `/billing/tax-invoices/purchase/${purchase.id}`,
    });
  }

  const incomeImportTotal = incomeRows
    .filter((row) => row.source === t("pages.vat.incomeSourceImport"))
    .reduce((sum, row) => sum + row.amount, 0);
  const incomeInstallmentTotal = incomeRows
    .filter((row) => row.source === t("pages.vat.incomeSourceGovernment"))
    .reduce((sum, row) => sum + row.amount, 0);

  const otherRows: IncomeTaxCreditRow[] = otherPurchases.flatMap((purchase) => {
    const amount = decimalToNumber(purchase.amount) ?? 0;
    if (amount <= 0 || !purchase.governmentTaxKind) return [];
    return [
      {
        id: purchase.id,
        source: t(governmentTaxKindLabelKey(purchase.governmentTaxKind)),
        detail: [purchase.invoiceRef, purchase.notes]
          .filter(Boolean)
          .join(" · "),
        date: purchase.invoiceDate.toISOString(),
        amount,
        href: `/billing/tax-invoices/purchase/${purchase.id}`,
      },
    ];
  });
  const otherRemittanceTotal = otherPurchases
    .filter(
      (row) =>
        row.governmentTaxKind === "PPH_21" || row.governmentTaxKind === "PPH_23"
    )
    .reduce((sum, row) => sum + (decimalToNumber(row.amount) ?? 0), 0);
  const otherExpenseTotal = otherPurchases
    .filter((row) => isGovernmentOperatingExpense(row.governmentTaxKind))
    .reduce((sum, row) => sum + (decimalToNumber(row.amount) ?? 0), 0);

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
        vatPaid={vatPaid}
        incomeRows={incomeRows}
        incomeImportTotal={incomeImportTotal}
        incomeInstallmentTotal={incomeInstallmentTotal}
        otherRows={otherRows}
        otherRemittanceTotal={otherRemittanceTotal}
        otherExpenseTotal={otherExpenseTotal}
        basePath="/billing/tax-invoices"
        hideOutputLink
      />
    </AppShell>
  );
}
