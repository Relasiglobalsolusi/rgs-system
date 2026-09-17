import PDFDocument from "pdfkit";

import { TAX_INVOICE_ISSUED_STATUSES } from "@/lib/billing";
import {
  exclusivePricePlusChargedTax,
} from "@/lib/commercial-tax";
import { ensureCompanyForPdf } from "@/lib/company-for-pdf";
import { formatDisplayDate } from "@/lib/format-date";
import {
  DEFAULT_LOCALE,
  localeToBcp47,
  type AppLocale,
} from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { purchaseImportInputVat } from "@/lib/import-landed-cost";
import { toUtcDateOnly } from "@/lib/invoice-period";
import {
  BOTTOM_SAFE,
  CONTENT_WIDTH,
  PAGE_MARGIN,
  PDF_BRAND as BRAND,
  drawLetterheadHeader,
  drawPdfPageFooter,
  letterheadFromCompany,
  loadBrandLogoBuffer,
  type CompanyForPdf,
} from "@/lib/pdf-letterhead";
import { prisma } from "@/lib/prisma";
import {
  decimalToNumber,
  formatContractPrice,
  formatInvoicePeriodLabel,
  isDownPaymentInvoicePeriod,
} from "@/lib/project-billing";
import {
  type TaxReportView,
  taxReportViewIncludes,
} from "@/lib/tax-report-view";

const JAKARTA_TZ = "Asia/Jakarta";
const ROW_H = 36;
const HEADER_H = 24;
const ISSUED_STATUSES = new Set<string>(TAX_INVOICE_ISSUED_STATUSES);

export type PendingTaxKind = Exclude<TaxReportView, "all">;

export type TaxInvoiceReportRow = {
  id: string;
  kind: PendingTaxKind;
  clientName: string;
  identity: string;
  billingFor: string;
  dpp: number;
  ppn: number;
  amount: number;
};

const VAT_COLS = {
  client: { x: 0, w: 112 },
  identity: { x: 112, w: 92 },
  billingFor: { x: 204, w: 155 },
  dpp: { x: 359, w: 70 },
  ppn: { x: 429, w: CONTENT_WIDTH - 429 },
} as const;

const AMOUNT_COLS = {
  party: { x: 0, w: 140 },
  identity: { x: 140, w: 92 },
  billingFor: { x: 232, w: 170 },
  amount: { x: 402, w: CONTENT_WIDTH - 402 },
} as const;

type PdfDoc = InstanceType<typeof PDFDocument>;

function periodExclusiveAmount(period: {
  revisedInvoiceAmount: Parameters<typeof decimalToNumber>[0];
  amount: Parameters<typeof decimalToNumber>[0];
}): number {
  return (
    decimalToNumber(period.revisedInvoiceAmount) ??
    decimalToNumber(period.amount) ??
    0
  );
}

