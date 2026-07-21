import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import type PDFDocument from "pdfkit";
import {
  DISPLAY_COMPANY_NAME,
  LEGAL_COMPANY_NAME,
  LETTERHEAD,
} from "@/lib/company-identity";
import { defaultWebsiteContent } from "@/lib/website-content";

export {
  DISPLAY_COMPANY_NAME,
  LEGAL_COMPANY_NAME,
  LETTERHEAD,
} from "@/lib/company-identity";

export const PAGE_MARGIN = 48;
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
export const BOTTOM_SAFE = 760;

/**
 * Brand accents sampled from the official RGS letterhead logo / motif:
 * charcoal wordmark, mint-teal + periwinkle accents on white paper.
 */
export const PDF_BRAND = {
  teal: "#40c0b0",
  tealDeep: "#2a9a8c",
  tealSoft: "#e8f8f6",
  lavender: "#4f64b7",
  lavenderSoft: "#eef1f8",
  ink: "#252e39",
  body: "#3d4a57",
  muted: "#64748b",
  rule: "#d8dee6",
  white: "#ffffff",
  tableHeaderBg: "#2a9a8c",
  panelBg: "#f7f9fb",
} as const;

export type CompanyForPdf = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
};

export type LetterheadInfo = {
  name: string;
  addressLines: string[];
  address: string;
  email: string;
  phone: string;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

function pngSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

/** Scale image into a box without distortion; returns drawn size. */
function fitSize(
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number
): { width: number; height: number } {
  const scale = Math.min(maxW / naturalW, maxH / naturalH);
  return {
    width: Math.round(naturalW * scale * 100) / 100,
    height: Math.round(naturalH * scale * 100) / 100,
  };
}

export function resolveBrandLogoPath(): string | null {
  // Prefer the tightly cropped letterhead mark (no 1920×1080 padding).
  const root = path.join(/*turbopackIgnore: true*/ process.cwd());
  const candidates = [
    path.join(root, "public", "brand", "rgs-letterhead-logo.png"),
    path.join(root, "assets", "brand", "rgs-letterhead-logo.png"),
    path.join(root, "public", "brand", "rgs-logo.png"),
    path.join(root, "assets", "brand", "rgs-logo.png"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function loadBrandLogoBuffer(): Promise<Buffer | null> {
  const logoPath = resolveBrandLogoPath();
  if (!logoPath) return null;
  try {
    return await readFile(logoPath);
  } catch {
    return null;
  }
}

export function letterheadFromCompany(
  company?: CompanyForPdf | null
): LetterheadInfo {
  const site = defaultWebsiteContent;
  const name =
    company?.name?.trim() &&
    !/^rgs\s*(one|1|cleaning)$/i.test(company.name.trim())
      ? company.name.trim()
      : DISPLAY_COMPANY_NAME;

  const customAddress =
    company?.address?.trim() &&
    company.address.trim().toLowerCase() !== "jakarta, indonesia"
      ? company.address.trim()
      : null;

  const addressLines = customAddress
    ? customAddress.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    : [...LETTERHEAD.addressLines];

  const email =
    company?.email?.trim() || site.contact.email || LETTERHEAD.email;
  const phone =
    company?.phone?.trim() || site.contact.phone || LETTERHEAD.phone;

  return {
    name,
    addressLines,
    address: addressLines.join(", "),
    email,
    phone,
  };
}

export function drawBrandAccentBar(doc: PdfDoc, y: number, fullBleed = false) {
  const x = fullBleed ? 0 : PAGE_MARGIN;
  const width = fullBleed ? PAGE_WIDTH : CONTENT_WIDTH;
  const barH = 2;
  const tealW = Math.round(width * 0.68);
  doc.rect(x, y, tealW, barH).fill(PDF_BRAND.teal);
  doc.rect(x + tealW, y, width - tealW, barH).fill(PDF_BRAND.lavender);
}

function drawLogoFallback(
  doc: PdfDoc,
  letterhead: LetterheadInfo,
  x: number,
  y: number,
  width: number
): number {
  doc
    .fillColor(PDF_BRAND.ink)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("RGS", x, y, { width, lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(PDF_BRAND.body)
    .text(letterhead.name.toUpperCase(), x, y + 20, {
      width,
      lineBreak: false,
    });
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(PDF_BRAND.muted)
    .text(LEGAL_COMPANY_NAME, x, y + 30, { width, lineBreak: false });
  return y + 42;
}

/**
 * Official letterhead: cropped logo left, contact block right, brand accent bar.
 * Returns the Y position just below the accent rule (content start).
 */
export function drawLetterheadHeader(
  doc: PdfDoc,
  logoBuffer: Buffer | null,
  letterhead: LetterheadInfo
): number {
  const headerTop = 32;
  const logoMaxH = 38;
  const logoMaxW = 200;
  const gap = 20;
  const rightW = 248;
  const rightX = PAGE_MARGIN + CONTENT_WIDTH - rightW;

  let logoBottom = headerTop;

  if (logoBuffer) {
    try {
      const natural = pngSize(logoBuffer) ?? { width: 1758, height: 446 };
      const size = fitSize(natural.width, natural.height, logoMaxW, logoMaxH);
      // Cap so logo never eats into the contact column.
      const maxAllowedW = Math.max(120, rightX - PAGE_MARGIN - gap);
      const drawW = Math.min(size.width, maxAllowedW);
      const drawH = drawW * (size.height / size.width);

      doc.image(logoBuffer, PAGE_MARGIN, headerTop, {
        width: drawW,
        height: drawH,
      });
      logoBottom = headerTop + drawH;
    } catch {
      logoBottom = drawLogoFallback(
        doc,
        letterhead,
        PAGE_MARGIN,
        headerTop,
        logoMaxW
      );
    }
  } else {
    logoBottom = drawLogoFallback(
      doc,
      letterhead,
      PAGE_MARGIN,
      headerTop,
      logoMaxW
    );
  }

  // Right-aligned contact block (logo already carries the wordmark).
  const extraContactLines =
    (letterhead.phone ? 1 : 0) + (letterhead.email ? 1 : 0);
  const contactBlockH =
    12 + letterhead.addressLines.length * 10 + extraContactLines * 10 + 4;
  const contactTop = Math.max(
    headerTop,
    headerTop + (logoBottom - headerTop - contactBlockH) / 2
  );

  let ry = contactTop;
  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor(PDF_BRAND.ink)
    .text(LEGAL_COMPANY_NAME, rightX, ry, {
      width: rightW,
      align: "right",
      lineBreak: false,
    });
  ry += 12;

  for (const line of letterhead.addressLines) {
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(PDF_BRAND.body)
      .text(line, rightX, ry, {
        width: rightW,
        align: "right",
        lineBreak: false,
      });
    ry += 10;
  }

  if (letterhead.phone || letterhead.email) {
    ry += 2;
  }
  if (letterhead.phone) {
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(PDF_BRAND.ink)
      .text(letterhead.phone, rightX, ry, {
        width: rightW,
        align: "right",
        lineBreak: false,
      });
    ry += 10;
  }
  if (letterhead.email) {
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(PDF_BRAND.body)
      .text(letterhead.email, rightX, ry, {
        width: rightW,
        align: "right",
        lineBreak: false,
      });
    ry += 10;
  }

  const ruleY = Math.max(logoBottom, ry) + 12;
  drawBrandAccentBar(doc, ruleY, false);

  return ruleY + 16;
}

export function drawPdfPageFooter(
  doc: PdfDoc,
  pageLabel: string,
  letterhead?: LetterheadInfo
) {
  // Temporarily clear bottom margin so footer text cannot auto-spawn pages.
  const margins = doc.page.margins;
  const prevBottom = margins.bottom;
  margins.bottom = 0;

  const y = PAGE_HEIGHT - 36;

  const contactBits = letterhead
    ? [
        LEGAL_COMPANY_NAME,
        letterhead.addressLines[0],
        letterhead.phone,
        letterhead.email,
      ].filter(Boolean)
    : [LEGAL_COMPANY_NAME];

  doc
    .moveTo(PAGE_MARGIN, y - 8)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y - 8)
    .strokeColor(PDF_BRAND.rule)
    .lineWidth(0.6)
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(6.5)
    .fillColor(PDF_BRAND.muted)
    .text(contactBits.join("  ·  "), PAGE_MARGIN, y, {
      width: CONTENT_WIDTH * 0.72,
      lineBreak: false,
    });
  doc.text(pageLabel, PAGE_MARGIN, y, {
    width: CONTENT_WIDTH,
    align: "right",
    lineBreak: false,
  });

  margins.bottom = prevBottom;
}
