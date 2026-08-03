import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";

import {
  formatDisplayDate,
  formatDisplayTime,
  formatWorkDuration,
} from "@/lib/format-date";
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
import type {
  FeedEmployeeDay,
  FeedProgressReport,
  ProjectMonthlyDayFeed,
} from "@/lib/project-monthly-feed";

const JAKARTA_TZ = "Asia/Jakarta";

export type ProjectMonthlyReportPdfInput = {
  feed: ProjectMonthlyDayFeed;
  periodLabel: string;
  company?: CompanyForPdf | null;
  locale?: AppLocale;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

function publicUrlToFsPath(url: string): string | null {
  if (!url) return null;
  const cleaned = url.split("?")[0].trim();
  if (!cleaned.startsWith("/uploads/")) return null;
  const relative = cleaned.replace(/^\/+/, "").replace(/\//g, path.sep);
  const publicRoot = path.resolve(process.cwd(), "public");
  const full = path.resolve(publicRoot, relative);
  if (full !== publicRoot && !full.startsWith(publicRoot + path.sep)) {
    return null;
  }
  return full;
}

function isPdfKitSupportedImage(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".jpg" || ext === ".jpeg" || ext === ".png";
}

async function loadImageBuffer(url: string): Promise<Buffer | null> {
  const filePath = publicUrlToFsPath(url);
  if (!filePath || !existsSync(filePath) || !isPdfKitSupportedImage(filePath)) {
    return null;
  }
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

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
  input: ProjectMonthlyReportPdfInput,
  titleY: number
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(BRAND.ink)
    .text("PROGRESS REPORT", PAGE_MARGIN, titleY, {
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

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(BRAND.ink)
    .text(input.feed.projectName, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.body)
    .text(input.feed.clientName, { width: CONTENT_WIDTH });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.muted)
    .text(`Generated ${formatDisplayDate(new Date())}`, { width: CONTENT_WIDTH });

  doc.moveDown(0.7);
  drawSectionRule(doc, BRAND.teal);
}

function drawCicoLine(
  doc: PdfDoc,
  employee: FeedEmployeeDay,
  locale: AppLocale,
  bcp47: string
) {
  const checkIn = employee.cico?.checkIn ?? null;
  const checkOut = employee.cico?.checkOut ?? null;
  const hasCico = checkIn != null || checkOut != null;

  if (!hasCico) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.muted)
      .text(translate(locale, "pages.reports.noCicoForEmployee"), {
        width: CONTENT_WIDTH,
      });
    return;
  }

  const checkInLabel = translate(locale, "pages.reports.cicoCheckIn");
  const checkOutLabel = translate(locale, "pages.reports.cicoCheckOut");
  const checkInTime = checkIn
    ? formatDisplayTime(checkIn, { timeZone: JAKARTA_TZ }, bcp47)
    : "—";
  const checkOutTime = checkOut
    ? formatDisplayTime(checkOut, { timeZone: JAKARTA_TZ }, bcp47)
    : "—";

  let durationPart = "";
  if (checkIn && checkOut) {
    const duration = formatWorkDuration(checkIn, checkOut);
    if (duration) durationPart = `  ·  ${duration}`;
  } else if (checkIn && !checkOut) {
    durationPart = `  ·  ${translate(locale, "pages.reports.cicoInProgress")}`;
  }

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(BRAND.body)
    .text(
      `${checkInLabel} ${checkInTime}  ·  ${checkOutLabel} ${checkOutTime}${durationPart}`,
      { width: CONTENT_WIDTH }
    );
}

function drawProgressReport(
  doc: PdfDoc,
  report: FeedProgressReport,
  photoBuffers: Map<string, Buffer>,
  locale: AppLocale,
  bcp47: string
) {
  ensureSpace(doc, 80);

  doc
    .roundedRect(PAGE_MARGIN, doc.y, CONTENT_WIDTH, 4, 1)
    .fill(BRAND.panelBg);
  doc.moveDown(0.35);

  const blockTop = doc.y;

  if (report.stageLabel) {
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(BRAND.ink)
      .text(report.stageLabel, PAGE_MARGIN, blockTop, { width: CONTENT_WIDTH });
    doc.moveDown(0.2);
  }

  if (report.notes) {
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(BRAND.body)
      .text(report.notes, { width: CONTENT_WIDTH });
    doc.moveDown(0.25);
  }

  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(BRAND.muted)
    .text(
      formatDisplayTime(report.createdAt, { timeZone: JAKARTA_TZ }, bcp47),
      { width: CONTENT_WIDTH }
    );
  doc.moveDown(0.35);

  if (report.photos.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.muted)
      .text(translate(locale, "pages.progress.noPhotos"), { width: CONTENT_WIDTH });
  } else {
    const photoWidth = 160;
    const photoHeight = 110;
    const gap = 12;
    let col = 0;
    let rowTop = doc.y;

    for (const photo of report.photos) {
      const buffer = photoBuffers.get(photo.url);
      if (!buffer) {
        if (col !== 0) {
          doc.y = rowTop + photoHeight + 16;
          col = 0;
        }
        ensureSpace(doc, 16);
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor(BRAND.muted)
          .text(`${translate(locale, "pages.reports.progressPhoto")}: ${photo.url}`, {
            width: CONTENT_WIDTH,
          });
        rowTop = doc.y;
        continue;
      }

      if (col === 0) {
        ensureSpace(doc, photoHeight + 20);
        rowTop = doc.y;
      }

      const x = PAGE_MARGIN + col * (photoWidth + gap);
      try {
        doc.image(buffer, x, rowTop, {
          fit: [photoWidth, photoHeight],
          align: "center",
          valign: "center",
        });
      } catch {
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor(BRAND.muted)
          .text(translate(locale, "pages.reports.progressPhoto"), x, rowTop, {
            width: photoWidth,
          });
      }

      col += 1;
      if (col >= 3) {
        doc.y = rowTop + photoHeight + 12;
        col = 0;
      }
    }

    if (col !== 0) {
      doc.y = rowTop + photoHeight + 12;
    }
  }

  doc.moveDown(0.5);
}

