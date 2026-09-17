import PDFDocument from "pdfkit";

import { ensureCompanyForPdf } from "@/lib/company-for-pdf";
import { formatDisplayDate } from "@/lib/format-date";
import {
  DEFAULT_LOCALE,
  localeToBcp47,
  type AppLocale,
} from "@/lib/i18n/locale";
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
import { prisma } from "@/lib/prisma";

const JAKARTA_TZ = "Asia/Jakarta";
const ROW_H = 22;
const HEADER_H = 24;

export type ClientLoginIdPdfRow = {
  name: string;
  loginId: string;
};

const COLS = {
  name: { x: 0, w: CONTENT_WIDTH - 148 },
  loginId: { x: CONTENT_WIDTH - 148, w: 148 },
} as const;

type PdfDoc = InstanceType<typeof PDFDocument>;

export async function loadClientLoginIdRows(
  companyId: string
): Promise<ClientLoginIdPdfRow[]> {
  const clients = await prisma.client.findMany({
    where: {
      companyId,
      active: true,
    },
    select: {
      name: true,
      users: {
        where: { active: true },
        select: { username: true },
        orderBy: { username: "asc" },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  const rows: ClientLoginIdPdfRow[] = [];
  for (const client of clients) {
    if (client.users.length === 0) {
      rows.push({ name: client.name, loginId: "" });
      continue;
    }
    for (const user of client.users) {
      rows.push({
        name: client.name,
        loginId: user.username?.trim() ?? "",
      });
    }
  }
  return rows;
}

function ensureSpace(doc: PdfDoc, needed: number, onNewPage?: () => void) {
  if (doc.y + needed <= BOTTOM_SAFE) return;
  doc.addPage();
  onNewPage?.();
}

function drawTableHeader(doc: PdfDoc, locale: AppLocale) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);
  const labels = [
    {
      col: COLS.name,
      text: translate(locale, "pages.clients.loginIdExport.colName"),
    },
    {
      col: COLS.loginId,
      text: translate(locale, "pages.clients.loginIdExport.colLoginId"),
    },
  ];
  doc.font("Helvetica-Bold").fontSize(8).fillColor(BRAND.white);
  for (const label of labels) {
    doc.text(label.text, PAGE_MARGIN + label.col.x + 6, y + 8, {
      width: label.col.w - 12,
      lineBreak: false,
    });
  }
  doc.y = y + HEADER_H;
}

export async function buildClientLoginIdPdfBuffer(input: {
  rows: ClientLoginIdPdfRow[];
  printedAt?: Date;
  company?: CompanyForPdf | null;
  locale?: AppLocale;
}): Promise<Buffer> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const bcp47 = localeToBcp47(locale);
  const printedAt = input.printedAt ?? new Date();
  const letterhead = letterheadFromCompany(
    await ensureCompanyForPdf(input.company)
  );
  const logoBuffer = await loadBrandLogoBuffer();
  const title = translate(locale, "pages.clients.loginIdExport.reportTitle");

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      info: {
        Title: title,
        Author: letterhead.name,
        Subject: `${letterhead.name} client login IDs`,
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
      .text(title, PAGE_MARGIN, titleY, { width: CONTENT_WIDTH });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(BRAND.body)
      .text(
        translate(locale, "pages.clients.loginIdExport.generatedOn", {
          date: formatDisplayDate(
            printedAt,
            { timeZone: JAKARTA_TZ },
            bcp47
          ),
        }),
        PAGE_MARGIN,
        doc.y + 4,
        { width: CONTENT_WIDTH }
      );
    doc.moveDown(1);

    if (input.rows.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(BRAND.ink)
        .text(translate(locale, "pages.clients.loginIdExport.empty"), {
          width: CONTENT_WIDTH,
        });
    } else {
      drawTableHeader(doc, locale);
      input.rows.forEach((row, index) => {
        ensureSpace(doc, ROW_H, () => drawTableHeader(doc, locale));
        const y = doc.y;
        if (index % 2 === 0) {
          doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, ROW_H).fill(BRAND.panelBg);
        }
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(BRAND.ink)
          .text(row.name || "—", PAGE_MARGIN + COLS.name.x + 6, y + 6, {
            width: COLS.name.w - 12,
            lineBreak: false,
            ellipsis: true,
          });
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(BRAND.ink)
          .text(row.loginId || "—", PAGE_MARGIN + COLS.loginId.x + 6, y + 6, {
            width: COLS.loginId.w - 12,
            lineBreak: false,
            ellipsis: true,
          });
        doc.y = y + ROW_H;
      });
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPdfPageFooter(
        doc,
        `${title}  ·  Page ${i + 1} of ${range.count}`,
        letterhead
      );
    }

    doc.end();
  });
}
