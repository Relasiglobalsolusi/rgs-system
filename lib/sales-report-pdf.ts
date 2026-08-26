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
const ROW_H = 22;
const HEADER_H = 24;

export type SalesReportPdfRow = {
  soldAt: Date;
  itemName: string;
  buyer: string | null;
  totalPrice: number;
};

export type SalesReportPdfInput = {
  periodLabel: string;
  rows: SalesReportPdfRow[];
  totalAmount: number;
  company?: CompanyForPdf | null;
  locale?: AppLocale;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

const COLS = {
  date: { x: 0, w: 78 },
  item: { x: 78, w: 160 },
  buyer: { x: 238, w: 144 },
  amount: { x: 382, w: CONTENT_WIDTH - 382 },
} as const;

function drawTitleBlock(
  doc: PdfDoc,
  input: SalesReportPdfInput,
  titleY: number
) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(BRAND.ink)
    .text(translate(locale, "pages.sales.salesReportTitle"), PAGE_MARGIN, titleY, {
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
    .text(translate(locale, "pages.sales.salesReportHint"), PAGE_MARGIN, doc.y + 2, {
      width: CONTENT_WIDTH,
    });
  doc.moveDown(1.1);
}

function drawTableHeader(doc: PdfDoc, locale: AppLocale) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);

  const labels = [
    { col: COLS.date, text: translate(locale, "pages.sales.salesReportDate") },
    { col: COLS.item, text: translate(locale, "pages.sales.salesReportItem") },
    { col: COLS.buyer, text: translate(locale, "pages.sales.salesReportBuyer") },
    {
      col: COLS.amount,
      text: translate(locale, "pages.sales.salesReportAmount"),
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

export async function buildSalesReportPdfBuffer(
  input: SalesReportPdfInput
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
        Title: `${translate(locale, "pages.sales.salesReportTitle")} — ${input.periodLabel}`,
        Author: letterhead.name,
        Subject: `${letterhead.name} sales report`,
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
        .text(translate(locale, "pages.sales.salesReportEmpty"), {
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
        doc.font("Helvetica").fontSize(8).fillColor(BRAND.ink);
        const cells = [
          {
            col: COLS.date,
            text: formatDisplayDate(row.soldAt, { timeZone: JAKARTA_TZ }, bcp47),
          },
          { col: COLS.item, text: row.itemName || "—" },
          { col: COLS.buyer, text: row.buyer?.trim() || "—" },
          {
            col: COLS.amount,
            text: formatContractPrice(row.totalPrice),
            align: "right" as const,
            color: BRAND.income,
          },
        ];
        for (const cell of cells) {
          doc
            .fillColor("color" in cell && cell.color ? cell.color : BRAND.ink)
            .text(cell.text, PAGE_MARGIN + cell.col.x + 4, y + 6, {
            width: cell.col.w - 8,
            lineBreak: false,
            ellipsis: true,
            align: cell.align,
          });
        }
        doc.y = y + ROW_H;
      });

      ensureRowSpace(doc, locale, ROW_H + 8);
      const totalY = doc.y + 6;
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(BRAND.ink)
        .text(translate(locale, "pages.sales.salesReportTotal"), PAGE_MARGIN, totalY, {
          width: COLS.amount.x - 8,
        });
      doc
        .fillColor(BRAND.income)
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
        `${translate(locale, "pages.sales.salesReportTitle")}  ·  Page ${i + 1} of ${range.count}`,
        letterhead
      );
    }

    doc.end();
  });
}
