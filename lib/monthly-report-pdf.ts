import PDFDocument from "pdfkit";
import { formatDisplayDate } from "@/lib/format-date";
import type { ProjectMonthlyReport } from "@/lib/monthly-report";
import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n/locale";
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
import { getProjectSubCategoryShortLabel } from "@/lib/project-subcategory";

export type MonthlyReportPdfInput = {
  year: number;
  month: number;
  periodLabel: string;
  projects: ProjectMonthlyReport[];
  company?: CompanyForPdf | null;
  locked: boolean;
  locale?: AppLocale;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

function ensureSpace(doc: PdfDoc, needed: number) {
  if (doc.y + needed > BOTTOM_SAFE) {
    doc.addPage();
  }
}

function drawSectionRule(doc: PdfDoc, color: string = BRAND.rule) {
  doc
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
    .strokeColor(color)
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.55);
}

function drawTitleBlock(
  doc: PdfDoc,
  input: MonthlyReportPdfInput,
  titleY: number
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(BRAND.ink)
    .text("MONTHLY REPORT", PAGE_MARGIN, titleY, {
      width: CONTENT_WIDTH * 0.55,
      lineBreak: false,
    });

  const metaRightX = PAGE_MARGIN + CONTENT_WIDTH * 0.55;
  const metaRightW = CONTENT_WIDTH * 0.45;
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(BRAND.lavender)
    .text(input.periodLabel, metaRightX, titleY + 2, {
      width: metaRightW,
      align: "right",
      lineBreak: false,
    });

  doc.y = titleY + 28;

  const metaBits = [
    `Generated ${formatDisplayDate(new Date())}`,
    `${input.projects.length} project${input.projects.length !== 1 ? "s" : ""}`,
  ];
  if (input.locked) metaBits.push("Locked");

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.muted)
    .text(metaBits.join("  ·  "), PAGE_MARGIN, doc.y, {
      width: CONTENT_WIDTH,
    });
  doc.moveDown(0.7);
  drawSectionRule(doc, BRAND.teal);
}

