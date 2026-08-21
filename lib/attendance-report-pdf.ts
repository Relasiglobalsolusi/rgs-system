import PDFDocument from "pdfkit";

import { ensureCompanyForPdf } from "@/lib/company-for-pdf";
import { formatDisplayDate, formatDisplayTime } from "@/lib/format-date";
import { DEFAULT_LOCALE, localeToBcp47, type AppLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
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
import type { AttendanceExportFeed } from "@/lib/attendance-export-data";
import { formatHoursWorked } from "@/lib/shift-pay";

const JAKARTA_TZ = "Asia/Jakarta";
const ROW_H = 22;
const HEADER_H = 24;
const DAY_BREAK_H = 7;

export type AttendanceReportPdfInput = {
  feed: AttendanceExportFeed;
  periodLabel: string;
  company?: CompanyForPdf | null;
  locale?: AppLocale;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

const COLS = {
  date: { x: 0, w: 70 },
  employee: { x: 70, w: 108 },
  checkIn: { x: 178, w: 50 },
  checkOut: { x: 228, w: 50 },
  shift: { x: 278, w: 72 },
  hours: { x: 350, w: 50 },
  early: { x: 400, w: CONTENT_WIDTH - 400 },
} as const;

function drawTitleBlock(
  doc: PdfDoc,
  input: AttendanceReportPdfInput,
  titleY: number
) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(BRAND.ink)
    .text(translate(locale, "pages.progress.attendancePdfTitle"), PAGE_MARGIN, titleY, {
      width: CONTENT_WIDTH,
    });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(BRAND.body)
    .text(input.feed.projectName, PAGE_MARGIN, doc.y + 4, {
      width: CONTENT_WIDTH,
    });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.muted)
    .text(`${input.feed.clientName}  ·  ${input.periodLabel}`, PAGE_MARGIN, doc.y + 2, {
      width: CONTENT_WIDTH,
    });
  doc.moveDown(1.1);
}

function drawTableHeader(doc: PdfDoc, locale: AppLocale) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);

  const labels = [
    { col: COLS.date, text: translate(locale, "pages.attendance.columns.date") },
    {
      col: COLS.employee,
      text: translate(locale, "pages.attendance.columns.employee"),
    },
    {
      col: COLS.checkIn,
      text: translate(locale, "pages.attendance.columns.checkIn"),
    },
    {
      col: COLS.checkOut,
      text: translate(locale, "pages.attendance.columns.checkOut"),
    },
    {
      col: COLS.shift,
      text: translate(locale, "pages.progress.attendancePdfShift"),
    },
    {
      col: COLS.hours,
      text: translate(locale, "pages.progress.attendancePdfHours"),
    },
    {
      col: COLS.early,
      text: translate(locale, "pages.progress.attendancePdfEarly"),
    },
  ];

  doc.font("Helvetica-Bold").fontSize(7).fillColor(BRAND.white);
  for (const label of labels) {
    doc.text(label.text, PAGE_MARGIN + label.col.x + 4, y + 8, {
      width: label.col.w - 8,
      lineBreak: false,
    });
  }
  doc.y = y + HEADER_H;
}

function timeLabel(
  value: Date | null,
  bcp47: string
): string {
  if (!value) return "—";
  return formatDisplayTime(value, { timeZone: JAKARTA_TZ }, bcp47);
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function ensureRowSpace(doc: PdfDoc, locale: AppLocale, needed: number) {
  if (doc.y + needed <= BOTTOM_SAFE) return;
  doc.addPage();
  drawTableHeader(doc, locale);
}

function drawDayBreak(doc: PdfDoc) {
  const y = doc.y + 2;
  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y)
    .lineWidth(1.5)
    .strokeColor(BRAND.ink)
    .stroke();
  doc.y += DAY_BREAK_H;
}

/**
 * Attendance PDF without photos — day or closed month.
 */
export async function buildAttendanceReportPdfBuffer(
  input: AttendanceReportPdfInput
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
        Title: `Attendance — ${input.feed.projectName} — ${input.periodLabel}`,
        Author: letterhead.name,
        Subject: `${letterhead.name} attendance report`,
      },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const titleY = drawLetterheadHeader(doc, logoBuffer, letterhead);
    drawTitleBlock(doc, input, titleY);

    if (input.feed.rows.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(BRAND.ink)
        .text(translate(locale, "pages.progress.attendancePdfEmpty"), {
          width: CONTENT_WIDTH,
        });
    } else {
      drawTableHeader(doc, locale);
      input.feed.rows.forEach((row, index) => {
        const prev = input.feed.rows[index - 1];
        const newDay = Boolean(prev && dateKey(row.date) !== dateKey(prev.date));
        ensureRowSpace(doc, locale, ROW_H + (newDay ? DAY_BREAK_H : 0));
        if (newDay) {
          drawDayBreak(doc);
        }
        const y = doc.y;
        const dayFirstIndex = input.feed.rows.findIndex(
          (item) => dateKey(item.date) === dateKey(row.date)
        );
        if ((index - dayFirstIndex) % 2 === 0) {
          doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, ROW_H).fill(BRAND.panelBg);
        }
        doc.font("Helvetica").fontSize(8).fillColor(BRAND.ink);
        const cells = [
          {
            col: COLS.date,
            text: formatDisplayDate(row.date, { timeZone: "UTC" }, bcp47),
          },
          {
            col: COLS.employee,
            text: `${row.employeeName} (${row.employeeNo})`,
          },
          { col: COLS.checkIn, text: timeLabel(row.checkIn, bcp47) },
          { col: COLS.checkOut, text: timeLabel(row.checkOut, bcp47) },
          { col: COLS.shift, text: row.shiftLabel || "—" },
          {
            col: COLS.hours,
            text:
              row.workHours == null ? "—" : formatHoursWorked(row.workHours),
          },
          {
            col: COLS.early,
            text: row.earlyCheckOut
              ? translate(locale, "common.actions.yes")
              : "—",
          },
        ];
        for (const cell of cells) {
          doc.text(cell.text, PAGE_MARGIN + cell.col.x + 4, y + 6, {
            width: cell.col.w - 8,
            lineBreak: false,
            ellipsis: true,
          });
        }
        doc.y = y + ROW_H;
      });
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPdfPageFooter(
        doc,
        `Attendance  ·  Page ${i + 1} of ${range.count}`,
        letterhead
      );
    }

    doc.end();
  });
}
