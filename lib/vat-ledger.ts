import {
  commercialTaxIncludesVat,
  projectWithholdingCreditIdr,
} from "@/lib/commercial-tax";
import {
  governmentTaxKindLabelKey,
  isGovernmentOperatingExpense,
} from "@/lib/government-tax";
import { purchaseImportInputVat } from "@/lib/import-landed-cost";
import type { createTranslator } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import {
  DEFAULT_INCLUSIVE_PPN_RATE,
  applyExclusiveVat,
  broughtForwardVatCredit,
  isDateInJakartaMonth,
  isDateInJakartaYear,
  ppnRateFromPercent,
  splitInclusiveVat,
  utcRangeForJakartaMonth,
  utcRangeForJakartaYear,
} from "@/lib/vat";

export type VatLedgerRow = {
  id: string;
  partyName: string;
  detail: string;
  date: string | null;
  gross: number;
  dpp: number;
  ppn: number;
  taxInvoiceSerial: string | null;
  fakturReady: boolean;
  href: string;
  remittanceExcluded?: boolean;
};

export type IncomeTaxCreditRow = {
  id: string;
  source: string;
  detail: string;
  date: string | null;
  amount: number;
  href: string;
  documentReady: boolean;
};

type Translator = ReturnType<typeof createTranslator>;

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

export type VatTaxWorkspace = {
  year: number;
  month: number | null;
  outputRows: VatLedgerRow[];
  inputRows: VatLedgerRow[];
  yearOutputRows: VatLedgerRow[];
  yearInputRows: VatLedgerRow[];
  outputTotal: number;
  inputTotal: number;
  net: number;
  yearNet: number;
  creditBroughtForward: number;
  outputPending: number;
  inputPending: number;
  incomeRows: IncomeTaxCreditRow[];
  incomeImportTotal: number;
  incomeInstallmentTotal: number;
  otherRows: IncomeTaxCreditRow[];
  otherRemittanceTotal: number;
  otherExpenseTotal: number;
};