function drawMetricsRow(doc: PdfDoc, project: ProjectMonthlyReport) {
  const metrics: [string, string][] = [
    ["Days with progress", String(project.daysWithProgress)],
    ["Entries", String(project.totalProgressEntries)],
    ["Staff", String(project.staff.length)],
    ["Reports", String(project.reportCount)],
  ];
  const gap = 10;
  const colW = (CONTENT_WIDTH - gap * (metrics.length - 1)) / metrics.length;
  const startY = doc.y;
  const boxH = 42;

  metrics.forEach(([label, value], idx) => {
    const x = PAGE_MARGIN + idx * (colW + gap);
    doc.roundedRect(x, startY, colW, boxH, 3).fill(BRAND.panelBg);
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(BRAND.muted)
      .text(label.toUpperCase(), x + 8, startY + 8, {
        width: colW - 16,
        lineBreak: false,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(BRAND.ink)
      .text(value, x + 8, startY + 20, {
        width: colW - 16,
        lineBreak: false,
      });
  });

  doc.y = startY + boxH + 10;
}

function drawStaffTable(doc: PdfDoc, project: ProjectMonthlyReport) {
  if (project.staff.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(BRAND.muted)
      .text("No staff activity recorded for this project.", {
        width: CONTENT_WIDTH,
      });
    doc.moveDown(0.4);
    return;
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(BRAND.tealDeep)
    .text("STAFF SUMMARY", PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.35);

  const cols = [
    { key: "name", label: "Name", w: CONTENT_WIDTH * 0.38 },
    { key: "employeeNo", label: "Emp No", w: CONTENT_WIDTH * 0.18 },
    { key: "progressDays", label: "Progress days", w: CONTENT_WIDTH * 0.22 },
    { key: "attendanceDays", label: "Attendance", w: CONTENT_WIDTH * 0.22 },
  ] as const;

  const headerH = 18;
  const rowH = 16;
  ensureSpace(doc, headerH + rowH * Math.min(project.staff.length, 3) + 8);

  const tableTop = doc.y;
  doc.rect(PAGE_MARGIN, tableTop, CONTENT_WIDTH, headerH).fill(BRAND.tableHeaderBg);
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(BRAND.white);
  let x = PAGE_MARGIN + 6;
  for (const col of cols) {
    doc.text(col.label, x, tableTop + 5, {
      width: col.w - 8,
      lineBreak: false,
    });
    x += col.w;
  }

  let y = tableTop + headerH;
  project.staff.forEach((member, idx) => {
    ensureSpace(doc, rowH + 4);
    if (doc.y !== y && idx > 0) {
      // page break moved y; redraw header
      y = doc.y;
      doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, headerH).fill(BRAND.tableHeaderBg);
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(BRAND.white);
      let hx = PAGE_MARGIN + 6;
      for (const col of cols) {
        doc.text(col.label, hx, y + 5, {
          width: col.w - 8,
          lineBreak: false,
        });
        hx += col.w;
      }
      y += headerH;
    }

    if (idx % 2 === 0) {
      doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, rowH).fill(BRAND.panelBg);
    }

    const values = [
      member.name,
      member.employeeNo,
      String(member.progressDays),
      String(member.attendanceDays),
    ];
    doc.font("Helvetica").fontSize(8).fillColor(BRAND.ink);
    let cx = PAGE_MARGIN + 6;
    values.forEach((value, colIdx) => {
      doc.text(value, cx, y + 4, {
        width: cols[colIdx].w - 8,
        lineBreak: false,
      });
      cx += cols[colIdx].w;
    });
    y += rowH;
    doc.y = y;
  });

  doc.y = y + 8;
}

function drawProjectSection(
  doc: PdfDoc,
  project: ProjectMonthlyReport,
  locale: AppLocale
) {
  ensureSpace(doc, 140);

  const shortLabel = getProjectSubCategoryShortLabel(project.subCategory);
  const clientLoc =
    [project.clientName, project.location].filter(Boolean).join("  ·  ") ||
    "No client / location";

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(BRAND.ink)
    .text(project.projectName, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.body)
    .text(clientLoc, { width: CONTENT_WIDTH });

  if (shortLabel !== "-") {
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(BRAND.lavender)
      .text(shortLabel, { width: CONTENT_WIDTH });
  }

  doc.moveDown(0.45);
  drawMetricsRow(doc, project);

  const activityHeading = translate(
    locale,
    "pages.reports.activitySummary"
  ).toUpperCase();
  const activityBody =
    project.activitySummary ||
    translate(locale, "pages.reports.noProgressThisMonth");

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(BRAND.tealDeep)
    .text(activityHeading, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.25);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.body)
    .text(activityBody, {
      width: CONTENT_WIDTH,
    });
  doc.moveDown(0.55);

  drawStaffTable(doc, project);
  drawSectionRule(doc);
}

/**
 * Builds an A4 monthly report PDF buffer with RGS letterhead.
 */
export async function buildMonthlyReportPdfBuffer(
  input: MonthlyReportPdfInput
): Promise<Buffer> {
  const letterhead = letterheadFromCompany(input.company);
  const logoBuffer = await loadBrandLogoBuffer();
  const locale = input.locale ?? DEFAULT_LOCALE;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      info: {
        Title: `Monthly Report — ${input.periodLabel}`,
        Author: letterhead.name,
        Subject: `${letterhead.name} monthly report`,
      },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const titleY = drawLetterheadHeader(doc, logoBuffer, letterhead);
    drawTitleBlock(doc, input, titleY);

    if (input.projects.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(BRAND.ink)
        .text("No projects match the selected filters for this period.", {
          width: CONTENT_WIDTH,
        });
    } else {
      input.projects.forEach((project) => {
        drawProjectSection(doc, project, locale);
      });
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPdfPageFooter(
        doc,
        `Monthly report  ·  Page ${i + 1} of ${range.count}`,
        letterhead
      );
    }

    doc.end();
  });
}
