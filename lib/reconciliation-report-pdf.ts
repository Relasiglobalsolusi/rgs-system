/**
 * Client-facing reconciliation report PDF for Regular Cleaning periods.
 * Compiles staff CICO (Attendance) for the project/period date range.
 */

import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { formatDisplayDate, formatDisplayTime } from "@/lib/format-date";
import {
  BOTTOM_SAFE,
  CONTENT_WIDTH,
  PAGE_MARGIN,
  PDF_BRAND as BRAND,
  drawBrandAccentBar,
  drawLetterheadHeader,
  drawPdfPageFooter,
  letterheadFromCompany,
  loadBrandLogoBuffer,
  type CompanyForPdf,
} from "@/lib/pdf-letterhead";

export type CicoRowForPdf = {
  date: Date;
  employeeName: string;
  employeeNo: string;
  checkIn: Date | null;
  checkOut: Date | null;
  note: string | null;
};

type ReconciliationPdfInput = {
  projectName: string;
  clientName: string | null;
  location: string | null;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  contractAmountLabel?: string | null;
  rows: CicoRowForPdf[];
  company?: CompanyForPdf | null;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

function ensureSpace(doc: PdfDoc, needed: number) {
  if (doc.y + needed > BOTTOM_SAFE) {
    doc.addPage();
  }
}

function formatUtcDate(value: Date): string {
  return formatDisplayDate(value, { timeZone: "UTC" });
}

/**
 * Writes a reconciliation report under public/uploads/reconciliation-reports/
 * and returns the public URL path.
 */
export async function generateReconciliationReportPdf(
  input: ReconciliationPdfInput
): Promise<string> {
  const folder = "uploads/reconciliation-reports";
  const filename = `reconcile-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.pdf`;
  const uploadDir = path.join(process.cwd(), "public", folder);
  await mkdir(uploadDir, { recursive: true });
  const filepath = path.join(uploadDir, filename);
  const publicPath = `/${folder}/${filename}`;

  const letterhead = letterheadFromCompany(input.company);
  const logoBuffer = await loadBrandLogoBuffer();

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      info: {
        Title: `Reconciliation — ${input.projectName}`,
        Author: letterhead.name,
        Subject: "Client reconciliation report",
      },
      bufferPages: true,
    });
    const stream = createWriteStream(filepath);
    doc.pipe(stream);

    const titleY = drawLetterheadHeader(doc, logoBuffer, letterhead);
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(BRAND.ink)
      .text("RECONCILIATION REPORT", PAGE_MARGIN, titleY, {
        width: CONTENT_WIDTH,
      });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BRAND.muted)
      .text(
        "Staff attendance (CICO) for this billing period — please Approve or Revise in the client portal.",
        { width: CONTENT_WIDTH }
      );
    doc.moveDown(0.8);

    const meta: [string, string][] = [
      ["Client", input.clientName?.trim() || "—"],
      ["Project", input.projectName],
      ["Location", input.location?.trim() || "—"],
      ["Period", input.periodLabel],
      [
        "Dates",
        `${formatUtcDate(input.periodStart)} – ${formatUtcDate(input.periodEnd)}`,
      ],
    ];
    if (input.contractAmountLabel) {
      meta.push(["Contract amount", input.contractAmountLabel]);
    }

    for (const [label, value] of meta) {
      ensureSpace(doc, 16);
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(BRAND.teal)
        .text(label.toUpperCase(), { continued: false, width: 120 });
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(BRAND.body)
        .text(value, { width: CONTENT_WIDTH });
      doc.moveDown(0.25);
    }

    doc.moveDown(0.5);
    drawBrandAccentBar(doc, 2, false);
    doc.moveDown(0.6);

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(BRAND.ink)
      .text(`Attendance (${input.rows.length} day(s))`, {
        width: CONTENT_WIDTH,
      });
    doc.moveDown(0.4);

    if (input.rows.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(BRAND.muted)
        .text("No CICO records were found for this project in the period.", {
          width: CONTENT_WIDTH,
        });
    } else {
      const col = {
        date: 72,
        staff: 150,
        in: 70,
        out: 70,
        note: CONTENT_WIDTH - 72 - 150 - 70 - 70,
      };
      const headerY = doc.y;
      doc.rect(PAGE_MARGIN, headerY, CONTENT_WIDTH, 18).fill(BRAND.tableHeaderBg);
      doc.fillColor(BRAND.white).font("Helvetica-Bold").fontSize(8);
      let x = PAGE_MARGIN + 4;
      doc.text("Date", x, headerY + 5, { width: col.date });
      x += col.date;
      doc.text("Staff", x, headerY + 5, { width: col.staff });
      x += col.staff;
      doc.text("Check-in", x, headerY + 5, { width: col.in });
      x += col.in;
      doc.text("Check-out", x, headerY + 5, { width: col.out });
      x += col.out;
      doc.text("Note", x, headerY + 5, { width: col.note });
      doc.y = headerY + 22;

      for (const row of input.rows) {
        ensureSpace(doc, 28);
        const y = doc.y;
        doc.font("Helvetica").fontSize(8).fillColor(BRAND.body);
        let cx = PAGE_MARGIN + 4;
        doc.text(formatUtcDate(row.date), cx, y, { width: col.date });
        cx += col.date;
        doc.text(`${row.employeeName} (${row.employeeNo})`, cx, y, {
          width: col.staff,
        });
        cx += col.staff;
        doc.text(
          row.checkIn ? formatDisplayTime(row.checkIn) : "—",
          cx,
          y,
          { width: col.in }
        );
        cx += col.in;
        doc.text(
          row.checkOut ? formatDisplayTime(row.checkOut) : "—",
          cx,
          y,
          { width: col.out }
        );
        cx += col.out;
        doc.text(row.note?.trim() || "—", cx, y, { width: col.note });
        doc.y = y + 20;
        doc
          .moveTo(PAGE_MARGIN, doc.y)
          .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
          .strokeColor(BRAND.rule)
          .lineWidth(0.5)
          .stroke();
        doc.y += 4;
      }
    }

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i += 1) {
      doc.switchToPage(i);
      drawPdfPageFooter(doc, `Page ${i + 1} of ${pages.count}`, letterhead);
    }

    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });

  return publicPath;
}
