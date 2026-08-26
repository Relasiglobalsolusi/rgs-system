import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";

import { resolveCompanyBankDetails } from "@/lib/company-bank";
import { ensureCompanyForPdf } from "@/lib/company-for-pdf";
import { formatDisplayDate } from "@/lib/format-date";
import { formatInventoryQty } from "@/lib/inventory";
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
  type LetterheadInfo,
} from "@/lib/pdf-letterhead";
import { inventoryTypeCodeFromLabel } from "@/lib/inventory-sku";
import { formatContractPrice } from "@/lib/project-billing";
import { jakartaYearMonth } from "@/lib/vat";

export type SaleInvoicePdfInput = {
  invoiceNumber: string;
  soldAt: Date;
  buyerName: string;
  buyerType?: "INDIVIDUAL" | "COMPANY" | null;
  buyerPicName?: string | null;
  buyerPhone?: string | null;
  buyerTaxId?: string | null;
  buyerIdNumber?: string | null;
  itemName: string;
  itemSku: string;
  itemUnit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  taxAmount: number;
  taxRatePercent: number | null;
  totalPrice: number;
  notes?: string | null;
  company?: CompanyForPdf | null;
  paymentTermsDays?: number | null;
  dueAt?: Date | null;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

function formatInvoiceCalendarDate(value: Date): string {
  return formatDisplayDate(value, { timeZone: "UTC" });
}

function ensureSpace(doc: PdfDoc, needed: number) {
  if (doc.y + needed > BOTTOM_SAFE) {
    doc.addPage();
  }
}

function drawInvoiceHeader(
  doc: PdfDoc,
  logoBuffer: Buffer | null,
  letterhead: LetterheadInfo,
  invoiceNumber: string
) {
  const titleY = drawLetterheadHeader(doc, logoBuffer, letterhead);

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
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(BRAND.lavender)
    .text(invoiceNumber, metaRightX, titleY + 2, {
      width: metaRightW,
      align: "right",
    });
  const afterNumberY = doc.y;
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(BRAND.muted)
    .text("Sale invoice", metaRightX, afterNumberY + 2, {
      width: metaRightW,
      align: "right",
    });

  doc.y = Math.max(titleY + 34, doc.y + 10);
}

function drawMetaBlock(doc: PdfDoc, input: SaleInvoicePdfInput) {
  const issueDate = formatInvoiceCalendarDate(input.soldAt);
  const gap = 16;
  const colW = (CONTENT_WIDTH - gap) / 2;
  const leftX = PAGE_MARGIN;
  const rightX = PAGE_MARGIN + colW + gap;
  const startY = doc.y;
  const pad = 12;

  const billLines: string[] = [input.buyerName.trim() || "—"];
  if (input.buyerPicName?.trim()) {
    billLines.push(`PIC: ${input.buyerPicName.trim()}`);
  }
  if (input.buyerTaxId?.trim()) {
    billLines.push(`NPWP: ${input.buyerTaxId.trim()}`);
  }
  if (input.buyerIdNumber?.trim()) {
    billLines.push(`NIK: ${input.buyerIdNumber.trim()}`);
  }
  if (input.buyerPhone?.trim()) {
    billLines.push(input.buyerPhone.trim());
  }

  const dueDate =
    input.dueAt != null
      ? formatInvoiceCalendarDate(input.dueAt)
      : input.paymentTermsDays === 0
        ? "Due now"
        : issueDate;
  const details: [string, string][] = [
    ["Invoice No.", input.invoiceNumber],
    ["Invoice date", issueDate],
    ["Due date", dueDate],
  ];

  const billBodyH = 16 + billLines.length * 13 + (billLines.length > 1 ? 4 : 0);
  const detailsValueWidth = colW - pad * 2 - 88;
  const invoiceNoWrapLines = Math.max(
    1,
    Math.ceil(input.invoiceNumber.length / Math.max(18, detailsValueWidth / 6))
  );
  const detailsBodyH = 16 + (details.length - 1) * 16 + invoiceNoWrapLines * 16;
  const panelH = Math.max(billBodyH, detailsBodyH) + pad * 2;

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
    rightY = Math.max(rightY + 16, doc.y + 4);
  }

  doc.y = startY + panelH + 16;
}