export async function loadVatTaxWorkspace(options: {
  companyId: string;
  year: number;
  month: number | null;
  t: Translator;
}): Promise<VatTaxWorkspace> {
  const { companyId, year, month, t } = options;
  const yearRange = utcRangeForJakartaYear(year);
  const periodRange =
    month == null ? yearRange : utcRangeForJakartaMonth(year, month);
  const { start, endExclusive } = periodRange;
  const carryStart = utcRangeForJakartaYear(year - 1).start;

  const [periods, purchaseRowsRaw, incomePurchases, otherPurchases] =
    await Promise.all([
      prisma.projectInvoicePeriod.findMany({
        where: {
          taxInvoiceRequired: true,
          project: { companyId },
          OR: [
            {
              taxInvoiceIssuedAt: {
                gte: carryStart,
                lt: yearRange.endExclusive,
              },
            },
            {
              taxInvoiceIssuedAt: null,
              dueAt: { gte: carryStart, lt: yearRange.endExclusive },
            },
            {
              taxInvoiceIssuedAt: null,
              dueAt: null,
              periodEnd: { gte: carryStart, lt: yearRange.endExclusive },
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
          taxInvoiceSerial: true,
          taxInvoiceIssuedAt: true,
          taxInvoiceDoneAt: true,
          withholdingSlipPath: true,
          project: {
            select: {
              id: true,
              name: true,
              contractPrice: true,
              chargedTaxKind: true,
              pphRatePercent: true,
              isGovernmentContract: true,
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
                    gte: carryStart,
                    lt: yearRange.endExclusive,
                  },
                },
                {
                  taxInvoiceIssuedAt: null,
                  invoiceDate: {
                    gte: carryStart,
                    lt: yearRange.endExclusive,
                  },
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
          taxInvoiceSerial: true,
          taxInvoiceIssuedAt: true,
          vendor: { select: { id: true, name: true } },
        },
        orderBy: [{ taxInvoiceIssuedAt: "desc" }, { invoiceDate: "desc" }],
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
          filePath: true,
          importDutiesFilePath: true,
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
          filePath: true,
        },
        orderBy: { invoiceDate: "desc" },
      }),
    ]);

  const allOutputRows: VatLedgerRow[] = periods.map((period) => {
    const gross = periodCommercialAmount(period);
    const storedRatePercent = decimalToNumber(period.ppnRatePercent);
    const rate =
      storedRatePercent != null && storedRatePercent > 0
        ? ppnRateFromPercent(storedRatePercent)
        : DEFAULT_INCLUSIVE_PPN_RATE;
    const government = Boolean(period.project.isGovernmentContract);
    const governmentVat =
      government && commercialTaxIncludesVat(period.project.chargedTaxKind);
    const split = governmentVat
      ? {
          gross,
          dpp: gross,
          ppn: applyExclusiveVat(gross, rate).ppn,
        }
      : splitInclusiveVat(gross, rate);
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
        governmentVat ? t("pages.projects.governmentContract") : null,
      ]
        .filter(Boolean)
        .join(" · "),
      date: (period.taxInvoiceIssuedAt ?? period.dueAt ?? period.periodEnd)
        .toISOString(),
      gross: split.gross,
      dpp: split.dpp,
      ppn: split.ppn,
      taxInvoiceSerial: period.taxInvoiceSerial,
      fakturReady,
      href: `/billing/tax-invoices/period/${period.id}`,
      remittanceExcluded: governmentVat,
    };
  });

  const allInputRows: VatLedgerRow[] = [];
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
      allInputRows.push({
        id: `${purchase.id}-goods`,
        partyName: vendorName,
        detail: [purchase.invoiceRef, sourceLabel, rateLabel]
          .filter(Boolean)
          .join(" · "),
        date,
        gross: split.gross,
        dpp: split.dpp,
        ppn: split.ppn,
        taxInvoiceSerial: purchase.taxInvoiceSerial,
        fakturReady:
          purchase.origin === "IMPORT" || Boolean(purchase.taxInvoiceFilePath),
        href,
      });
    }

    if (handlingPpn > 0) {
      allInputRows.push({
        id: `${purchase.id}-handling`,
        partyName: purchase.handlingVendor?.name ?? vendorName,
        detail: [purchase.invoiceRef, t("pages.vat.inputSourceHandling")].join(
          " · "
        ),
        date,
        gross: handlingPaid,
        dpp: handlingDpp,
        ppn: handlingPpn,
        taxInvoiceSerial: purchase.taxInvoiceSerial,
        fakturReady: Boolean(purchase.taxInvoiceFilePath),
        href,
      });
    }
  }

  const yearOutputRows = allOutputRows.filter((row) =>
    row.date ? isDateInJakartaYear(new Date(row.date), year) : false
  );
  const yearInputRows = allInputRows.filter((row) =>
    row.date ? isDateInJakartaYear(new Date(row.date), year) : false
  );
  const outputRows =
    month == null
      ? yearOutputRows
      : yearOutputRows.filter((row) =>
          row.date ? isDateInJakartaMonth(new Date(row.date), year, month) : false
        );
  const inputRows =
    month == null
      ? yearInputRows
      : yearInputRows.filter((row) =>
          row.date ? isDateInJakartaMonth(new Date(row.date), year, month) : false
        );

  const remitOutput = (rows: VatLedgerRow[]) =>
    rows
      .filter((row) => !row.remittanceExcluded)
      .reduce((sum, row) => sum + row.ppn, 0);
  const outputTotal = remitOutput(outputRows);
  const inputTotal = inputRows.reduce((sum, row) => sum + row.ppn, 0);
  const net = inputTotal - outputTotal;
  const yearNet =
    yearInputRows.reduce((sum, row) => sum + row.ppn, 0) -
    remitOutput(yearOutputRows);
  const creditBroughtForward = broughtForwardVatCredit(
    allOutputRows.filter((row) => !row.remittanceExcluded),
    allInputRows,
    month == null ? year + 1 : year,
    month == null ? 1 : month
  );

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
      href: `/billing/tax-invoices/purchase/${purchase.id}?from=income`,
      documentReady: Boolean(
        isImportCredit
          ? purchase.importDutiesFilePath || purchase.filePath
          : purchase.filePath
      ),
    });
  }

  for (const period of periods) {
    const date = period.taxInvoiceIssuedAt ?? period.dueAt ?? period.periodEnd;
    if (date < start || date >= endExclusive) continue;
    const dpp = periodCommercialAmount(period);
    const credit = projectWithholdingCreditIdr({
      dpp,
      chargedTaxKind: period.project.chargedTaxKind,
      pphRatePercent: decimalToNumber(period.project.pphRatePercent),
    });
    if (credit <= 0) continue;
    incomeRows.push({
      id: `project-pph-${period.id}`,
      source: t("pages.vat.incomeSourceProject"),
      detail: [period.project.name, period.label?.trim()]
        .filter(Boolean)
        .join(" · "),
      date: date.toISOString(),
      amount: credit,
      href: `/billing/tax-invoices/period/${period.id}?from=income`,
      documentReady: Boolean(period.withholdingSlipPath),
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
        href: `/billing/tax-invoices/purchase/${purchase.id}?from=other`,
        documentReady: Boolean(purchase.filePath),
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

  return {
    year,
    month,
    outputRows,
    inputRows,
    yearOutputRows,
    yearInputRows,
    outputTotal,
    inputTotal,
    net,
    yearNet,
    creditBroughtForward,
    outputPending: outputRows.filter((row) => !row.fakturReady).length,
    inputPending: inputRows.filter((row) => !row.fakturReady).length,
    incomeRows,
    incomeImportTotal,
    incomeInstallmentTotal,
    otherRows,
    otherRemittanceTotal,
    otherExpenseTotal,
  };
}