function identityValue(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function periodIsOutstandingTaxInvoice(period: {
  status: string;
  taxInvoiceDoneAt: Date | null;
  taxInvoiceRequired: boolean;
  isDownPayment?: boolean | null;
  label: string | null;
  periodEnd: Date;
  reconciledAt: Date | null;
  project: {
    requiresTaxInvoice: boolean;
    billingMode: string;
  };
}): boolean {
  if (period.taxInvoiceDoneAt) return false;
  if (!period.taxInvoiceRequired && !period.project.requiresTaxInvoice) {
    return false;
  }
  if (ISSUED_STATUSES.has(period.status)) return true;
  if (
    isDownPaymentInvoicePeriod(period) &&
    (period.status === "ONGOING" || period.status === "COMPILING")
  ) {
    return true;
  }
  if (
    period.status === "AWAITING_CLIENT_REVIEW" ||
    period.status === "COMPILING"
  ) {
    return true;
  }
  if (
    period.status === "ONGOING" &&
    period.project.billingMode === "MONTHLY"
  ) {
    const today = toUtcDateOnly(new Date());
    if (period.reconciledAt) return true;
    return toUtcDateOnly(period.periodEnd).getTime() <= today.getTime();
  }
  return false;
}

function kindLabel(locale: AppLocale, kind: PendingTaxKind): string {
  return translate(locale, `pages.vat.tabs.${kind}`);
}

function hintKey(view: TaxReportView): string {
  if (view === "input") return "pages.vat.taxInvoiceReportHintInput";
  if (view === "income") return "pages.vat.taxInvoiceReportHintIncome";
  if (view === "other") return "pages.vat.taxInvoiceReportHintOther";
  if (view === "output") return "pages.vat.taxInvoiceReportHintOutput";
  return "pages.vat.taxInvoiceReportHint";
}

function fileNameKey(view: TaxReportView): string {
  if (view === "input") return "pages.vat.taxInvoiceReportFileNameInput";
  if (view === "income") return "pages.vat.taxInvoiceReportFileNameIncome";
  if (view === "other") return "pages.vat.taxInvoiceReportFileNameOther";
  if (view === "output") return "pages.vat.taxInvoiceReportFileNameOutput";
  return "pages.vat.taxInvoiceReportFileName";
}

export function pendingTaxInvoiceFileName(
  locale: AppLocale,
  view: TaxReportView
): string {
  return translate(locale, fileNameKey(view));
}

export async function loadTaxInvoiceReportRows(
  companyId: string,
  locale: AppLocale,
  view: TaxReportView = "all"
): Promise<TaxInvoiceReportRow[]> {
  const includeOutput = taxReportViewIncludes(view, "output");
  const includeInput = taxReportViewIncludes(view, "input");
  const includeIncome = taxReportViewIncludes(view, "income");
  const includeOther = taxReportViewIncludes(view, "other");

  const [periods, sales, purchases, incomePurchases] = await Promise.all([
      includeOutput || includeOther
        ? prisma.projectInvoicePeriod.findMany({
            where: includeOther
              ? {
                  project: {
                    companyId,
                    isComplimentary: false,
                  },
                }
              : {
                  taxInvoiceDoneAt: null,
                  OR: [
                    { taxInvoiceRequired: true },
                    { project: { requiresTaxInvoice: true } },
                  ],
                  project: {
                    companyId,
                    isComplimentary: false,
                  },
                },
            select: {
              id: true,
              label: true,
              status: true,
              amount: true,
              revisedInvoiceAmount: true,
              ppnRatePercent: true,
              periodStart: true,
              periodEnd: true,
              dueAt: true,
              reconciledAt: true,
              taxInvoiceRequired: true,
              taxInvoiceDoneAt: true,
              taxInvoiceDocumentPath: true,
              withholdingSlipPath: true,
              project: {
                select: {
                  name: true,
                  billingMode: true,
                  requiresTaxInvoice: true,
                  chargedTaxKind: true,
                  pphRatePercent: true,
                  isGovernmentContract: true,
                  client: {
                    select: {
                      name: true,
                      npwp: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ periodEnd: "asc" }, { periodStart: "asc" }],
          })
        : Promise.resolve([]),
      includeOutput
        ? prisma.inventorySale.findMany({
            where: {
              companyId,
              movement: { voidedAt: null },
              taxAmount: { gt: 0 },
              buyerIdentityDocUrl: null,
              OR: [{ buyerType: "COMPANY" }, { buyerType: null }],
            },
            select: {
              id: true,
              buyer: true,
              buyerTaxId: true,
              buyerIdNumber: true,
              subtotal: true,
              taxAmount: true,
              item: { select: { name: true } },
              client: { select: { name: true, npwp: true } },
            },
            orderBy: { soldAt: "asc" },
          })
        : Promise.resolve([]),
      includeInput
        ? prisma.purchaseInvoice.findMany({
            where: {
              companyId,
              reversedAt: null,
              OR: [
                { includesPpn: true },
                { taxInvoiceFilePath: { not: null } },
                { origin: "IMPORT", importPpnAmountIdr: { gt: 0 } },
                { handlingFeeIncludesPpn: true },
              ],
            },
            select: {
              id: true,
              supplierName: true,
              invoiceRef: true,
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
              vendor: { select: { name: true, npwp: true } },
            },
            orderBy: { invoiceDate: "asc" },
          })
        : Promise.resolve([]),
      includeIncome
        ? prisma.purchaseInvoice.findMany({
            where: {
              companyId,
              reversedAt: null,
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
              notes: true,
              supplierName: true,
              pph22AmountIdr: true,
              amount: true,
              filePath: true,
              importDutiesFilePath: true,
              vendor: { select: { npwp: true } },
            },
            orderBy: { invoiceDate: "asc" },
          })
        : Promise.resolve([]),
    ]);

  const rows: TaxInvoiceReportRow[] = [];

  if (includeOutput) {
    for (const period of periods) {
      if (!periodIsOutstandingTaxInvoice(period)) continue;
      const exclusive = periodExclusiveAmount(period);
      const tax = exclusivePricePlusChargedTax({
        exclusiveAmount: exclusive,
        chargedTaxKind: period.project.chargedTaxKind,
        requiresTaxInvoice: period.project.requiresTaxInvoice,
        pphRatePercent: decimalToNumber(period.project.pphRatePercent),
        ppnRatePercent: decimalToNumber(period.ppnRatePercent),
        isGovernmentContract: period.project.isGovernmentContract,
      });
      const periodLabel = formatInvoicePeriodLabel(period, {
        projectName: period.project.name,
        billingMode: period.project.billingMode,
        locale,
      });
      rows.push({
        id: period.id,
        kind: "output",
        clientName: period.project.client?.name?.trim() || "—",
        identity: identityValue(period.project.client?.npwp),
        billingFor: [period.project.name.trim(), periodLabel]
          .filter(Boolean)
          .join(" · "),
        dpp: tax.exclusive,
        ppn: tax.ppn,
        amount: 0,
      });
    }

    for (const sale of sales) {
      const dpp = decimalToNumber(sale.subtotal) ?? 0;
      const ppn = decimalToNumber(sale.taxAmount) ?? 0;
      rows.push({
        id: sale.id,
        kind: "output",
        clientName: sale.client?.name?.trim() || sale.buyer?.trim() || "—",
        identity: identityValue(
          sale.client?.npwp,
          sale.buyerTaxId,
          sale.buyerIdNumber
        ),
        billingFor: [
          sale.item.name.trim(),
          translate(locale, "pages.vat.soldOffSale"),
        ]
          .filter(Boolean)
          .join(" · "),
        dpp,
        ppn,
        amount: 0,
      });
    }
  }

  if (includeInput) {
    for (const purchase of purchases) {
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
      const vendorName = purchase.vendor?.name ?? purchase.supplierName;
      const identity = identityValue(purchase.vendor?.npwp);
      const goodsIssued =
        purchase.origin === "IMPORT" || Boolean(purchase.taxInvoiceFilePath);

      if (split.ppn > 0 && !goodsIssued) {
        const sourceLabel =
          purchase.purchaseCategory === "SERVICE"
            ? translate(locale, "pages.vat.inputSourceService")
            : purchase.purchaseCategory === "VEHICLE"
              ? translate(locale, "pages.vat.inputSourceVehicle")
              : translate(locale, "pages.vat.inputSourceItems");
        rows.push({
          id: `${purchase.id}-goods`,
          kind: "input",
          clientName: vendorName,
          identity,
          billingFor: [purchase.invoiceRef, sourceLabel]
            .filter(Boolean)
            .join(" · "),
          dpp: split.dpp,
          ppn: split.ppn,
          amount: 0,
        });
      }

      if (handlingPpn > 0 && !purchase.taxInvoiceFilePath) {
        rows.push({
          id: `${purchase.id}-handling`,
          kind: "input",
          clientName: purchase.handlingVendor?.name ?? vendorName,
          identity,
          billingFor: [
            purchase.invoiceRef,
            translate(locale, "pages.vat.inputSourceHandling"),
          ]
            .filter(Boolean)
            .join(" · "),
          dpp: handlingDpp,
          ppn: handlingPpn,
          amount: 0,
        });
      }
    }
  }

  if (includeIncome) {
    for (const purchase of incomePurchases) {
      const isImportCredit =
        purchase.origin === "IMPORT" &&
        purchase.purchaseCategory !== "GOVERNMENT";
      const amount = isImportCredit
        ? decimalToNumber(purchase.pph22AmountIdr) ?? 0
        : decimalToNumber(purchase.amount) ?? 0;
      if (amount <= 0) continue;
      const documentReady = Boolean(
        isImportCredit
          ? purchase.importDutiesFilePath || purchase.filePath
          : purchase.filePath
      );
      if (documentReady) continue;
      rows.push({
        id: purchase.id,
        kind: "income",
        clientName: isImportCredit
          ? purchase.supplierName
          : translate(locale, "pages.vat.incomeSourceGovernment"),
        identity: identityValue(purchase.vendor?.npwp),
        billingFor: [purchase.invoiceRef, purchase.notes]
          .filter(Boolean)
          .join(" · "),
        dpp: 0,
        ppn: 0,
        amount,
      });
    }
  }

  if (includeOther) {
    for (const period of periods) {
      if (period.project.isGovernmentContract) continue;
      if (period.withholdingSlipPath) continue;
      if (!ISSUED_STATUSES.has(period.status)) {
        continue;
      }
      const exclusive = periodExclusiveAmount(period);
      const tax = exclusivePricePlusChargedTax({
        exclusiveAmount: exclusive,
        chargedTaxKind: period.project.chargedTaxKind,
        pphRatePercent: decimalToNumber(period.project.pphRatePercent),
        isGovernmentContract: period.project.isGovernmentContract,
        ppnRatePercent: decimalToNumber(period.ppnRatePercent),
      });
      if (tax.pph <= 0) continue;
      const periodLabel = formatInvoicePeriodLabel(period, {
        projectName: period.project.name,
        billingMode: period.project.billingMode,
        locale,
      });
      rows.push({
        id: `project-pph-${period.id}`,
        kind: "other",
        clientName: period.project.client?.name?.trim() || "—",
        identity: identityValue(period.project.client?.npwp),
        billingFor: [
          translate(locale, "pages.vat.remittanceSourceProject"),
          period.project.name.trim(),
          periodLabel,
        ]
          .filter(Boolean)
          .join(" · "),
        dpp: 0,
        ppn: 0,
        amount: tax.pph,
      });
    }
  }

  rows.sort((left, right) => {
    const byKind = left.kind.localeCompare(right.kind);
    if (byKind !== 0) return byKind;
    const byClient = left.clientName.localeCompare(right.clientName, undefined, {
      sensitivity: "base",
    });
    if (byClient !== 0) return byClient;
    return left.billingFor.localeCompare(right.billingFor, undefined, {
      sensitivity: "base",
    });
  });

  return rows;
}

function ensureSpace(doc: PdfDoc, needed: number, onNewPage?: () => void) {
  if (doc.y + needed <= BOTTOM_SAFE) return;
  doc.addPage();
  onNewPage?.();
}

function drawSectionTitle(doc: PdfDoc, title: string) {
  ensureSpace(doc, 28);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(BRAND.ink)
    .text(title, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.35);
}

function drawVatHeader(doc: PdfDoc, locale: AppLocale) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);
  const labels = [
    {
      col: VAT_COLS.client,
      text: translate(locale, "pages.vat.taxInvoiceReportColClient"),
    },
    {
      col: VAT_COLS.identity,
      text: translate(locale, "pages.vat.taxInvoiceReportColNpwp"),
    },
    {
      col: VAT_COLS.billingFor,
      text: translate(locale, "pages.vat.taxInvoiceReportColBillingFor"),
    },
    {
      col: VAT_COLS.dpp,
      text: translate(locale, "pages.vat.taxInvoiceReportColDpp"),
      align: "right" as const,
    },
    {
      col: VAT_COLS.ppn,
      text: translate(locale, "pages.vat.taxInvoiceReportColPpn"),
      align: "right" as const,
    },
  ];
  doc.font("Helvetica-Bold").fontSize(7).fillColor(BRAND.white);
  for (const label of labels) {
    doc.text(label.text, PAGE_MARGIN + label.col.x + 4, y + 8, {
      width: label.col.w - 8,
      lineBreak: false,
      align: label.align,
    });
  }
  doc.y = y + HEADER_H;
}

function drawAmountHeader(doc: PdfDoc, locale: AppLocale) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);
  const labels = [
    {
      col: AMOUNT_COLS.party,
      text: translate(locale, "pages.vat.taxReportParty"),
    },
    {
      col: AMOUNT_COLS.identity,
      text: translate(locale, "pages.vat.taxInvoiceReportColNpwp"),
    },
    {
      col: AMOUNT_COLS.billingFor,
      text: translate(locale, "pages.vat.taxInvoiceReportColBillingFor"),
    },
    {
      col: AMOUNT_COLS.amount,
      text: translate(locale, "pages.vat.taxReportAmount"),
      align: "right" as const,
    },
  ];
  doc.font("Helvetica-Bold").fontSize(7).fillColor(BRAND.white);
  for (const label of labels) {
    doc.text(label.text, PAGE_MARGIN + label.col.x + 4, y + 8, {
      width: label.col.w - 8,
      lineBreak: false,
      align: label.align,
    });
  }
  doc.y = y + HEADER_H;
}

