import PDFDocument from "pdfkit";

import { RGS_ONE_PRODUCT_NAME, RGS_ONE_SLOGAN } from "@/lib/brand";
import { ensureCompanyForPdf } from "@/lib/company-for-pdf";
import { translate } from "@/lib/i18n/translate";
import {
  BOTTOM_SAFE,
  CONTENT_WIDTH,
  PAGE_HEIGHT,
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
import type { SystemGuideDocument } from "@/lib/system-guide/types";

type PdfDoc = InstanceType<typeof PDFDocument>;

function pngSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

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

/** Helvetica cannot print arrows, smart quotes, or em dashes. */
function toPdfText(value: string): string {
  return value
    .replace(/\u2014|\u2013|\u2212/g, "-")
    .replace(/\u2192|\u21d2/g, " > ")
    .replace(/\u2022/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[^\t\n\r\x20-\x7e]/g, "");
}

function ensureRoom(
  doc: PdfDoc,
  letterhead: LetterheadInfo,
  logo: Buffer | null,
  needed: number
) {
  if (doc.y + needed <= BOTTOM_SAFE) return;
  doc.addPage();
  doc.y = drawLetterheadHeader(doc, logo, letterhead);
}

function wrappedHeight(
  doc: PdfDoc,
  text: string,
  font: string,
  size: number
): number {
  doc.font(font).fontSize(size);
  return doc.heightOfString(toPdfText(text), { width: CONTENT_WIDTH });
}

function writeWrapped(
  doc: PdfDoc,
  letterhead: LetterheadInfo,
  logo: Buffer | null,
  text: string,
  options: {
    font?: string;
    size?: number;
    color?: string;
    gapAfter?: number;
    allowBreak?: boolean;
  } = {}
) {
  const font = options.font ?? "Helvetica";
  const size = options.size ?? 10;
  const color = options.color ?? BRAND.body;
  const safe = toPdfText(text);
  doc.font(font).fontSize(size);
  const height = doc.heightOfString(safe, { width: CONTENT_WIDTH });
  if (options.allowBreak !== false) {
    ensureRoom(doc, letterhead, logo, height + 8);
  }
  doc.fillColor(color).text(safe, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });
  if (options.gapAfter != null) doc.y += options.gapAfter;
}

function drawCover(
  doc: PdfDoc,
  guide: SystemGuideDocument,
  letterhead: LetterheadInfo,
  logo: Buffer | null
) {
  const locale = guide.locale;
  drawBrandAccentBar(doc, 0, true);

  let y = 88;
  if (logo) {
    const natural = pngSize(logo) ?? { width: 320, height: 80 };
    const size = fitSize(natural.width, natural.height, 220, 72);
    doc.image(logo, PAGE_MARGIN + (CONTENT_WIDTH - size.width) / 2, y, size);
    y += size.height + 28;
  } else {
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor(BRAND.ink)
      .text("RGS", PAGE_MARGIN, y, { width: CONTENT_WIDTH, align: "center" });
    y = doc.y + 18;
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(BRAND.tealDeep)
    .text(RGS_ONE_PRODUCT_NAME, PAGE_MARGIN, y, {
      width: CONTENT_WIDTH,
      align: "center",
    });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(BRAND.muted)
    .text(RGS_ONE_SLOGAN, PAGE_MARGIN, doc.y + 6, {
      width: CONTENT_WIDTH,
      align: "center",
    });

  doc.y += 36;
  drawBrandAccentBar(doc, doc.y, false);
  doc.y += 28;

  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor(BRAND.ink)
    .text(
      toPdfText(translate(locale, "pages.systemGuide.documentTitle")),
      PAGE_MARGIN,
      doc.y,
      { width: CONTENT_WIDTH, align: "center" }
    );
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(BRAND.body)
    .text(
      toPdfText(translate(locale, "pages.systemGuide.documentKind")),
      PAGE_MARGIN,
      doc.y + 10,
      { width: CONTENT_WIDTH, align: "center" }
    );

  doc.y += 36;
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(BRAND.ink)
    .text(
      toPdfText(
        translate(
          locale,
          guide.audience === "client"
            ? "pages.systemGuide.forClient"
            : "pages.systemGuide.forPosition",
          guide.audience === "client"
            ? { client: guide.positionName }
            : { position: guide.positionName }
        )
      ),
      PAGE_MARGIN,
      doc.y,
      { width: CONTENT_WIDTH, align: "center" }
    );

  if (guide.departmentLabel) {
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(BRAND.body)
      .text(toPdfText(guide.departmentLabel), PAGE_MARGIN, doc.y + 8, {
        width: CONTENT_WIDTH,
        align: "center",
      });
  }

  const countKey =
    guide.modules.length === 1
      ? "pages.systemGuide.moduleCountOne"
      : "pages.systemGuide.moduleCountOther";
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(BRAND.muted)
    .text(
      translate(locale, countKey, { count: guide.modules.length }),
      PAGE_MARGIN,
      doc.y + 16,
      { width: CONTENT_WIDTH, align: "center" }
    );

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.muted)
    .text(
      toPdfText(
        translate(locale, "pages.systemGuide.generatedOn", {
          date: guide.generatedOn,
        })
      ),
      PAGE_MARGIN,
      doc.y + 8,
      { width: CONTENT_WIDTH, align: "center" }
    );

  if (letterhead.name) {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(BRAND.ink)
      .text(letterhead.name, PAGE_MARGIN, PAGE_HEIGHT - 88, {
        width: CONTENT_WIDTH,
        align: "center",
      });
  }
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(BRAND.muted)
    .text(
      toPdfText(translate(locale, "pages.systemGuide.internalUse")),
      PAGE_MARGIN,
      PAGE_HEIGHT - 68,
      {
      width: CONTENT_WIDTH,
      align: "center",
    });
}

