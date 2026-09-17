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

const ROW_H = 34;
const HEADER_H = 24;

export type ApReportPdfRow = {
  dueAt: Date;
  supplierName: string;
  invoiceRef: string | null;
  amount: number;
  statusLabel: string;
};

export type ApReportPdfSection = {
  monthKey: string;
  title: string;
  rows: ApReportPdfRow[];
  totalAmount: number;
};

export type ApReportPdfInput = {
  periodLabel: string;
  sections: ApReportPdfSection[];
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
  input: ApReportPdfInput,
  titleY: number
) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(BRAND.ink)
    .text(translate(locale, "pages.billing.apReportTitle"), PAGE_MARGIN, titleY, {
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
    .text(translate(locale, "pages.billing.apReportHint"), PAGE_MARGIN, doc.y + 2, {
      width: CONTENT_WIDTH,
    });
  doc.moveDown(1.1);
}

function drawTableHeader(doc: PdfDoc, locale: AppLocale) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);

  const labels = [
    { col: COLS.date, text: translate(locale, "pages.billing.apReportDueDate") },
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

export function apReportMonthKey(dueAt: Date): string {
  return `${dueAt.getUTCFullYear()}-${String(dueAt.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function buildApReportPdfBuffer(
  input: ApReportPdfInput
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
        Title: `${translate(locale, "pages.billing.apReportTitle")} — ${input.periodLabel}`,
        Author: letterhead.name,
        Subject: `${letterhead.name} accounts payable report`,
      },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const titleY = drawLetterheadHeader(doc, logoBuffer, letterhead);
    drawTitleBlock(doc, input, titleY);

    if (input.sections.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(BRAND.muted)
        .text(translate(locale, "pages.billing.apReportEmpty"), {
          width: CONTENT_WIDTH,
        });
    } else {
      for (const section of input.sections) {
        ensureRowSpace(doc, locale, HEADER_H + ROW_H + 28);
        doc
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor(BRAND.ink)
          .text(
            translate(locale, "pages.billing.apReportMonthGroup", {
              month: section.title,
            }),
            PAGE_MARGIN,
            doc.y + 4,
            { width: CONTENT_WIDTH }
          );
        doc.moveDown(0.45);
        drawTableHeader(doc, locale);

        section.rows.forEach((row) => {
          ensureRowSpace(doc, locale, ROW_H);
          const y = doc.y;
          doc
            .moveTo(PAGE_MARGIN, y + ROW_H)
            .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + ROW_H)
            .strokeColor(BRAND.rule)
            .lineWidth(0.5)
            .stroke();

          doc
            .font("Helvetica")
            .fontSize(8)
            .fillColor(BRAND.body)
            .text(formatDisplayDate(row.dueAt, undefined, bcp47), PAGE_MARGIN + COLS.date.x + 4, y + 10, {
              width: COLS.date.w - 8,
              lineBreak: false,
            });
          doc.text(row.supplierName, PAGE_MARGIN + COLS.vendor.x + 4, y + 10, {
            width: COLS.vendor.w - 8,
            lineBreak: false,
            ellipsis: true,
          });
          doc.text(row.invoiceRef?.trim() || "—", PAGE_MARGIN + COLS.reference.x + 4, y + 10, {
            width: COLS.reference.w - 8,
            lineBreak: false,
            ellipsis: true,
          });
          doc.text(row.statusLabel, PAGE_MARGIN + COLS.status.x + 4, y + 10, {
            width: COLS.status.w - 8,
            lineBreak: false,
            ellipsis: true,
          });
          doc
            .font("Helvetica-Bold")
            .fillColor(BRAND.expense)
            .text(formatContractPrice(row.amount), PAGE_MARGIN + COLS.amount.x, y + 10, {
              width: COLS.amount.w,
              lineBreak: false,
              align: "right",
            });
          doc.y = y + ROW_H;
        });

        ensureRowSpace(doc, locale, ROW_H);
        const sectionTotalY = doc.y + 6;
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(BRAND.ink)
          .text(
            translate(locale, "pages.billing.apReportMonthTotal"),
            PAGE_MARGIN,
            sectionTotalY,
            { width: COLS.amount.x - 8 }
          );
        doc
          .fillColor(BRAND.expense)
          .text(
            formatContractPrice(section.totalAmount),
            PAGE_MARGIN + COLS.amount.x,
            sectionTotalY,
            { width: COLS.amount.w, lineBreak: false, align: "right" }
          );
        doc.y = sectionTotalY + 18;
      }

      ensureRowSpace(doc, locale, ROW_H + 8);
      const totalY = doc.y + 6;
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(BRAND.ink)
        .text(translate(locale, "pages.billing.apReportTotal"), PAGE_MARGIN, totalY, {
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
        `${translate(locale, "pages.billing.apReportTitle")}  ·  Page ${i + 1} of ${range.count}`,
        letterhead
      );
    }

    doc.end();
  });
}