function drawVatRows(doc: PdfDoc, locale: AppLocale, rows: TaxInvoiceReportRow[]) {
  if (rows.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(BRAND.ink)
      .text(translate(locale, "pages.vat.taxInvoiceReportEmpty"), {
        width: CONTENT_WIDTH,
      });
    doc.moveDown(0.8);
    return;
  }
  drawVatHeader(doc, locale);
  rows.forEach((row, index) => {
    ensureSpace(doc, ROW_H, () => drawVatHeader(doc, locale));
    const y = doc.y;
    if (index % 2 === 0) {
      doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, ROW_H).fill(BRAND.panelBg);
    }
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.ink)
      .text(row.clientName || "—", PAGE_MARGIN + VAT_COLS.client.x + 4, y + 6, {
        width: VAT_COLS.client.w - 8,
        height: ROW_H - 10,
        ellipsis: true,
      });
    doc.text(row.identity || "—", PAGE_MARGIN + VAT_COLS.identity.x + 4, y + 6, {
      width: VAT_COLS.identity.w - 8,
      height: ROW_H - 10,
      ellipsis: true,
    });
    doc.text(
      row.billingFor || "—",
      PAGE_MARGIN + VAT_COLS.billingFor.x + 4,
      y + 6,
      {
        width: VAT_COLS.billingFor.w - 8,
        height: ROW_H - 10,
        ellipsis: true,
      }
    );
    doc.text(
      formatContractPrice(row.dpp),
      PAGE_MARGIN + VAT_COLS.dpp.x + 4,
      y + 10,
      {
        width: VAT_COLS.dpp.w - 8,
        align: "right",
        lineBreak: false,
      }
    );
    doc.text(
      formatContractPrice(row.ppn),
      PAGE_MARGIN + VAT_COLS.ppn.x + 4,
      y + 10,
      {
        width: VAT_COLS.ppn.w - 8,
        align: "right",
        lineBreak: false,
      }
    );
    doc.y = y + ROW_H;
  });
}