function drawContentsAndIntro(
  doc: PdfDoc,
  guide: SystemGuideDocument,
  letterhead: LetterheadInfo,
  logo: Buffer | null
) {
  const locale = guide.locale;
  doc.addPage();
  doc.y = drawLetterheadHeader(doc, logo, letterhead);

  writeWrapped(doc, letterhead, logo, translate(locale, "pages.systemGuide.contents"), {
    font: "Helvetica-Bold",
    size: 14,
    color: BRAND.ink,
    gapAfter: 10,
  });

  guide.modules.forEach((module, index) => {
    const line = `${index + 1}.  ${module.name}`;
    writeWrapped(doc, letterhead, logo, line, {
      size: 10,
      color: BRAND.body,
      gapAfter: 3,
    });
  });

  doc.y += 14;
  writeWrapped(doc, letterhead, logo, translate(locale, "pages.systemGuide.howToRead"), {
    font: "Helvetica-Bold",
    size: 12,
    color: BRAND.ink,
    gapAfter: 6,
  });
  writeWrapped(
    doc,
    letterhead,
    logo,
    translate(
      locale,
      guide.audience === "client"
        ? "pages.systemGuide.howToReadBodyClient"
        : "pages.systemGuide.howToReadBody"
    ),
    { size: 10, color: BRAND.body, gapAfter: 16 }
  );
}

const MODULE_DIVIDER_HEIGHT = 24;

function measureModuleBody(
  doc: PdfDoc,
  guide: SystemGuideDocument,
  index: number
): number {
  const locale = guide.locale;
  const module = guide.modules[index];
  if (!module) return 0;

  let height = 0;
  height +=
    wrappedHeight(
      doc,
      translate(locale, "pages.systemGuide.sectionTitle", {
        number: index + 1,
        name: module.name,
      }),
      "Helvetica-Bold",
      14
    ) + 8;
  height += wrappedHeight(doc, module.copy.purpose, "Helvetica", 10) + 10;
  height +=
    wrappedHeight(
      doc,
      translate(locale, "pages.systemGuide.openAt"),
      "Helvetica-Bold",
      9
    ) + 2;
  height += wrappedHeight(doc, module.openAt, "Helvetica", 10) + 12;
  height +=
    wrappedHeight(
      doc,
      translate(locale, "pages.systemGuide.steps"),
      "Helvetica-Bold",
      11
    ) + 6;
  for (const [stepIndex, step] of module.copy.steps.entries()) {
    height +=
      wrappedHeight(doc, `${stepIndex + 1}.  ${step}`, "Helvetica", 10) + 6;
  }
  if (module.copy.remember && module.copy.remember.length > 0) {
    height += 6;
    height +=
      wrappedHeight(
        doc,
        translate(locale, "pages.systemGuide.remember"),
        "Helvetica-Bold",
        11
      ) + 6;
    for (const note of module.copy.remember) {
      height += wrappedHeight(doc, `-  ${note}`, "Helvetica", 10) + 5;
    }
  }
  return height;
}

