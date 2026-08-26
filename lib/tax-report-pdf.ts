import PDFDocument from "pdfkit";

import { ensureCompanyForPdf } from "@/lib/company-for-pdf";
import { formatDisplayDate } from "@/lib/format-date";
import {
  DEFAULT_LOCALE,
  localeToBcp47,
  type AppLocale,
} from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { formatContractPrice } from "@/lib/project-billing";
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
import { formatTaxInvoiceSerial } from "@/lib/tax-invoice-serial";
import type { IncomeTaxCreditRow, VatLedgerRow } from "@/lib/vat-ledger";

const JAKARTA_TZ = "Asia/Jakarta";
const ROW_H = 22;
const HEADER_H = 24;
const SUMMARY_ROW_H = 18;

export type TaxReportPdfInput = {
  periodLabel: string;
  outputTotal: number;
  inputTotal: number;
  net: number;
  creditBroughtForward: number;
  outputRows: VatLedgerRow[];
  inputRows: VatLedgerRow[];
  incomeRows: IncomeTaxCreditRow[];
  otherRows: IncomeTaxCreditRow[];
  company?: CompanyForPdf | null;
  locale?: AppLocale;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

const VAT_COLS = {
  date: { x: 0, w: 70 },
  party: { x: 70, w: 128 },
  detail: { x: 198, w: 128 },
  dpp: { x: 326, w: 86 },
  ppn: { x: 412, w: CONTENT_WIDTH - 412 },
} as const;

const AMOUNT_COLS = {
  date: { x: 0, w: 78 },
  source: { x: 78, w: 150 },
  detail: { x: 228, w: 154 },
  amount: { x: 382, w: CONTENT_WIDTH - 382 },
} as const;

function drawTitleBlock(doc: PdfDoc, input: TaxReportPdfInput, titleY: number) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(BRAND.ink)
    .text(translate(locale, "pages.vat.taxReportTitle"), PAGE_MARGIN, titleY, {
      width: CONTENT_WIDTH,
    });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(BRAND.body)
    .text(input.periodLabel, PAGE_MARGIN, doc.y + 4, {
      width: CONTENT_WIDTH,
    });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.muted)
    .text(translate(locale, "pages.vat.taxReportHint"), PAGE_MARGIN, doc.y + 2, {
      width: CONTENT_WIDTH,
    });
  doc.moveDown(1);
}

function ensureSpace(
  doc: PdfDoc,
  needed: number,
  onNewPage?: () => void
) {
  if (doc.y + needed <= BOTTOM_SAFE) return;
  doc.addPage();
  onNewPage?.();
}