function drawChargesTable(doc: PdfDoc, input: SaleInvoicePdfInput) {
  const description = `${input.itemName}${
    input.itemSku ? ` (${input.itemSku})` : ""
  }`;
  const qtyLabel = formatInventoryQty(input.quantity);
  const unitLabel = input.itemUnit?.trim() || "Unit";
  const lineAmount = formatContractPrice(input.subtotal);
  const unitAmount = formatContractPrice(input.unitPrice);

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(BRAND.teal)
    .text("CHARGES", PAGE_MARGIN, doc.y);
  doc.moveDown(0.4);

  const tableTop = doc.y;
  const colNo = 28;
  const colQty = 44;
  const colUnit = 70;
  const colAmt = 100;
  const colDesc = CONTENT_WIDTH - colNo - colQty - colUnit - colAmt;
  const rowPad = 8;
  const headerH = 24;

  doc.rect(PAGE_MARGIN, tableTop, CONTENT_WIDTH, headerH).fill(BRAND.tableHeaderBg);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(BRAND.white);

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

  const rowY = tableTop + headerH + 10;
  doc.font("Helvetica").fontSize(9).fillColor(BRAND.ink);

  x = PAGE_MARGIN + rowPad;
  doc.text("1", x, rowY, { width: colNo - rowPad });
  x += colNo;
  doc.text(description, x, rowY, { width: colDesc - rowPad });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(BRAND.muted)
    .text(`${unitAmount} / ${unitLabel}`, x, doc.y + 2, {
      width: colDesc - rowPad,
    });
  const descBottom = doc.y;
  x = PAGE_MARGIN + rowPad + colNo + colDesc;
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.ink)
    .text(qtyLabel, x, rowY, { width: colQty - 4, align: "right" });
  x += colQty;
  doc
    .fillColor(BRAND.muted)
    .text(unitLabel, x, rowY, { width: colUnit - 4, align: "center" });
  x += colUnit;
  doc
    .font("Helvetica-Bold")
    .fillColor(BRAND.ink)
    .text(lineAmount, x, rowY, {
      width: colAmt - rowPad * 2,
      align: "right",
    });

  doc.y = Math.max(descBottom, rowY + 12) + 10;

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

  const totalsW = 220;
  const totalsX = PAGE_MARGIN + CONTENT_WIDTH - totalsW;
  let ty = doc.y;
  const taxRate =
    input.taxRatePercent != null && Number.isFinite(input.taxRatePercent)
      ? input.taxRatePercent
      : null;

  const rows: [string, string][] = [
    ["Subtotal (DPP)", formatContractPrice(input.subtotal)],
    [
      taxRate != null ? `PPN ${taxRate}%` : "PPN",
      formatContractPrice(input.taxAmount),
    ],
  ];

  for (const [label, value] of rows) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BRAND.muted)
      .text(label, totalsX, ty, { width: 90 });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BRAND.ink)
      .text(value, totalsX + 90, ty, {
        width: totalsW - 90,
        align: "right",
      });
    ty += 18;
  }

  const panelH = 42;
  doc.roundedRect(totalsX, ty, totalsW, panelH, 4).fill(BRAND.tealSoft);
  doc.rect(totalsX, ty, 4, panelH).fill(BRAND.teal);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(BRAND.tealDeep)
    .text("TOTAL DUE", totalsX + 14, ty + 8, { width: 90 });
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(BRAND.ink)
    .text(formatContractPrice(input.totalPrice), totalsX + 100, ty + 12, {
      width: totalsW - 114,
      align: "right",
    });

  doc.y = ty + panelH + 18;
}

