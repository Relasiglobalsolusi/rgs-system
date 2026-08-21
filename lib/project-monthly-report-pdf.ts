import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";

import { ensureCompanyForPdf } from "@/lib/company-for-pdf";
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

/** Task entries sit under the employee header — never as wide as a person break. */
const TASK_INDENT = 14;
const DAY_BANNER_H = 28;
const DAY_BANNER_AFTER = 12;
const EMPLOYEE_HEADER_H = 46;
const EMPLOYEE_HEADER_AFTER = 10;
const DAY_BLOCK_GAP = 10;
const EMPLOYEE_BLOCK_GAP = 6;
/** Break a little early so rounding / wrapping cannot orphan a header. */
const KEEP_TOGETHER_FUDGE = 8;
const PHOTO_WIDTH = 148;
const PHOTO_HEIGHT = 102;
const PHOTO_GAP = 10;
const PHOTOS_PER_ROW = 3;

export type ProjectMonthlyReportPdfInput = {
  feed: ProjectMonthlyDayFeed;
  periodLabel: string;
  company?: CompanyForPdf | null;
  locale?: AppLocale;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

type PdfCtx = {
  locale: AppLocale;
  bcp47: string;
};

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

function drawDayBanner(doc: PdfDoc, ctx: PdfCtx, dayLabel: string) {
  const y = doc.y;
  const workDate = translate(ctx.locale, "pages.reports.pdfWorkDate");

  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, DAY_BANNER_H).fill(BRAND.ink);
  doc.rect(PAGE_MARGIN, y, 5, DAY_BANNER_H).fill(BRAND.teal);

  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(BRAND.teal)
    .text(workDate.toUpperCase(), PAGE_MARGIN + 14, y + 9, {
      width: 92,
      lineBreak: false,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(BRAND.white)
    .text(dayLabel, PAGE_MARGIN + 108, y + 8, {
      width: CONTENT_WIDTH - 122,
      lineBreak: false,
    });

  doc.y = y + DAY_BANNER_H + DAY_BANNER_AFTER;
}

function remainingOnPage(doc: PdfDoc): number {
  return BOTTOM_SAFE - doc.y;
}

function fullPageContentHeight(): number {
  return BOTTOM_SAFE - PAGE_MARGIN;
}

function ensureSpace(doc: PdfDoc, needed: number) {
  const remaining = remainingOnPage(doc);
  const request = Math.min(Math.max(needed, 0), fullPageContentHeight());
  if (
    request > remaining &&
    remaining < fullPageContentHeight() - KEEP_TOGETHER_FUDGE
  ) {
    doc.addPage();
  }
}

/**
 * Page-break before a block when header + first content cannot fit.
 * Leading gap is skipped if the block moves to a new page.
 * Oversized blocks stay on the current page when already near the top.
 */
function ensureKeepTogether(doc: PdfDoc, needed: number, leadingGap = 0) {
  const remaining = remainingOnPage(doc);
  const request = Math.min(
    Math.max(leadingGap + needed, 0),
    fullPageContentHeight()
  );
  if (
    request > remaining &&
    remaining < fullPageContentHeight() - KEEP_TOGETHER_FUDGE
  ) {
    doc.addPage();
    return;
  }
  if (leadingGap > 0) {
    doc.y += leadingGap;
  }
}

function measureWrappedHeight(
  doc: PdfDoc,
  text: string,
  font: string,
  size: number,
  width: number
): number {
  doc.font(font).fontSize(size);
  return doc.heightOfString(text, { width });
}

function measureProgressReportHeight(
  doc: PdfDoc,
  ctx: PdfCtx,
  report: FeedProgressReport,
  photoBuffers: Map<string, Buffer>
): number {
  const width = CONTENT_WIDTH - TASK_INDENT;
  let h = 0;

  if (report.stageLabel) {
    h += measureWrappedHeight(
      doc,
      report.stageLabel,
      "Helvetica-Bold",
      8,
      width
    );
    h += 0.15 * doc.currentLineHeight();
  }

  if (report.notes) {
    h += measureWrappedHeight(doc, report.notes, "Helvetica", 8.5, width);
    h += 0.2 * doc.currentLineHeight();
  }

  const timeLabel = formatDisplayTime(
    report.createdAt,
    { timeZone: JAKARTA_TZ },
    ctx.bcp47
  );
  h += measureWrappedHeight(doc, timeLabel, "Helvetica", 7.5, width);
  h += 0.3 * doc.currentLineHeight();

  if (report.photos.length === 0) {
    h += measureWrappedHeight(
      doc,
      translate(ctx.locale, "pages.progress.noPhotos"),
      "Helvetica",
      8,
      width
    );
  } else {
    let loaded = 0;
    let missing = 0;
    for (const photo of report.photos) {
      if (photoBuffers.get(photo.url)) loaded += 1;
      else missing += 1;
    }
    const rows = Math.ceil(loaded / PHOTOS_PER_ROW);
    h += rows * (PHOTO_HEIGHT + 14);
    if (missing > 0) {
      const sample = `${translate(ctx.locale, "pages.reports.progressPhoto")}: /`;
      h +=
        missing *
        (measureWrappedHeight(doc, sample, "Helvetica", 7.5, width) + 4);
    }
  }

  doc.font("Helvetica").fontSize(8);
  h += 0.4 * doc.currentLineHeight();
  return h + KEEP_TOGETHER_FUDGE;
}

function measureEmptyProgressHeight(doc: PdfDoc, ctx: PdfCtx): number {
  const width = CONTENT_WIDTH - TASK_INDENT;
  const h = measureWrappedHeight(
    doc,
    translate(ctx.locale, "pages.reports.noProgressForEmployee"),
    "Helvetica",
    8,
    width
  );
  return h + 0.45 * doc.currentLineHeight() + KEEP_TOGETHER_FUDGE;
}

/** Employee name bar + first report (or empty placeholder) — never split. */
function measureEmployeeKeepTogether(
  doc: PdfDoc,
  ctx: PdfCtx,
  employee: FeedEmployeeDay,
  photoBuffers: Map<string, Buffer>
): number {
  const headerBlock = EMPLOYEE_HEADER_H + EMPLOYEE_HEADER_AFTER;
  if (employee.progressReports.length === 0) {
    return headerBlock + measureEmptyProgressHeight(doc, ctx);
  }
  return (
    headerBlock +
    measureProgressReportHeight(
      doc,
      ctx,
      employee.progressReports[0],
      photoBuffers
    )
  );
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

  doc.moveDown(0.55);
}

function drawCicoLine(
  doc: PdfDoc,
  employee: FeedEmployeeDay,
  locale: AppLocale,
  bcp47: string,
  x: number,
  y: number,
  width: number
) {
  const checkIn = employee.cico?.checkIn ?? null;
  const checkOut = employee.cico?.checkOut ?? null;
  const hasCico = checkIn != null || checkOut != null;

  if (!hasCico) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.muted)
      .text(translate(locale, "pages.reports.noCicoForEmployee"), x, y, {
        width,
        lineBreak: false,
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
      x,
      y,
      { width, lineBreak: false }
    );
}

function drawProgressReport(
  doc: PdfDoc,
  ctx: PdfCtx,
  report: FeedProgressReport,
  photoBuffers: Map<string, Buffer>,
  options?: { allowBreakBefore?: boolean }
) {
  if (options?.allowBreakBefore !== false) {
    ensureSpace(doc, 72);
  }

  const x = PAGE_MARGIN + TASK_INDENT;
  const width = CONTENT_WIDTH - TASK_INDENT;

  if (report.stageLabel) {
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(BRAND.body)
      .text(report.stageLabel, x, doc.y, { width });
    doc.moveDown(0.15);
  }

  if (report.notes) {
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(BRAND.body)
      .text(report.notes, x, doc.y, { width });
    doc.moveDown(0.2);
  }

  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(BRAND.muted)
    .text(
      formatDisplayTime(report.createdAt, { timeZone: JAKARTA_TZ }, ctx.bcp47),
      x,
      doc.y,
      { width }
    );
  doc.moveDown(0.3);

  if (report.photos.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.muted)
      .text(translate(ctx.locale, "pages.progress.noPhotos"), x, doc.y, {
        width,
      });
  } else {
    let col = 0;
    let rowTop = doc.y;

    for (const photo of report.photos) {
      const buffer = photoBuffers.get(photo.url);
      if (!buffer) {
        if (col !== 0) {
          doc.y = rowTop + PHOTO_HEIGHT + 14;
          col = 0;
        }
        ensureSpace(doc, 16);
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor(BRAND.muted)
          .text(
            `${translate(ctx.locale, "pages.reports.progressPhoto")}: ${photo.url}`,
            x,
            doc.y,
            { width }
          );
        rowTop = doc.y;
        continue;
      }

      if (col === 0) {
        ensureSpace(doc, PHOTO_HEIGHT + 18);
        rowTop = doc.y;
      }

      const photoX = x + col * (PHOTO_WIDTH + PHOTO_GAP);
      try {
        doc.image(buffer, photoX, rowTop, {
          fit: [PHOTO_WIDTH, PHOTO_HEIGHT],
          align: "center",
          valign: "center",
        });
      } catch {
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor(BRAND.muted)
          .text(translate(ctx.locale, "pages.reports.progressPhoto"), photoX, rowTop, {
            width: PHOTO_WIDTH,
          });
      }

      col += 1;
      if (col >= PHOTOS_PER_ROW) {
        doc.y = rowTop + PHOTO_HEIGHT + 10;
        col = 0;
      }
    }

    if (col !== 0) {
      doc.y = rowTop + PHOTO_HEIGHT + 10;
    }
  }

  doc.moveDown(0.4);
}

function drawEmployeeHeader(
  doc: PdfDoc,
  ctx: PdfCtx,
  employee: FeedEmployeeDay
) {
  const y = doc.y;
  const padX = 12;
  const nameY = y + 8;
  const nameW = CONTENT_WIDTH * 0.58;
  const metaX = PAGE_MARGIN + nameW;
  const metaW = CONTENT_WIDTH - nameW - padX;

  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, EMPLOYEE_HEADER_H).fill(BRAND.lavenderSoft);
  doc.rect(PAGE_MARGIN, y, 3, EMPLOYEE_HEADER_H).fill(BRAND.lavender);

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(BRAND.ink)
    .text(employee.name, PAGE_MARGIN + padX, nameY, {
      width: nameW - padX,
      height: 14,
      ellipsis: true,
    });

  const empNoLabel = translate(ctx.locale, "pages.reports.pdfEmployeeNo");
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(BRAND.muted)
    .text(`${empNoLabel}  ${employee.employeeNo}`, metaX, nameY + 2, {
      width: metaW,
      align: "right",
      lineBreak: false,
    });

  drawCicoLine(
    doc,
    employee,
    ctx.locale,
    ctx.bcp47,
    PAGE_MARGIN + padX,
    y + 26,
    CONTENT_WIDTH - padX * 2
  );

  doc.y = y + EMPLOYEE_HEADER_H + EMPLOYEE_HEADER_AFTER;
}

