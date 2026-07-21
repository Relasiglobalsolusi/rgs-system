import { createWriteStream, existsSync } from "fs";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { resolveCompanyBankDetails } from "@/lib/company-bank";
import { formatDisplayDate } from "@/lib/format-date";
import { formatProjectTitle } from "@/lib/project-billing";
import {
  BOTTOM_SAFE,
  CONTENT_WIDTH,
  LEGAL_COMPANY_NAME,
  PAGE_MARGIN,
  PDF_BRAND as BRAND,
  drawBrandAccentBar,
  drawLetterheadHeader,
  drawPdfPageFooter,
  letterheadFromCompany,
  loadBrandLogoBuffer,
  type CompanyForPdf,
  type LetterheadInfo,
} from "@/lib/pdf-letterhead";

type ReportForPdf = {
  reportDate: Date;
  stageLabel: string | null;
  notes: string | null;
  createdAt: Date;
  employee: { firstName: string; lastName: string; employeeNo: string };
  photos: { url: string; caption?: string | null }[];
};


type CompilePdfInput = {
  projectName: string;
  clientName: string | null;
  location: string | null;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  reports: ReportForPdf[];
  /** Optional invoice amount label (already formatted). */
  amountLabel?: string | null;
  /** Optional milestone percent (e.g. 30). */
  milestonePercent?: number | null;
  /** Title override (default monthly). */
  title?: string;
  company?: CompanyForPdf | null;
  /** Invoice issue calendar day (UTC date-only). Defaults to today when omitted. */
  issuedAt?: Date | null;
  dueAt?: Date | null;
  /** Client payment terms days (0 = Cash). Used in PAYMENT TERMS copy. */
  paymentTermsDays?: number | null;
  invoiceNumber?: string | null;
  clientAddress?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  /** Client Company Tax ID (NPWP) — shown when present. */
  clientNpwp?: string | null;
};

function publicUrlToFsPath(url: string): string | null {
  if (!url) return null;
  // Only embed local uploads under /uploads/...
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

type PdfDoc = InstanceType<typeof PDFDocument>;

function drawSectionRule(doc: PdfDoc, color: string = BRAND.rule) {
  doc
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
    .strokeColor(color)
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.75);
}

function ensureSpace(doc: PdfDoc, needed: number) {
  if (doc.y + needed > BOTTOM_SAFE) {
    doc.addPage();
  }
}

function chargeDescriptionFor(input: CompilePdfInput): string {
  if (input.milestonePercent != null) {
    return formatProjectTitle(input.projectName, {
      milestonePercent: input.milestonePercent,
      label: input.periodLabel,
    });
  }
  return `${input.projectName} — ${input.periodLabel}`;
}

function drawInvoiceHeader(
  doc: PdfDoc,
  logoBuffer: Buffer | null,
  letterhead: LetterheadInfo,
  invoiceNumber?: string | null
) {
  const titleY = drawLetterheadHeader(doc, logoBuffer, letterhead);

  // Document title row under the letterhead rule.
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(BRAND.ink)
    .text("INVOICE", PAGE_MARGIN, titleY, {
      width: CONTENT_WIDTH * 0.45,
      lineBreak: false,
    });

  const metaRightX = PAGE_MARGIN + CONTENT_WIDTH * 0.45;
  const metaRightW = CONTENT_WIDTH * 0.55;
  if (invoiceNumber) {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(BRAND.lavender)
      .text(invoiceNumber, metaRightX, titleY + 2, {
        width: metaRightW,
        align: "right",
        lineBreak: false,
      });
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(BRAND.muted)
      .text("Commercial invoice", metaRightX, titleY + 16, {
        width: metaRightW,
        align: "right",
        lineBreak: false,
      });
  } else {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.muted)
      .text("Commercial invoice", metaRightX, titleY + 6, {
        width: metaRightW,
        align: "right",
        lineBreak: false,
      });
  }

  doc.y = titleY + 34;
}

/** Date-only fields (issue / due) are stored as UTC midnight. */
function formatInvoiceCalendarDate(value: Date): string {
  return formatDisplayDate(value, { timeZone: "UTC" });
}