function drawPaymentAndNotes(
  doc: PdfDoc,
  input: SaleInvoicePdfInput,
  letterhead: LetterheadInfo
) {
  ensureSpace(doc, 160);

  const bank = resolveCompanyBankDetails(input.company);
  const bankName = bank?.bankName ?? null;
  const bankAccount = bank?.accountNumberDisplay ?? null;
  const bankAccountName = bank?.accountName ?? null;
  const hasBank = Boolean(bankAccount);

  const note = input.notes?.trim() || null;
  const termsLabel =
    input.paymentTermsDays === 0
      ? "Cash — due now"
      : typeof input.paymentTermsDays === "number" &&
          Number.isFinite(input.paymentTermsDays)
        ? `Net ${input.paymentTermsDays} days`
        : null;
  const dueLabel =
    input.dueAt != null
      ? formatInvoiceCalendarDate(input.dueAt)
      : input.paymentTermsDays === 0
        ? "Due now"
        : null;
  const bankLines = hasBank
    ? [
        "Please transfer to:",
        bankName,
        bankAccountName ? `Account name: ${bankAccountName}` : null,
        bankAccount ? `Account number: ${bankAccount}` : null,
      ].filter((line): line is string => Boolean(line))
    : [
        letterhead.name
          ? `Please use your agreed payment method with ${letterhead.name}.`
          : "Please use your agreed payment method.",
      ];
  if (termsLabel) bankLines.push(`Payment terms: ${termsLabel}`);
  if (dueLabel) bankLines.push(`Due date: ${dueLabel}`);

  const boxY = doc.y;
  const boxH = 36 + bankLines.length * 14 + (note ? 22 : 0);
  doc.roundedRect(PAGE_MARGIN, boxY, CONTENT_WIDTH, boxH, 4).fill(BRAND.panelBg);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(BRAND.lavender)
    .text("PAYMENT TERMS", PAGE_MARGIN + 12, boxY + 10, {
      width: CONTENT_WIDTH - 24,
    });

  let lineY = boxY + 26;
  for (const line of bankLines) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BRAND.body)
      .text(line, PAGE_MARGIN + 12, lineY, {
        width: CONTENT_WIDTH - 24,
      });
    lineY = doc.y + 2;
  }

  if (note) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.muted)
      .text(`Notes: ${note}`, PAGE_MARGIN + 12, doc.y + 8, {
        width: CONTENT_WIDTH - 24,
      });
  }

  doc.y = boxY + boxH + 14;

  drawBrandAccentBar(doc, doc.y, false);
  doc.moveDown(0.55);

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(BRAND.muted)
    .text(
      letterhead.name
        ? `${letterhead.name}  ·  Thank you for your business.`
        : "Thank you for your business.",
      {
        width: CONTENT_WIDTH,
        align: "center",
      }
    );
}

/**
 * Generates a sale invoice PDF under public/uploads/invoices/ and
 * returns the public URL path stored on InventorySale.invoiceUrl.
 */
export async function generateInventorySaleInvoicePdf(
  input: SaleInvoicePdfInput
): Promise<string> {
  const folder = "uploads/invoices";
  const filename = `sale-invoice-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.pdf`;
  const uploadDir = path.join(process.cwd(), "public", folder);
  await mkdir(uploadDir, { recursive: true });
  const filepath = path.join(uploadDir, filename);
  const publicPath = `/${folder}/${filename}`;

  const letterhead = letterheadFromCompany(
    await ensureCompanyForPdf(input.company)
  );
  const logoBuffer = await loadBrandLogoBuffer();

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      info: {
        Title: input.invoiceNumber,
        Author: letterhead.name,
        Subject: `${letterhead.name || "Sale"} invoice`,
      },
      bufferPages: true,
    });
    const stream = createWriteStream(filepath);
    doc.pipe(stream);

    drawInvoiceHeader(doc, logoBuffer, letterhead, input.invoiceNumber);
    drawMetaBlock(doc, input);
    drawChargesTable(doc, input);
    drawPaymentAndNotes(doc, input, letterhead);

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPdfPageFooter(
        doc,
        `Invoice  ·  Page ${i + 1} of ${range.count}`,
        letterhead
      );
    }

    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });

  return publicPath;
}

export function saleInvoiceNumber(options: {
  sequence: number;
  soldAt: Date;
  itemType: string;
}): string {
  const { year, month } = jakartaYearMonth(options.soldAt);
  const mm = String(month).padStart(2, "0");
  const type = inventoryTypeCodeFromLabel(options.itemType);
  const sequence = Math.max(1, Math.round(options.sequence));
  return `INV/${sequence}/${mm}${year}/${type}`;
}