function drawAmountRows(
  doc: PdfDoc,
  locale: AppLocale,
  rows: TaxInvoiceReportRow[]
) {
  if (rows.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(BRAND.ink)
      .text(translate(locale, "pages.vat.taxInvoiceReportEmpty"), {
        width: CONTENT_WIDTH,
      });
    doc.moveDown(0.8);
    return;
  }
  drawAmountHeader(doc, locale);
  rows.forEach((row, index) => {
    ensureSpace(doc, ROW_H, () => drawAmountHeader(doc, locale));
    const y = doc.y;
    if (index % 2 === 0) {
      doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, ROW_H).fill(BRAND.panelBg);
    }
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.ink)
      .text(row.clientName || "—", PAGE_MARGIN + AMOUNT_COLS.party.x + 4, y + 6, {
        width: AMOUNT_COLS.party.w - 8,
        height: ROW_H - 10,
        ellipsis: true,
      });
    doc.text(
      row.identity || "—",
      PAGE_MARGIN + AMOUNT_COLS.identity.x + 4,
      y + 6,
      {
        width: AMOUNT_COLS.identity.w - 8,
        height: ROW_H - 10,
        ellipsis: true,
      }
    );
    doc.text(
      row.billingFor || "—",
      PAGE_MARGIN + AMOUNT_COLS.billingFor.x + 4,
      y + 6,
      {
        width: AMOUNT_COLS.billingFor.w - 8,
        height: ROW_H - 10,
        ellipsis: true,
      }
    );
    doc.text(
      formatContractPrice(row.amount),
      PAGE_MARGIN + AMOUNT_COLS.amount.x + 4,
      y + 10,
      {
        width: AMOUNT_COLS.amount.w - 8,
        align: "right",
        lineBreak: false,
      }
    );
    doc.y = y + ROW_H;
  });
}