function drawMetaBlock(doc: PdfDoc, input: CompilePdfInput) {
  const issueDate = formatInvoiceCalendarDate(input.issuedAt ?? new Date());
  const gap = 16;
  const colW = (CONTENT_WIDTH - gap) / 2;
  const leftX = PAGE_MARGIN;
  const rightX = PAGE_MARGIN + colW + gap;
  const startY = doc.y;
  const pad = 12;

  // Measure content heights for equal panels.
  const billLines: string[] = [input.clientName?.trim() || "—"];
  if (input.clientNpwp?.trim()) billLines.push(`NPWP: ${input.clientNpwp.trim()}`);
  if (input.clientAddress?.trim()) billLines.push(input.clientAddress.trim());
  const clientContact = [input.clientEmail, input.clientPhone]
    .filter(Boolean)
    .join("  ·  ");
  if (clientContact) billLines.push(clientContact);

  const details: [string, string][] = [];
  if (input.invoiceNumber) details.push(["Invoice No.", input.invoiceNumber]);
  details.push(["Issue date", issueDate]);
  if (input.dueAt) {
    details.push(["Payment due", formatInvoiceCalendarDate(input.dueAt)]);
  }
  if (input.paymentTermsDays === 0) {
    details.push(["Payment terms", "Cash"]);
  } else if (
    typeof input.paymentTermsDays === "number" &&
    Number.isFinite(input.paymentTermsDays) &&
    input.paymentTermsDays > 0
  ) {
    details.push(["Payment terms", `Net ${input.paymentTermsDays}`]);
  }
  details.push(["Period", input.periodLabel]);
  if (input.milestonePercent != null) {
    details.push(["Milestone", `${input.milestonePercent}% of project`]);
  }

  const billBodyH = 16 + billLines.length * 13 + (billLines.length > 1 ? 4 : 0);
  const detailsBodyH = 16 + details.length * 15;
  const panelH = Math.max(billBodyH, detailsBodyH) + pad * 2;

  // Bill To panel
  doc.roundedRect(leftX, startY, colW, panelH, 4).fill(BRAND.panelBg);
  doc.rect(leftX, startY, 3, panelH).fill(BRAND.teal);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(BRAND.teal)
    .text("BILL TO", leftX + pad, startY + pad, { width: colW - pad * 2 });

  let leftY = startY + pad + 14;
  billLines.forEach((line, idx) => {
    doc
      .font(idx === 0 ? "Helvetica-Bold" : "Helvetica")
      .fontSize(idx === 0 ? 10 : 8.5)
      .fillColor(idx === 0 ? BRAND.ink : BRAND.body)
      .text(line, leftX + pad, leftY, { width: colW - pad * 2 });
    leftY = doc.y + 2;
  });

  // Details panel
  doc.roundedRect(rightX, startY, colW, panelH, 4).fill(BRAND.lavenderSoft);
  doc.rect(rightX, startY, 3, panelH).fill(BRAND.lavender);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(BRAND.lavender)
    .text("INVOICE DETAILS", rightX + pad, startY + pad, {
      width: colW - pad * 2,
    });

  let rightY = startY + pad + 14;
  for (const [label, value] of details) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.muted)
      .text(label, rightX + pad, rightY, { width: 88 });
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(BRAND.ink)
      .text(value, rightX + pad + 88, rightY, {
        width: colW - pad * 2 - 88,
        align: "right",
      });
    rightY += 15;
  }

  doc.y = startY + panelH + 16;
}