function drawSummary(doc: PdfDoc, input: TaxReportPdfInput) {
  const locale = input.locale ?? DEFAULT_LOCALE;
    const lines = [
    [translate(locale, "pages.vat.outputTotal"), input.outputTotal],
    [translate(locale, "pages.vat.inputTotal"), input.inputTotal],
    [translate(locale, "pages.vat.netPayable"), input.net],
    [
      translate(locale, "pages.vat.creditBroughtForward"),
      input.creditBroughtForward,
    ],
  ] as const;

  for (const [label, value] of lines) {
    ensureSpace(doc, SUMMARY_ROW_H);
    const y = doc.y;
    doc.font("Helvetica").fontSize(9).fillColor(BRAND.body).text(label, PAGE_MARGIN, y, {
      width: CONTENT_WIDTH - 160,
    });
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(BRAND.ink)
      .text(formatContractPrice(value), PAGE_MARGIN + CONTENT_WIDTH - 160, y, {
        width: 160,
        align: "right",
      });
    doc.y = y + SUMMARY_ROW_H;
  }
  doc.moveDown(0.6);
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
    { col: VAT_COLS.date, text: translate(locale, "pages.vat.taxReportDate") },
    { col: VAT_COLS.party, text: translate(locale, "pages.vat.taxReportParty") },
    {
      col: VAT_COLS.detail,
      text: translate(locale, "pages.vat.taxReportDetail"),
    },
    {
      col: VAT_COLS.dpp,
      text: translate(locale, "pages.vat.taxReportDpp"),
      align: "right" as const,
    },
    {
      col: VAT_COLS.ppn,
      text: translate(locale, "pages.vat.taxReportPpn"),
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

function drawVatTable(
  doc: PdfDoc,
  locale: AppLocale,
  rows: VatLedgerRow[],
  emptyKey: string
) {
  const bcp47 = localeToBcp47(locale);
  if (rows.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BRAND.body)
      .text(translate(locale, emptyKey), PAGE_MARGIN, doc.y, {
        width: CONTENT_WIDTH,
      });
    doc.moveDown(1);
    return;
  }

  drawVatHeader(doc, locale);
  let total = 0;
  rows.forEach((row, index) => {
    ensureSpace(doc, ROW_H, () => drawVatHeader(doc, locale));
    const y = doc.y;
    if (index % 2 === 0) {
      doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, ROW_H).fill(BRAND.panelBg);
    }
    total += row.ppn;
    const date = row.date
      ? formatDisplayDate(new Date(row.date), { timeZone: JAKARTA_TZ }, bcp47)
      : "—";
    doc.font("Helvetica").fontSize(8).fillColor(BRAND.ink);
    const cells = [
      { col: VAT_COLS.date, text: date },
      { col: VAT_COLS.party, text: row.partyName || "—" },
      {
        col: VAT_COLS.detail,
        text: [
          row.detail,
          row.taxInvoiceSerial
            ? formatTaxInvoiceSerial(row.taxInvoiceSerial)
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || "—",
      },
      {
        col: VAT_COLS.dpp,
        text: formatContractPrice(row.dpp),
        align: "right" as const,
      },
      {
        col: VAT_COLS.ppn,
        text: formatContractPrice(row.ppn),
        align: "right" as const,
      },
    ];
    for (const cell of cells) {
      doc.text(cell.text, PAGE_MARGIN + cell.col.x + 4, y + 6, {
        width: cell.col.w - 8,
        lineBreak: false,
        ellipsis: true,
        align: cell.align,
      });
    }
    doc.y = y + ROW_H;
  });

  ensureSpace(doc, ROW_H + 8);
  const totalY = doc.y + 6;
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(BRAND.ink)
    .text(translate(locale, "pages.vat.taxReportTotal"), PAGE_MARGIN, totalY, {
      width: VAT_COLS.ppn.x - 8,
    });
  doc.text(formatContractPrice(total), PAGE_MARGIN + VAT_COLS.ppn.x, totalY, {
    width: VAT_COLS.ppn.w,
    align: "right",
  });
  doc.y = totalY + ROW_H;
}

function drawAmountHeader(doc: PdfDoc, locale: AppLocale) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);
  const labels = [
    {
      col: AMOUNT_COLS.date,
      text: translate(locale, "pages.vat.taxReportDate"),
    },
    {
      col: AMOUNT_COLS.source,
      text: translate(locale, "pages.vat.columns.source"),
    },
    {
      col: AMOUNT_COLS.detail,
      text: translate(locale, "pages.vat.taxReportDetail"),
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

function drawAmountTable(
  doc: PdfDoc,
  locale: AppLocale,
  rows: IncomeTaxCreditRow[],
  emptyKey: string
) {
  const bcp47 = localeToBcp47(locale);
  if (rows.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BRAND.body)
      .text(translate(locale, emptyKey), PAGE_MARGIN, doc.y, {
        width: CONTENT_WIDTH,
      });
    doc.moveDown(1);
    return;
  }

  drawAmountHeader(doc, locale);
  let total = 0;
  rows.forEach((row, index) => {
    ensureSpace(doc, ROW_H, () => drawAmountHeader(doc, locale));
    const y = doc.y;
    if (index % 2 === 0) {
      doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, ROW_H).fill(BRAND.panelBg);
    }
    total += row.amount;
    const date = row.date
      ? formatDisplayDate(new Date(row.date), { timeZone: JAKARTA_TZ }, bcp47)
      : "—";
    doc.font("Helvetica").fontSize(8).fillColor(BRAND.ink);
    const cells = [
      { col: AMOUNT_COLS.date, text: date },
      { col: AMOUNT_COLS.source, text: row.source || "—" },
      { col: AMOUNT_COLS.detail, text: row.detail || "—" },
      {
        col: AMOUNT_COLS.amount,
        text: formatContractPrice(row.amount),
        align: "right" as const,
      },
    ];
    for (const cell of cells) {
      doc.text(cell.text, PAGE_MARGIN + cell.col.x + 4, y + 6, {
        width: cell.col.w - 8,
        lineBreak: false,
        ellipsis: true,
        align: cell.align,
      });
    }
    doc.y = y + ROW_H;
  });

  ensureSpace(doc, ROW_H + 8);
  const totalY = doc.y + 6;
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(BRAND.ink)
    .text(translate(locale, "pages.vat.taxReportTotal"), PAGE_MARGIN, totalY, {
      width: AMOUNT_COLS.amount.x - 8,
    });
  doc.text(
    formatContractPrice(total),
    PAGE_MARGIN + AMOUNT_COLS.amount.x,
    totalY,
    { width: AMOUNT_COLS.amount.w, align: "right", lineBreak: false }
  );
  doc.y = totalY + ROW_H;
}

export async function buildTaxReportPdfBuffer(
  input: TaxReportPdfInput
): Promise<Buffer> {
  const letterhead = letterheadFromCompany(
    await ensureCompanyForPdf(input.company)
  );
  const logoBuffer = await loadBrandLogoBuffer();
  const locale = input.locale ?? DEFAULT_LOCALE;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      info: {
        Title: `${translate(locale, "pages.vat.taxReportTitle")} — ${input.periodLabel}`,
        Author: letterhead.name,
        Subject: `${letterhead.name} tax report`,
      },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const titleY = drawLetterheadHeader(doc, logoBuffer, letterhead);
    drawTitleBlock(doc, input, titleY);
    drawSummary(doc, input);

    drawSectionTitle(doc, translate(locale, "pages.vat.outputTitle"));
    drawVatTable(doc, locale, input.outputRows, "pages.vat.taxReportEmptyOutput");

    drawSectionTitle(doc, translate(locale, "pages.vat.inputTitle"));
    drawVatTable(doc, locale, input.inputRows, "pages.vat.taxReportEmptyInput");

    drawSectionTitle(doc, translate(locale, "pages.vat.incomeTitle"));
    drawAmountTable(
      doc,
      locale,
      input.incomeRows,
      "pages.vat.taxReportEmptyIncome"
    );

    drawSectionTitle(doc, translate(locale, "pages.vat.otherTitle"));
    drawAmountTable(
      doc,
      locale,
      input.otherRows,
      "pages.vat.taxReportEmptyOther"
    );

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPdfPageFooter(
        doc,
        `${translate(locale, "pages.vat.taxReportTitle")}  ·  Page ${i + 1} of ${range.count}`,
        letterhead
      );
    }

    doc.end();
  });
}