function drawEmployeeSection(
  doc: PdfDoc,
  ctx: PdfCtx,
  employee: FeedEmployeeDay,
  photoBuffers: Map<string, Buffer>,
  isFirstOnDay: boolean
) {
  // First employee of the day is already reserved with the Work Date bar.
  if (!isFirstOnDay) {
    ensureKeepTogether(
      doc,
      measureEmployeeKeepTogether(doc, ctx, employee, photoBuffers),
      EMPLOYEE_BLOCK_GAP
    );
  }

  drawEmployeeHeader(doc, ctx, employee);

  if (employee.progressReports.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.muted)
      .text(
        translate(ctx.locale, "pages.reports.noProgressForEmployee"),
        PAGE_MARGIN + TASK_INDENT,
        doc.y,
        { width: CONTENT_WIDTH - TASK_INDENT }
      );
    doc.x = PAGE_MARGIN;
    doc.moveDown(0.45);
    return;
  }

  employee.progressReports.forEach((report, index) => {
    drawProgressReport(doc, ctx, report, photoBuffers, {
      // First entry must stay with the name bar; later entries may wrap pages.
      allowBreakBefore: index !== 0,
    });
  });
}

function drawDaySection(
  doc: PdfDoc,
  ctx: PdfCtx,
  dateKey: string,
  employees: FeedEmployeeDay[],
  photoBuffers: Map<string, Buffer>,
  isFirstDay: boolean
) {
  const dayLabel = formatDisplayDate(
    dateKey,
    { timeZone: "UTC", weekday: "long" },
    ctx.bcp47
  );

  const firstEmployee = employees[0];
  const firstEmployeeKeep = firstEmployee
    ? measureEmployeeKeepTogether(doc, ctx, firstEmployee, photoBuffers)
    : 0;
  ensureKeepTogether(
    doc,
    DAY_BANNER_H + DAY_BANNER_AFTER + firstEmployeeKeep,
    isFirstDay ? 0 : DAY_BLOCK_GAP
  );

  drawDayBanner(doc, ctx, dayLabel);

  employees.forEach((employee, index) => {
    drawEmployeeSection(doc, ctx, employee, photoBuffers, index === 0);
  });

  doc.moveDown(0.25);
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
  const letterhead = letterheadFromCompany(
    await ensureCompanyForPdf(input.company)
  );
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

    const ctx: PdfCtx = {
      locale,
      bcp47,
    };

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
      activeDays.forEach((day, index) => {
        drawDaySection(
          doc,
          ctx,
          day.dateKey,
          day.employees,
          photoBuffers,
          index === 0
        );
      });
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