function drawServiceBlock(doc: PdfDoc, input: CompilePdfInput) {
  const blockY = doc.y;
  const blockH = input.location ? 52 : 40;

  doc.roundedRect(PAGE_MARGIN, blockY, CONTENT_WIDTH, blockH, 4).fill(BRAND.tealSoft);
  doc.rect(PAGE_MARGIN, blockY, 3, blockH).fill(BRAND.teal);

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(BRAND.tealDeep)
    .text("PROJECT / SERVICE", PAGE_MARGIN + 12, blockY + 8, {
      width: CONTENT_WIDTH - 24,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(BRAND.ink)
    .text(input.projectName, PAGE_MARGIN + 12, blockY + 20, {
      width: CONTENT_WIDTH - 24,
    });

  const metaBits = [
    input.location ? `Location: ${input.location}` : null,
    `Billing period: ${formatDisplayDate(input.periodStart)} – ${formatDisplayDate(input.periodEnd)}`,
  ].filter(Boolean);

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(BRAND.body)
    .text(metaBits.join("  ·  "), PAGE_MARGIN + 12, blockY + (input.location ? 34 : 32), {
      width: CONTENT_WIDTH - 24,
    });

  doc.y = blockY + blockH + 16;
}

function drawChargesTable(doc: PdfDoc, input: CompilePdfInput) {
  const description = chargeDescriptionFor(input);
  const chargeAmount = input.amountLabel ?? "As agreed / to be confirmed";
  const qty = "1";
  const unit = input.milestonePercent != null ? "Milestone" : "Period";

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(BRAND.teal)
    .text("CHARGES", PAGE_MARGIN, doc.y);
  doc.moveDown(0.4);

  const tableTop = doc.y;
  const colNo = 28;
  const colQty = 40;
  const colUnit = 70;
  const colAmt = 100;
  const colDesc = CONTENT_WIDTH - colNo - colQty - colUnit - colAmt;
  const rowPad = 8;
  const headerH = 24;

  // Table header — teal band with white labels
  doc.rect(PAGE_MARGIN, tableTop, CONTENT_WIDTH, headerH).fill(BRAND.tableHeaderBg);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(BRAND.white);

  let x = PAGE_MARGIN + rowPad;
  doc.text("#", x, tableTop + 8, { width: colNo - rowPad });
  x += colNo;
  doc.text("DESCRIPTION", x, tableTop + 8, { width: colDesc - rowPad });
  x += colDesc;
  doc.text("QTY", x, tableTop + 8, { width: colQty - 4, align: "right" });
  x += colQty;
  doc.text("UNIT", x, tableTop + 8, { width: colUnit - 4, align: "center" });
  x += colUnit;
  doc.text("AMOUNT", x, tableTop + 8, {
    width: colAmt - rowPad * 2,
    align: "right",
  });

  // Line item row
  const rowY = tableTop + headerH + 10;
  doc.font("Helvetica").fontSize(9).fillColor(BRAND.ink);

  x = PAGE_MARGIN + rowPad;
  doc.text("1", x, rowY, { width: colNo - rowPad });
  x += colNo;
  doc.text(description, x, rowY, { width: colDesc - rowPad });
  const descBottom = doc.y;
  const amountY = rowY;
  x += colDesc;
  doc.text(qty, x, amountY, { width: colQty - 4, align: "right" });
  x += colQty;
  doc
    .fillColor(BRAND.muted)
    .text(unit, x, amountY, { width: colUnit - 4, align: "center" });
  x += colUnit;
  doc
    .font("Helvetica-Bold")
    .fillColor(BRAND.ink)
    .text(chargeAmount, x, amountY, {
      width: colAmt - rowPad * 2,
      align: "right",
    });

  doc.y = Math.max(descBottom, amountY + 12) + 10;

  // Bottom rule with lavender accent tip
  const ruleY = doc.y;
  doc
    .moveTo(PAGE_MARGIN, ruleY)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH - 48, ruleY)
    .strokeColor(BRAND.rule)
    .lineWidth(1)
    .stroke();
  doc
    .moveTo(PAGE_MARGIN + CONTENT_WIDTH - 48, ruleY)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, ruleY)
    .strokeColor(BRAND.lavender)
    .lineWidth(2)
    .stroke();
  doc.moveDown(0.85);

  // Totals block (right-aligned)
  const totalsW = 220;
  const totalsX = PAGE_MARGIN + CONTENT_WIDTH - totalsW;
  let ty = doc.y;

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.muted)
    .text("Subtotal", totalsX, ty, { width: 90 });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.ink)
    .text(chargeAmount, totalsX + 90, ty, {
      width: totalsW - 90,
      align: "right",
    });
  ty += 18;

  // Amount due emphasis panel
  const panelH = 42;
  doc.roundedRect(totalsX, ty, totalsW, panelH, 4).fill(BRAND.tealSoft);
  doc.rect(totalsX, ty, 4, panelH).fill(BRAND.teal);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(BRAND.tealDeep)
    .text("TOTAL DUE", totalsX + 14, ty + 8, { width: 90 });
  if (input.dueAt) {
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(BRAND.muted)
      .text(`Due ${formatInvoiceCalendarDate(input.dueAt)}`, totalsX + 14, ty + 22, {
        width: 100,
      });
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(BRAND.ink)
    .text(chargeAmount, totalsX + 100, ty + 12, {
      width: totalsW - 114,
      align: "right",
    });

  doc.y = ty + panelH + 18;
}