function drawEmployeeSection(
  doc: PdfDoc,
  employee: FeedEmployeeDay,
  photoBuffers: Map<string, Buffer>,
  locale: AppLocale,
  bcp47: string
) {
  ensureSpace(doc, 60);

  const headerY = doc.y;

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(BRAND.ink)
    .text(employee.name, PAGE_MARGIN, headerY, { width: CONTENT_WIDTH * 0.65 });

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(BRAND.muted)
    .text(employee.employeeNo, PAGE_MARGIN + CONTENT_WIDTH * 0.65, headerY + 1, {
      width: CONTENT_WIDTH * 0.35,
      align: "right",
    });

  doc.y = headerY + 16;
  drawCicoLine(doc, employee, locale, bcp47);
  doc.moveDown(0.35);

  if (employee.progressReports.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.muted)
      .text(translate(locale, "pages.reports.noProgressForEmployee"), {
        width: CONTENT_WIDTH,
      });
    doc.moveDown(0.45);
    return;
  }

  for (const report of employee.progressReports) {
    drawProgressReport(doc, report, photoBuffers, locale, bcp47);
  }
}

function drawDaySection(
  doc: PdfDoc,
  dateKey: string,
  employees: FeedEmployeeDay[],
  photoBuffers: Map<string, Buffer>,
  locale: AppLocale,
  bcp47: string
) {
  ensureSpace(doc, 48);

  const dayLabel = formatDisplayDate(dateKey, { timeZone: "UTC" }, bcp47);

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(BRAND.tealDeep)
    .text(dayLabel.toUpperCase(), PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });

  doc.moveDown(0.35);
  drawSectionRule(doc, BRAND.rule);

  for (const employee of employees) {
    drawEmployeeSection(doc, employee, photoBuffers, locale, bcp47);
  }

  doc.moveDown(0.35);
}

async function preloadPhotoBuffers(
  feed: ProjectMonthlyDayFeed
): Promise<Map<string, Buffer>> {
  const photoBuffers = new Map<string, Buffer>();
  for (const day of feed.days) {
    if (!day.hasActivity) continue;
    for (const employee of day.employees) {
      for (const report of employee.progressReports) {
        for (const photo of report.photos) {
          if (photoBuffers.has(photo.url)) continue;
          const buf = await loadImageBuffer(photo.url);
          if (buf) photoBuffers.set(photo.url, buf);
        }
      }
    }
  }
  return photoBuffers;
}

/**
 * Builds an A4 project monthly progress report PDF with RGS letterhead.
 * Empty days are omitted for a shorter document.
 */
export async function buildProjectMonthlyReportPdfBuffer(
  input: ProjectMonthlyReportPdfInput
): Promise<Buffer> {
  const letterhead = letterheadFromCompany(input.company);
  const logoBuffer = await loadBrandLogoBuffer();
  const locale = input.locale ?? DEFAULT_LOCALE;
  const bcp47 = localeToBcp47(locale);
  const photoBuffers = await preloadPhotoBuffers(input.feed);
  const activeDays = input.feed.days.filter((day) => day.hasActivity);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      info: {
        Title: `Progress Report — ${input.feed.projectName} — ${input.periodLabel}`,
        Author: letterhead.name,
        Subject: `${letterhead.name} project progress report`,
      },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const titleY = drawLetterheadHeader(doc, logoBuffer, letterhead);
    drawTitleBlock(doc, input, titleY);

    if (activeDays.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(BRAND.ink)
        .text(translate(locale, "pages.reports.noReports"), {
          width: CONTENT_WIDTH,
        });
    } else {
      for (const day of activeDays) {
        drawDaySection(doc, day.dateKey, day.employees, photoBuffers, locale, bcp47);
      }
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPdfPageFooter(
        doc,
        `Progress report  ·  Page ${i + 1} of ${range.count}`,
        letterhead
      );
    }

    doc.end();
  });
}
