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

const JAKARTA_TZ = "Asia/Jakarta";
const ROW_H = 34;
const HEADER_H = 24;

export type ExpenseReportPdfRow = {
  invoiceDate: Date;
  supplierName: string;
  invoiceRef: string | null;
  amount: number;
  statusLabel: string;
  payFromLabel?: string | null;
  payToLabel?: string | null;
};

export type ExpenseReportPdfInput = {
  periodLabel: string;
  rows: ExpenseReportPdfRow[];
  totalAmount: number;
  company?: CompanyForPdf | null;
  locale?: AppLocale;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

const COLS = {
  date: { x: 0, w: 78 },
  vendor: { x: 78, w: 142 },
  reference: { x: 220, w: 100 },
  status: { x: 320, w: 62 },
  amount: { x: 382, w: CONTENT_WIDTH - 382 },
} as const;

function drawTitleBlock(
  doc: PdfDoc,
  input: ExpenseReportPdfInput,
  titleY: number
) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(BRAND.ink)
    .text(translate(locale, "pages.billing.expenseReportTitle"), PAGE_MARGIN, titleY, {
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
    .text(translate(locale, "pages.billing.expenseReportHint"), PAGE_MARGIN, doc.y + 2, {
      width: CONTENT_WIDTH,
    });
  doc.moveDown(1.1);
}

function drawTableHeader(doc: PdfDoc, locale: AppLocale) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);

  const labels = [
    { col: COLS.date, text: translate(locale, "pages.billing.expenseReportDate") },
    {
      col: COLS.vendor,
      text: translate(locale, "pages.billing.purchaseSupplier"),
    },
    {
      col: COLS.reference,
      text: translate(locale, "pages.billing.expenseReportReference"),
    },
    {
      col: COLS.status,
      text: translate(locale, "pages.billing.expenseReportStatus"),
    },
    {
      col: COLS.amount,
      text: translate(locale, "pages.billing.expenseReportAmount"),
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

function ensureRowSpace(doc: PdfDoc, locale: AppLocale, needed: number) {
  if (doc.y + needed <= BOTTOM_SAFE) return;
  doc.addPage();
  drawTableHeader(doc, locale);
}

export async function buildExpenseReportPdfBuffer(
  input: ExpenseReportPdfInput
): Promise<Buffer> {
  const letterhead = letterheadFromCompany(
    await ensureCompanyForPdf(input.company)
  );
  const logoBuffer = await loadBrandLogoBuffer();
  const locale = input.locale ?? DEFAULT_LOCALE;
  const bcp47 = localeToBcp47(locale);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      info: {
        Title: `${translate(locale, "pages.billing.expenseReportTitle")} — ${input.periodLabel}`,
        Author: letterhead.name,
        Subject: `${letterhead.name} expense report`,
      },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const titleY = drawLetterheadHeader(doc, logoBuffer, letterhead);
    drawTitleBlock(doc, input, titleY);

    if (input.rows.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(BRAND.ink)
        .text(translate(locale, "pages.billing.expenseReportEmpty"), {
          width: CONTENT_WIDTH,
        });
    } else {
      drawTableHeader(doc, locale);
      input.rows.forEach((row, index) => {
        ensureRowSpace(doc, locale, ROW_H);
        const y = doc.y;
        if (index % 2 === 0) {
          doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, ROW_H).fill(BRAND.panelBg);
        }
        const cells = [
          {
            col: COLS.date,
            text: formatDisplayDate(row.invoiceDate, { timeZone: JAKARTA_TZ }, bcp47),
          },
          { col: COLS.vendor, text: row.supplierName || "—" },
          { col: COLS.reference, text: row.invoiceRef?.trim() || "—" },
          { col: COLS.status, text: row.statusLabel },
          {
            col: COLS.amount,
            text: formatContractPrice(row.amount),
            align: "right" as const,
            color: BRAND.expense,
          },
        ];
        for (const cell of cells) {
          doc
            .font("Helvetica")
            .fontSize(8)
            .fillColor("color" in cell && cell.color ? cell.color : BRAND.ink)
            .text(cell.text, PAGE_MARGIN + cell.col.x + 4, y + 5, {
              width: cell.col.w - 8,
              lineBreak: false,
              ellipsis: true,
              align: cell.align,
            });
        }
        if (row.payFromLabel || row.payToLabel) {
          doc
            .font("Helvetica")
            .fontSize(7)
            .fillColor(BRAND.muted)
            .text(
              translate(locale, "pages.billing.expenseReportBanks", {
                from: row.payFromLabel || "—",
                to: row.payToLabel || "—",
              }),
              PAGE_MARGIN + COLS.vendor.x + 4,
              y + 18,
              {
                width: COLS.reference.w + COLS.status.w + COLS.vendor.w - 8,
                lineBreak: false,
                ellipsis: true,
              }
            );
        }
        doc.y = y + ROW_H;
      });

      ensureRowSpace(doc, locale, ROW_H + 8);
      const totalY = doc.y + 6;
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(BRAND.ink)
        .text(translate(locale, "pages.billing.expenseReportTotal"), PAGE_MARGIN, totalY, {
          width: COLS.amount.x - 8,
        });
      doc
        .fillColor(BRAND.expense)
        .text(formatContractPrice(input.totalAmount), PAGE_MARGIN + COLS.amount.x, totalY, {
          width: COLS.amount.w,
          lineBreak: false,
          align: "right",
        });
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPdfPageFooter(
        doc,
        `${translate(locale, "pages.billing.expenseReportTitle")}  ·  Page ${i + 1} of ${range.count}`,
        letterhead
      );
    }

    doc.end();
  });
}