function drawPaymentAndNotes(doc: PdfDoc, input: CompilePdfInput, reportCount: number) {
  ensureSpace(doc, 140);

  const bank = resolveCompanyBankDetails(input.company);
  const bankName = bank?.bankName ?? null;
  const bankAccount = bank?.accountNumberDisplay ?? null;
  const bankAccountName = bank?.accountName ?? null;
  const hasBank = Boolean(bankAccount);

  const boxY = doc.y;
  const boxH = hasBank ? 78 : 56;
  doc.roundedRect(PAGE_MARGIN, boxY, CONTENT_WIDTH, boxH, 4).fill(BRAND.panelBg);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(BRAND.lavender)
    .text("PAYMENT TERMS", PAGE_MARGIN + 12, boxY + 10, {
      width: CONTENT_WIDTH - 24,
    });

  const dueLine = (() => {
    if (input.paymentTermsDays === 0 && input.dueAt) {
      return `Payment terms: Cash. Please settle this invoice when submitted (due ${formatInvoiceCalendarDate(input.dueAt)}).`;
    }
    if (input.dueAt) {
      return `Please settle this invoice by ${formatInvoiceCalendarDate(input.dueAt)}.`;
    }
    return "Please settle this invoice within the agreed payment terms.";
  })();

  const bankLine = hasBank
    ? [
        "Transfer to:",
        bankName ? `${bankName}` : null,
        bankAccountName ? `a/n ${bankAccountName}` : null,
        bankAccount ? `Account ${bankAccount}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : `Please use your agreed payment method with ${LEGAL_COMPANY_NAME}.`;

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.body)
    .text(
      `${dueLine} Status: Awaiting Payment. ${bankLine}`,
      PAGE_MARGIN + 12,
      boxY + 24,
      { width: CONTENT_WIDTH - 24 }
    );

  doc.y = boxY + boxH + 14;

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(BRAND.body)
    .text(
      `Supporting documentation: ${reportCount} progress report(s) for this project/location in the period above are attached after this invoice page.`,
      { width: CONTENT_WIDTH }
    );
  doc.moveDown(1.2);

  drawBrandAccentBar(doc, doc.y, false);
  doc.moveDown(0.55);

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(BRAND.muted)
    .text(`${LEGAL_COMPANY_NAME}  ·  Thank you for your business.`, {
      width: CONTENT_WIDTH,
      align: "center",
    });
}

/**
 * Generates a combined invoice + progress-proof PDF under
 * public/uploads/invoices/ and returns the public URL path.
 *
 * Structure:
 * 1. Invoice page(s) — commercial summary for the client
 * 2. Supporting progress-report proof pages (with embedded photos when available)
 */
export async function generateInvoicePeriodPdf(
  input: CompilePdfInput
): Promise<string> {
  const folder = "uploads/invoices";
  const filename = `invoice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const uploadDir = path.join(process.cwd(), "public", folder);
  await mkdir(uploadDir, { recursive: true });
  const filepath = path.join(uploadDir, filename);
  const publicPath = `/${folder}/${filename}`;

  const letterhead = letterheadFromCompany(input.company);
  const logoBuffer = await loadBrandLogoBuffer();

  // Preload photo buffers so the PDF stream stays synchronous aside from I/O we already await.
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
        Title: input.title ?? "Progress Invoice",
        Author: letterhead.name,
        Subject: `${letterhead.name} commercial invoice`,
      },
      bufferPages: true,
    });
    const stream = createWriteStream(filepath);
    doc.pipe(stream);

    // ── Invoice pages ──────────────────────────────────────────────
    drawInvoiceHeader(doc, logoBuffer, letterhead, input.invoiceNumber);
    drawMetaBlock(doc, input);
    drawServiceBlock(doc, input);
    drawChargesTable(doc, input);
    drawPaymentAndNotes(doc, input, input.reports.length);

    // ── Supporting progress-report proof ───────────────────────────
    doc.addPage();

    // Slim letterhead accent on proof pages (not the full commercial header).
    drawBrandAccentBar(doc, 18, false);
    doc.y = 32;

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(BRAND.ink)
      .text("Supporting Progress Reports", PAGE_MARGIN, doc.y, {
        width: CONTENT_WIDTH,
      });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BRAND.muted)
      .text(
        `Proof documents for ${input.projectName}${
          input.location ? ` · ${input.location}` : ""
        } — ${input.periodLabel}`,
        { width: CONTENT_WIDTH }
      );
    doc.moveDown(0.55);
    drawSectionRule(doc, BRAND.teal);

    if (input.reports.length === 0) {
      doc
        .fillColor(BRAND.ink)
        .fontSize(11)
        .text("No progress reports were submitted for this project in this period.");
    } else {
      input.reports.forEach((report, index) => {
        ensureSpace(doc, 120);

        doc
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor(BRAND.ink)
          .text(
            `Report ${index + 1} of ${input.reports.length} — ${formatDisplayDate(report.reportDate)}`,
            { continued: false }
          );
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(BRAND.body)
          .text(
            `Submitted by: ${report.employee.firstName} ${report.employee.lastName} (${report.employee.employeeNo})`
          );
        if (report.stageLabel) {
          doc.text(`Service Area: ${report.stageLabel}`);
        }
        doc
          .fontSize(8)
          .fillColor("#94a3b8")
          .text(`Logged: ${formatDisplayDate(report.createdAt)}`);
        doc.moveDown(0.3);

        if (report.notes) {
          doc
            .fontSize(9)
            .fillColor(BRAND.body)
            .text(report.notes, { width: CONTENT_WIDTH });
          doc.moveDown(0.4);
        }

        if (report.photos.length === 0) {
          doc
            .fontSize(8)
            .fillColor("#94a3b8")
            .text("No photos attached to this report.");
        } else {
          doc
            .fontSize(8)
            .fillColor(BRAND.muted)
            .text(`Photos (${report.photos.length}):`);
          doc.moveDown(0.35);

          const photoWidth = 220;
          const photoHeight = 155;
          const gap = 16;
          let col = 0;
          let rowTop = doc.y;

          for (const photo of report.photos) {
            const buffer = photoBuffers.get(photo.url);
            if (!buffer) {
              if (col !== 0) {
                doc.y = rowTop + photoHeight + 20;
                col = 0;
              }
              ensureSpace(doc, 20);
              doc
                .fontSize(8)
                .fillColor("#94a3b8")
                .text(
                  `Photo unavailable for embed${
                    photo.caption ? ` (${photo.caption})` : ""
                  }: ${photo.url}`,
                  { width: CONTENT_WIDTH }
                );
              rowTop = doc.y;
              continue;
            }

            if (col === 0) {
              ensureSpace(doc, photoHeight + 24);
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
                .fontSize(8)
                .fillColor("#94a3b8")
                .text(`Could not embed photo`, x, rowTop, {
                  width: photoWidth,
                });
            }
            if (photo.caption) {
              doc
                .fontSize(8)
                .fillColor(BRAND.muted)
                .text(photo.caption, x, rowTop + photoHeight + 2, {
                  width: photoWidth,
                  height: 14,
                  ellipsis: true,
                });
            }

            col += 1;
            if (col >= 2) {
              doc.y = rowTop + photoHeight + (photo.caption ? 20 : 12);
              col = 0;
            }
          }

          if (col !== 0) {
            doc.y = rowTop + photoHeight + 20;
          }
        }

        doc.moveDown(0.8);
        if (index < input.reports.length - 1) {
          drawSectionRule(doc);
        }
      });
    }

    // Page footers (buffered so we know the total page count).
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const label =
        i === 0
          ? `Invoice  ·  Page ${i + 1} of ${range.count}`
          : `Progress proof  ·  Page ${i + 1} of ${range.count}`;
      drawPdfPageFooter(doc, label, letterhead);
    }

    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });

  return publicPath;
}
