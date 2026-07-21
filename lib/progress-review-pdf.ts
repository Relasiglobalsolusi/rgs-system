/**
 * Client-facing progress package PDF for General / Facade billing periods
 * (pre-invoice review — not the commercial invoice).
 */

import { createWriteStream, existsSync } from "fs";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { formatDisplayDate } from "@/lib/format-date";
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

type ReportForPdf = {
  reportDate: Date;
  stageLabel: string | null;
  notes: string | null;
  employee: { firstName: string; lastName: string; employeeNo: string };
  photos: { url: string; caption?: string | null }[];
};

type ProgressReviewPdfInput = {
  projectName: string;
  clientName: string | null;
  location: string | null;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  amountLabel?: string | null;
  milestonePercent?: number | null;
  reports: ReportForPdf[];
  company?: CompanyForPdf | null;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

function publicUrlToFsPath(url: string): string | null {
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

async function loadImageBuffer(url: string): Promise<Buffer | null> {
  const filePath = publicUrlToFsPath(url);
  if (!filePath || !existsSync(filePath)) return null;
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") return null;
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

function formatUtcDate(value: Date): string {
  return formatDisplayDate(value, { timeZone: "UTC" });
}

export async function generateProgressReviewPdf(
  input: ProgressReviewPdfInput
): Promise<string> {
  const folder = "uploads/progress-reviews";
  const filename = `progress-review-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.pdf`;
  const uploadDir = path.join(process.cwd(), "public", folder);
  await mkdir(uploadDir, { recursive: true });
  const filepath = path.join(uploadDir, filename);
  const publicPath = `/${folder}/${filename}`;

  const letterhead = letterheadFromCompany(input.company);
  const logoBuffer = await loadBrandLogoBuffer();

  const photoBuffers = new Map<string, Buffer>();
  for (const report of input.reports) {
    for (const photo of report.photos) {
      if (photoBuffers.has(photo.url)) continue;
      const buf = await loadImageBuffer(photo.url);
      if (buf) photoBuffers.set(photo.url, buf);
    }
  }

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      info: {
        Title: `Progress Report — ${input.projectName}`,
        Author: letterhead.name,
        Subject: "Client progress review package",
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
      .text("PROGRESS REPORT", PAGE_MARGIN, titleY, { width: CONTENT_WIDTH });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BRAND.muted)
      .text(
        "Compiled site progress for client review — Approve or Revise in the portal before invoice.",
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
    if (input.milestonePercent != null) {
      meta.push(["Milestone", `${input.milestonePercent}% of project`]);
    }
    if (input.amountLabel) {
      meta.push(["Proposed amount", input.amountLabel]);
    }

    for (const [label, value] of meta) {
      ensureSpace(doc, 16);
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(BRAND.teal)
        .text(label.toUpperCase(), { width: 120 });
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
      .text(`Daily reports (${input.reports.length})`, { width: CONTENT_WIDTH });
    doc.moveDown(0.4);

    if (input.reports.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(BRAND.muted)
        .text("No progress reports were found for this period.", {
          width: CONTENT_WIDTH,
        });
    } else {
      for (const report of input.reports) {
        ensureSpace(doc, 80);
        const name = `${report.employee.firstName} ${report.employee.lastName}`.trim();
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(BRAND.ink)
          .text(
            `${formatUtcDate(report.reportDate)} · ${name} (${report.employee.employeeNo})`,
            { width: CONTENT_WIDTH }
          );
        if (report.stageLabel) {
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(BRAND.teal)
            .text(`Service area: ${report.stageLabel}`, {
              width: CONTENT_WIDTH,
            });
        }
        if (report.notes) {
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(BRAND.body)
            .text(report.notes, { width: CONTENT_WIDTH });
        }
        for (const photo of report.photos.slice(0, 4)) {
          const buf = photoBuffers.get(photo.url);
          if (!buf) continue;
          ensureSpace(doc, 160);
          try {
            doc.image(buf, {
              fit: [CONTENT_WIDTH, 140],
            });
            doc.moveDown(0.3);
          } catch {
            // skip corrupt image
          }
        }
        doc.moveDown(0.5);
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
