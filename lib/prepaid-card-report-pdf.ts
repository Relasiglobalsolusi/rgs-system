import PDFDocument from "pdfkit";

import { ensureCompanyForPdf } from "@/lib/company-for-pdf";
import { formatDisplayDate } from "@/lib/format-date";
import {
  DEFAULT_LOCALE,
  localeToBcp47,
  type AppLocale,
} from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { formatPrepaidCardNumber } from "@/lib/prepaid-card";
import { formatContractPrice } from "@/lib/project-billing";
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

const JAKARTA_TZ = "Asia/Jakarta";
const ROW_H = 20;
const HEADER_H = 22;

export type PrepaidCardReportEntry = {
  entryDate: Date;
  cardNumber: string;
  assignmentLabel: string;
  kind: string;
  spendKind: string | null;
  amount: number;
  description: string;
  footedBy?: string | null;
};

export async function buildPrepaidCardReportPdfBuffer(input: {
  periodLabel: string;
  entries: PrepaidCardReportEntry[];
  totalTopUp: number;
  totalSpend: number;
  totalWrittenOff: number;
  company?: CompanyForPdf | null;
  locale?: AppLocale;
}): Promise<Buffer> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const bcp47 = localeToBcp47(locale);
  const letterhead = letterheadFromCompany(
    await ensureCompanyForPdf(input.company)
  );
  const logoBuffer = await loadBrandLogoBuffer();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      info: {
        Title: translate(locale, "pages.pettyCash.downloadReport"),
        Author: letterhead.name,
      },
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const titleY = drawLetterheadHeader(doc, logoBuffer, letterhead);
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(BRAND.ink)
      .text(translate(locale, "pages.pettyCash.downloadReport"), PAGE_MARGIN, titleY, {
        width: CONTENT_WIDTH,
      });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(BRAND.body)
      .text(input.periodLabel, PAGE_MARGIN, doc.y + 6, { width: CONTENT_WIDTH });
    doc.text(
      `${translate(locale, "pages.pettyCash.totalTopUp")}: ${formatContractPrice(input.totalTopUp)}`,
      PAGE_MARGIN,
      doc.y + 10,
      { width: CONTENT_WIDTH }
    );
    doc.text(
      `${translate(locale, "pages.pettyCash.totalSpend")}: ${formatContractPrice(input.totalSpend)}`,
      PAGE_MARGIN,
      doc.y + 4,
      { width: CONTENT_WIDTH }
    );
    doc.text(
      `${translate(locale, "pages.pettyCash.writtenOff")}: ${formatContractPrice(input.totalWrittenOff)}`,
      PAGE_MARGIN,
      doc.y + 4,
      { width: CONTENT_WIDTH }
    );
    doc.text(
      `${translate(locale, "pages.pettyCash.netPosition")}: ${formatContractPrice(input.totalTopUp - input.totalSpend)}`,
      PAGE_MARGIN,
      doc.y + 4,
      { width: CONTENT_WIDTH }
    );
    doc.moveDown(1.2);

    const cols = {
      date: { x: 0, w: 70 },
      card: { x: 70, w: 88 },
      assignment: { x: 158, w: 110 },
      kind: { x: 268, w: 80 },
      amount: { x: 348, w: CONTENT_WIDTH - 348 },
    };

    const drawHeader = () => {
      const y = doc.y;
      doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);
      doc.font("Helvetica-Bold").fontSize(7).fillColor(BRAND.white);
      const labels = [
        { col: cols.date, text: translate(locale, "pages.pettyCash.columns.date") },
        { col: cols.card, text: translate(locale, "pages.pettyCash.cardNumber") },
        { col: cols.assignment, text: translate(locale, "pages.pettyCash.assignment") },
        { col: cols.kind, text: translate(locale, "pages.pettyCash.columns.kind") },
        { col: cols.amount, text: translate(locale, "pages.pettyCash.columns.amount") },
      ];
      for (const label of labels) {
        doc.text(label.text, PAGE_MARGIN + label.col.x + 4, y + 7, {
          width: label.col.w - 8,
          lineBreak: false,
        });
      }
      doc.y = y + HEADER_H;
    };

    if (input.entries.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(BRAND.body)
        .text(translate(locale, "pages.pettyCash.entriesEmpty"), PAGE_MARGIN, doc.y);
    } else {
      drawHeader();
      input.entries.forEach((entry, index) => {
        if (doc.y + ROW_H > doc.page.height - 56) {
          doc.addPage();
          drawHeader();
        }
        const y = doc.y;
        if (index % 2 === 0) {
          doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, ROW_H).fill(BRAND.panelBg);
        }
        const kindLabel =
          entry.kind === "TOP_UP"
            ? translate(locale, "pages.pettyCash.kind.TOP_UP")
            : entry.kind === "WRITE_OFF"
              ? translate(locale, "pages.pettyCash.kind.WRITE_OFF")
              : entry.kind === "REPLACEMENT_FEE"
                ? translate(locale, "pages.pettyCash.kind.REPLACEMENT_FEE")
                : entry.kind === "TRANSFER_OUT"
                  ? translate(locale, "pages.pettyCash.kind.TRANSFER_OUT")
                  : entry.kind === "TRANSFER_IN"
                    ? translate(locale, "pages.pettyCash.kind.TRANSFER_IN")
                    : entry.spendKind === "TOLL"
                      ? translate(locale, "pages.pettyCash.spendToll")
                      : entry.spendKind === "PARKING"
                        ? translate(locale, "pages.pettyCash.spendParking")
                        : entry.spendKind === "OTHER"
                          ? translate(locale, "pages.pettyCash.spendOther")
                          : translate(locale, "pages.pettyCash.spendFuel");
        const sign =
          entry.kind === "TOP_UP" || entry.kind === "TRANSFER_IN" ? "+" : "−";
        const cells = [
          {
            col: cols.date,
            text: formatDisplayDate(entry.entryDate, { timeZone: JAKARTA_TZ }, bcp47),
          },
          { col: cols.card, text: formatPrepaidCardNumber(entry.cardNumber) },
          { col: cols.assignment, text: entry.assignmentLabel },
          {
            col: cols.kind,
            text: entry.footedBy ? `${kindLabel} · ${entry.footedBy}` : kindLabel,
          },
          {
            col: cols.amount,
            text: `${sign}${formatContractPrice(entry.amount)}`,
          },
        ];
        doc.font("Helvetica").fontSize(8).fillColor(BRAND.ink);
        for (const cell of cells) {
          doc.text(cell.text, PAGE_MARGIN + cell.col.x + 4, y + 5, {
            width: cell.col.w - 8,
            lineBreak: false,
            ellipsis: true,
          });
        }
        doc.y = y + ROW_H;
      });
    }

    drawPdfPageFooter(doc, "1", letterhead);
    doc.end();
  });
}
