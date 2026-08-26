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
const SUMMARY_ROW_H = 18;

export type ThrReportPdfRow = {
  employeeNo: string;
  name: string;
  tenureMonths: number;
  basePay: number;
  amount: number;
  status: "DRAFT" | "GENERATED" | "PAID" | string;
  paidAt: Date | null;
};

export type ThrReportPdfInput = {
  year: number;
  periodLabel: string;
  hariRayaDate: Date | null;
  rows: ThrReportPdfRow[];
  totalAmount: number;
  company?: CompanyForPdf | null;
  locale?: AppLocale;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

const COLS = {
  employee: { x: 0, w: 148 },
  tenure: { x: 148, w: 70 },
  basePay: { x: 218, w: 88 },
  amount: { x: 306, w: 96 },
  status: { x: 402, w: CONTENT_WIDTH - 402 },
} as const;

function statusLabel(locale: AppLocale, row: ThrReportPdfRow, bcp47: string) {
  const label =
    row.status === "PAID"
      ? translate(locale, "pages.thr.statusPaid")
      : row.status === "DRAFT"
        ? translate(locale, "pages.thr.statusDraft")
        : translate(locale, "pages.thr.statusGenerated");
  if (row.status === "PAID" && row.paidAt) {
    return `${label} · ${formatDisplayDate(row.paidAt, { timeZone: JAKARTA_TZ }, bcp47)}`;
  }
  return label;
}

function drawTitleBlock(doc: PdfDoc, input: ThrReportPdfInput, titleY: number) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const bcp47 = localeToBcp47(locale);
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(BRAND.ink)
    .text(translate(locale, "pages.thr.reportTitle"), PAGE_MARGIN, titleY, {
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
    .text(translate(locale, "pages.thr.reportHint"), PAGE_MARGIN, doc.y + 2, {
      width: CONTENT_WIDTH,
    });
  if (input.hariRayaDate) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BRAND.body)
      .text(
        `${translate(locale, "pages.thr.hariRayaDate")}: ${formatDisplayDate(
          input.hariRayaDate,
          { timeZone: JAKARTA_TZ },
          bcp47
        )}`,
        PAGE_MARGIN,
        doc.y + 4,
        { width: CONTENT_WIDTH }
      );
  }
  doc.moveDown(1);
}

function ensureSpace(doc: PdfDoc, needed: number, onNewPage?: () => void) {
  if (doc.y + needed <= BOTTOM_SAFE) return;
  doc.addPage();
  onNewPage?.();
}

function drawSummary(doc: PdfDoc, input: ThrReportPdfInput) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const lines = [
    [translate(locale, "pages.thr.targetYear"), String(input.year)],
    [
      translate(locale, "pages.thr.totalAmount"),
      formatContractPrice(input.totalAmount),
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
      .text(value, PAGE_MARGIN + CONTENT_WIDTH - 160, y, {
        width: 160,
        align: "right",
      });
    doc.y = y + SUMMARY_ROW_H;
  }
  doc.moveDown(0.6);
}

function drawTableHeader(doc: PdfDoc, locale: AppLocale) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);
  const labels = [
    {
      col: COLS.employee,
      text: translate(locale, "pages.thr.columns.employee"),
    },
    { col: COLS.tenure, text: translate(locale, "pages.thr.columns.tenure") },
    {
      col: COLS.basePay,
      text: translate(locale, "pages.thr.columns.basePay"),
      align: "right" as const,
    },
    {
      col: COLS.amount,
      text: translate(locale, "pages.thr.columns.amount"),
      align: "right" as const,
    },
    { col: COLS.status, text: translate(locale, "pages.thr.columns.status") },
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

export async function buildThrReportPdfBuffer(
  input: ThrReportPdfInput
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
        Title: `${translate(locale, "pages.thr.reportTitle")} — ${input.periodLabel}`,
        Author: letterhead.name,
        Subject: `${letterhead.name} THR report`,
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

    if (input.rows.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(BRAND.ink)
        .text(translate(locale, "pages.thr.reportEmpty"), {
          width: CONTENT_WIDTH,
        });
    } else {
      drawTableHeader(doc, locale);
      input.rows.forEach((row, index) => {
        ensureSpace(doc, ROW_H, () => drawTableHeader(doc, locale));
        const y = doc.y;
        if (index % 2 === 0) {
          doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, ROW_H).fill(BRAND.panelBg);
        }
        doc.font("Helvetica").fontSize(8).fillColor(BRAND.ink);
        const cells = [
          {
            col: COLS.employee,
            text: `${row.name || "—"}  ${row.employeeNo || ""}`.trim(),
          },
          {
            col: COLS.tenure,
            text: translate(locale, "pages.thr.tenureMonths", {
              count: String(row.tenureMonths),
            }),
          },
          {
            col: COLS.basePay,
            text: formatContractPrice(row.basePay),
            align: "right" as const,
          },
          {
            col: COLS.amount,
            text: formatContractPrice(row.amount),
            align: "right" as const,
            color: BRAND.expense,
          },
          { col: COLS.status, text: statusLabel(locale, row, bcp47) },
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

      ensureSpace(doc, ROW_H + 8);
      const totalY = doc.y + 6;
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(BRAND.ink)
        .text(translate(locale, "pages.thr.reportTotal"), PAGE_MARGIN, totalY, {
          width: COLS.amount.x - 8,
        });
      doc
        .fillColor(BRAND.expense)
        .text(
          formatContractPrice(input.totalAmount),
          PAGE_MARGIN + COLS.amount.x,
          totalY,
          { width: COLS.amount.w, lineBreak: false, align: "right" }
        );
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPdfPageFooter(
        doc,
        `${translate(locale, "pages.thr.reportTitle")}  ·  Page ${i + 1} of ${range.count}`,
        letterhead
      );
    }

    doc.end();
  });
}