function drawModuleSection(
  doc: PdfDoc,
  guide: SystemGuideDocument,
  letterhead: LetterheadInfo,
  logo: Buffer | null,
  index: number
) {
  const locale = guide.locale;
  const module = guide.modules[index];
  if (!module) return;

  const bodyHeight = measureModuleBody(doc, guide, index);
  const dividerHeight = index > 0 ? MODULE_DIVIDER_HEIGHT : 0;
  if (doc.y + dividerHeight + bodyHeight > BOTTOM_SAFE) {
    doc.addPage();
    doc.y = drawLetterheadHeader(doc, logo, letterhead);
  } else if (index > 0) {
    doc.y += 10;
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
      .strokeColor(BRAND.rule)
      .lineWidth(0.6)
      .stroke();
    doc.y += 14;
  }

  const allowBreak = doc.y + bodyHeight > BOTTOM_SAFE;

  writeWrapped(
    doc,
    letterhead,
    logo,
    translate(locale, "pages.systemGuide.sectionTitle", {
      number: index + 1,
      name: module.name,
    }),
    {
      font: "Helvetica-Bold",
      size: 14,
      color: BRAND.ink,
      gapAfter: 8,
      allowBreak,
    }
  );

  writeWrapped(doc, letterhead, logo, module.copy.purpose, {
    size: 10,
    color: BRAND.body,
    gapAfter: 10,
    allowBreak,
  });

  writeWrapped(doc, letterhead, logo, translate(locale, "pages.systemGuide.openAt"), {
    font: "Helvetica-Bold",
    size: 9,
    color: BRAND.tealDeep,
    gapAfter: 2,
    allowBreak,
  });
  writeWrapped(doc, letterhead, logo, module.openAt, {
    size: 10,
    color: BRAND.body,
    gapAfter: 12,
    allowBreak,
  });

  writeWrapped(doc, letterhead, logo, translate(locale, "pages.systemGuide.steps"), {
    font: "Helvetica-Bold",
    size: 11,
    color: BRAND.ink,
    gapAfter: 6,
    allowBreak,
  });

  module.copy.steps.forEach((step, stepIndex) => {
    const text = `${stepIndex + 1}.  ${step}`;
    writeWrapped(doc, letterhead, logo, text, {
      size: 10,
      color: BRAND.body,
      gapAfter: 6,
      allowBreak,
    });
  });

  if (module.copy.remember && module.copy.remember.length > 0) {
    doc.y += 6;
    writeWrapped(doc, letterhead, logo, translate(locale, "pages.systemGuide.remember"), {
      font: "Helvetica-Bold",
      size: 11,
      color: BRAND.ink,
      gapAfter: 6,
      allowBreak,
    });
    for (const note of module.copy.remember) {
      writeWrapped(doc, letterhead, logo, `-  ${note}`, {
        size: 10,
        color: BRAND.body,
        gapAfter: 5,
        allowBreak,
      });
    }
  }
}

export async function buildSystemGuidePdfBuffer(input: {
  guide: SystemGuideDocument;
  company?: CompanyForPdf | null;
}): Promise<Buffer> {
  const letterhead = letterheadFromCompany(
    await ensureCompanyForPdf(input.company)
  );
  const logo = await loadBrandLogoBuffer();
  const { guide } = input;
  const locale = guide.locale;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      bufferPages: true,
      info: {
        Title: `${translate(locale, "pages.systemGuide.documentTitle")} - ${guide.positionName}`,
        Author: letterhead.name || RGS_ONE_PRODUCT_NAME,
        Subject: translate(locale, "pages.systemGuide.documentKind"),
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawCover(doc, guide, letterhead, logo);
    drawContentsAndIntro(doc, guide, letterhead, logo);
    guide.modules.forEach((_, index) => {
      drawModuleSection(doc, guide, letterhead, logo, index);
    });

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPdfPageFooter(
        doc,
        `${translate(locale, "pages.systemGuide.documentTitle")}  ·  ${translate(
          locale,
          "pages.systemGuide.pageOf",
          { page: i + 1, total: range.count }
        )}`,
        letterhead
      );
    }

    doc.end();
  });
}

export function systemGuideFilename(
  positionName: string,
  locale: SystemGuideDocument["locale"]
): string {
  const slug =
    positionName
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "position";
  return locale === "id"
    ? `Panduan-Sistem-RGS-ONE-${slug}.pdf`
    : `RGS-ONE-System-Guide-${slug}.pdf`;
}