export async function buildTaxInvoiceReportPdfBuffer(input: {
  rows: TaxInvoiceReportRow[];
  view?: TaxReportView;
  printedAt?: Date;
  company?: CompanyForPdf | null;
  locale?: AppLocale;
}): Promise<Buffer> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const view = input.view ?? "all";
  const bcp47 = localeToBcp47(locale);
  const printedAt = input.printedAt ?? new Date();
  const letterhead = letterheadFromCompany(
    await ensureCompanyForPdf(input.company)
  );
  const logoBuffer = await loadBrandLogoBuffer();
  const title = translate(locale, "pages.vat.taxInvoiceReportTitle");

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      info: {
        Title: title,
        Author: letterhead.name,
        Subject: `${letterhead.name} pending tax invoices`,
      },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const titleY = drawLetterheadHeader(doc, logoBuffer, letterhead);
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(BRAND.ink)
      .text(title, PAGE_MARGIN, titleY, { width: CONTENT_WIDTH });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(BRAND.body)
      .text(
        [
          view === "all"
            ? translate(locale, "pages.vat.tabs.all")
            : kindLabel(locale, view),
          translate(locale, "pages.vat.taxInvoiceReportGeneratedOn", {
            date: formatDisplayDate(
              printedAt,
              { timeZone: JAKARTA_TZ },
              bcp47
            ),
          }),
        ].join("  ·  "),
        PAGE_MARGIN,
        doc.y + 4,
        { width: CONTENT_WIDTH }
      );
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BRAND.muted)
      .text(translate(locale, hintKey(view)), PAGE_MARGIN, doc.y + 2, {
        width: CONTENT_WIDTH,
      });
    doc.moveDown(1);

    const byKind = {
      output: input.rows.filter((row) => row.kind === "output"),
      input: input.rows.filter((row) => row.kind === "input"),
      income: input.rows.filter((row) => row.kind === "income"),
      other: input.rows.filter((row) => row.kind === "other"),
    };

    if (input.rows.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(BRAND.ink)
        .text(translate(locale, "pages.vat.taxInvoiceReportEmpty"), {
          width: CONTENT_WIDTH,
        });
    } else if (view === "all") {
      (["output", "input", "income", "other"] as const).forEach((kind) => {
        if (byKind[kind].length === 0) return;
        drawSectionTitle(doc, kindLabel(locale, kind));
        if (kind === "output" || kind === "input") {
          drawVatRows(doc, locale, byKind[kind]);
        } else {
          drawAmountRows(doc, locale, byKind[kind]);
        }
        doc.moveDown(0.6);
      });
    } else if (view === "income" || view === "other") {
      drawAmountRows(doc, locale, byKind[view]);
    } else {
      drawVatRows(doc, locale, byKind[view]);
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPdfPageFooter(
        doc,
        `${title}  ·  Page ${i + 1} of ${range.count}`,
        letterhead
      );
    }

    doc.end();
  });
}
