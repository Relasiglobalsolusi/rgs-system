import PDFDocument from "pdfkit";

import { ensureCompanyForPdf } from "@/lib/company-for-pdf";
import {
  CONTENT_WIDTH,
  PAGE_MARGIN,
  PDF_BRAND as BRAND,
  drawLetterheadHeader,
  drawPdfPageFooter,
  letterheadFromCompany,
  loadBrandLogoBuffer,
  type CompanyForPdf,
} from "@/lib/pdf-letterhead";

export type SimplePdfLine = {
  label: string;
  value: string;
  tone?: "income" | "expense" | "neutral";
};

export async function buildSimpleFinancePdfBuffer(input: {
  title: string;
  periodLabel: string;
  lines: SimplePdfLine[];
  company?: CompanyForPdf | null;
}): Promise<Buffer> {
  const letterhead = letterheadFromCompany(
    await ensureCompanyForPdf(input.company)
  );
  const logo = await loadBrandLogoBuffer();

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      info: { Title: `${input.title} — ${input.periodLabel}`, Author: letterhead.name },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const titleY = drawLetterheadHeader(doc, logo, letterhead);
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(BRAND.ink)
      .text(input.title, PAGE_MARGIN, titleY, { width: CONTENT_WIDTH });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(BRAND.body)
      .text(input.periodLabel, PAGE_MARGIN, doc.y + 4, { width: CONTENT_WIDTH });
    doc.moveDown(1);

    for (const line of input.lines) {
      const y = doc.y;
      const color =
        line.tone === "income"
          ? BRAND.income
          : line.tone === "expense"
            ? BRAND.expense
            : BRAND.ink;
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(BRAND.body)
        .text(line.label, PAGE_MARGIN, y, { width: CONTENT_WIDTH * 0.58 });
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(color)
        .text(line.value, PAGE_MARGIN + CONTENT_WIDTH * 0.58, y, {
          width: CONTENT_WIDTH * 0.42,
          align: "right",
          lineBreak: false,
        });
      doc.y = y + 16;
    }

    drawPdfPageFooter(doc, input.title, letterhead);
    doc.end();
  });
}
