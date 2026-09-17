import PDFDocument from "pdfkit";

import { ensureCompanyForPdf } from "@/lib/company-for-pdf";
import type { ExpenseReportGrouped } from "@/lib/expense-report";
import { formatDisplayDate } from "@/lib/format-date";
import {
  DEFAULT_LOCALE,
  localeToBcp47,
  type AppLocale,
} from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { formatContractPrice } from "@/lib/project-billing";
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

const JAKARTA_TZ = "Asia/Jakarta";
const ROW_H = 34;
const HEADER_H = 24;
const GROUP_ROW_H = 22;
const TAX_LINE_H = 12;
const NET_ROW_H = 20;
const GROUP_HEADER_H = 22;
const PROJECT_HEADER_H = 18;

export type ExpenseReportPdfRow = {
  invoiceDate: Date;
  supplierName: string;
  invoiceRef: string | null;
  amount: number;
  statusLabel: string;
  payFromLabel?: string | null;
  payToLabel?: string | null;
};

export type ExpenseReportPdfInput = {
  periodLabel: string;
  rows: ExpenseReportPdfRow[];
  grouped?: ExpenseReportGrouped | null;
  company?: CompanyForPdf | null;
  locale?: AppLocale;
  totalAmount: number;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

const COLS = {
  date: { x: 0, w: 78 },
  vendor: { x: 78, w: 142 },
  reference: { x: 220, w: 100 },
  status: { x: 320, w: 62 },
  amount: { x: 382, w: CONTENT_WIDTH - 382 },
} as const;

const GROUP_COLS = {
  date: { x: 0, w: 72 },
  kind: { x: 72, w: 62 },
  detail: { x: 134, w: 248 },
  amount: { x: 382, w: CONTENT_WIDTH - 382 },
} as const;

function drawTitleBlock(
  doc: PdfDoc,
  input: ExpenseReportPdfInput,
  titleY: number
) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const hintKey = input.grouped
    ? "pages.billing.expenseReportHintGrouped"
    : "pages.billing.expenseReportHint";
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(BRAND.ink)
    .text(translate(locale, "pages.billing.expenseReportTitle"), PAGE_MARGIN, titleY, {
      width: CONTENT_WIDTH,
    });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(BRAND.body)
    .text(input.periodLabel, PAGE_MARGIN, doc.y + 4, {
      width: CONTENT_WIDTH,
    });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.muted)
    .text(translate(locale, hintKey), PAGE_MARGIN, doc.y + 2, {
      width: CONTENT_WIDTH,
    });
  doc.moveDown(1.1);
}

function drawTableHeader(doc: PdfDoc, locale: AppLocale) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);

  const labels = [
    { col: COLS.date, text: translate(locale, "pages.billing.expenseReportDate") },
    {
      col: COLS.vendor,
      text: translate(locale, "pages.billing.purchaseSupplier"),
    },
    {
      col: COLS.reference,
      text: translate(locale, "pages.billing.expenseReportReference"),
    },
    {
      col: COLS.status,
      text: translate(locale, "pages.billing.expenseReportStatus"),
    },
    {
      col: COLS.amount,
      text: translate(locale, "pages.billing.expenseReportAmount"),
      align: "right" as const,
    },
  ];

  doc.font("Helvetica-Bold").fontSize(7).fillColor(BRAND.white);
  for (const label of labels) {
    doc.text(label.text, PAGE_MARGIN + label.col.x + 4, y + 8, {
      width: label.col.w - 8,
      lineBreak: false,
      align: label.align,
    });
  }
  doc.y = y + HEADER_H;
}

function drawGroupedTableHeader(doc: PdfDoc, locale: AppLocale) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);
  const labels = [
    {
      col: GROUP_COLS.date,
      text: translate(locale, "pages.billing.expenseReportDate"),
    },
    {
      col: GROUP_COLS.kind,
      text: translate(locale, "pages.billing.expenseReportKind"),
    },
    {
      col: GROUP_COLS.detail,
      text: translate(locale, "pages.billing.expenseReportDetail"),
    },
    {
      col: GROUP_COLS.amount,
      text: translate(locale, "pages.billing.expenseReportAmount"),
      align: "right" as const,
    },
  ];
  doc.font("Helvetica-Bold").fontSize(7).fillColor(BRAND.white);
  for (const label of labels) {
    doc.text(label.text, PAGE_MARGIN + label.col.x + 4, y + 8, {
      width: label.col.w - 8,
      lineBreak: false,
      align: label.align,
    });
  }
  doc.y = y + HEADER_H;
}

function ensureRowSpace(doc: PdfDoc, locale: AppLocale, needed: number) {
  if (doc.y + needed <= BOTTOM_SAFE) return;
  doc.addPage();
  drawTableHeader(doc, locale);
}

function ensureGroupedSpace(doc: PdfDoc, locale: AppLocale, needed: number) {
  if (doc.y + needed <= BOTTOM_SAFE) return;
  doc.addPage();
  drawGroupedTableHeader(doc, locale);
}

function moneyColor(amount: number, kind?: "INCOME" | "EXPENSE") {
  if (kind === "INCOME") return BRAND.income;
  if (kind === "EXPENSE") return BRAND.expense;
  if (amount > 0) return BRAND.income;
  if (amount < 0) return BRAND.expense;
  return BRAND.ink;
}

function groupedLineHeight(line: ExpenseReportGrouped["groups"][number]["projects"][number]["lines"][number]) {
  let height = GROUP_ROW_H;
  if (line.payFromLabel || line.payToLabel) height += 11;
  if (line.kind === "INCOME" && line.tax) {
    if (line.tax.ppn > 0) height += TAX_LINE_H;
    if (line.tax.pph > 0) height += TAX_LINE_H;
    height += TAX_LINE_H;
  }
  return height;
}

function drawAmount(
  doc: PdfDoc,
  text: string,
  y: number,
  color: string,
  fontSize = 8
) {
  doc
    .font("Helvetica")
    .fontSize(fontSize)
    .fillColor(color)
    .text(text, PAGE_MARGIN + GROUP_COLS.amount.x, y, {
      width: GROUP_COLS.amount.w,
      lineBreak: false,
      align: "right",
    });
}

function drawNetRow(
  doc: PdfDoc,
  locale: AppLocale,
  label: string,
  amount: number,
  emphasize: boolean
) {
  ensureGroupedSpace(doc, locale, NET_ROW_H + 4);
  const y = doc.y + 2;
  if (emphasize) {
    doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, NET_ROW_H).fill(BRAND.tealSoft);
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(emphasize ? 9 : 8)
    .fillColor(BRAND.ink)
    .text(label, PAGE_MARGIN + 6, y + 5, {
      width: GROUP_COLS.amount.x - 12,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(emphasize ? 9 : 8)
    .fillColor(moneyColor(amount))
    .text(formatContractPrice(amount), PAGE_MARGIN + GROUP_COLS.amount.x, y + 5, {
      width: GROUP_COLS.amount.w,
      lineBreak: false,
      align: "right",
    });
  doc.y = y + NET_ROW_H;
}

function drawGroupedLine(
  doc: PdfDoc,
  locale: AppLocale,
  bcp47: string,
  line: ExpenseReportGrouped["groups"][number]["projects"][number]["lines"][number],
  stripe: boolean
) {
  const height = groupedLineHeight(line);
  ensureGroupedSpace(doc, locale, height);
  const y = doc.y;
  if (stripe) {
    doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, height).fill(BRAND.panelBg);
  }
  const kindLabel =
    line.kind === "INCOME"
      ? translate(locale, "pages.billing.expenseReportIncome")
      : translate(locale, "pages.billing.expenseReportExpense");
  const cells = [
    {
      col: GROUP_COLS.date,
      text: formatDisplayDate(line.date, { timeZone: JAKARTA_TZ }, bcp47),
    },
    { col: GROUP_COLS.kind, text: kindLabel },
    { col: GROUP_COLS.detail, text: line.detail || "—" },
  ];
  for (const cell of cells) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.ink)
      .text(cell.text, PAGE_MARGIN + cell.col.x + 4, y + 5, {
        width: cell.col.w - 8,
        lineBreak: false,
        ellipsis: true,
      });
  }
  drawAmount(
    doc,
    formatContractPrice(line.amount),
    y + 5,
    moneyColor(line.amount, line.kind)
  );

  let cursor = y + 16;
  if (line.payFromLabel || line.payToLabel) {
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(BRAND.muted)
      .text(
        translate(locale, "pages.billing.expenseReportBanks", {
          from: line.payFromLabel || "—",
          to: line.payToLabel || "—",
        }),
        PAGE_MARGIN + GROUP_COLS.detail.x + 4,
        cursor,
        {
          width: GROUP_COLS.detail.w - 8,
          lineBreak: false,
          ellipsis: true,
        }
      );
    cursor += 11;
  }

  if (line.kind === "INCOME" && line.tax) {
    const taxRows: Array<{ label: string; amount: number }> = [];
    if (line.tax.ppn > 0) {
      taxRows.push({
        label: translate(locale, "pages.billing.expenseReportPpn"),
        amount: line.tax.ppn,
      });
    }
    if (line.tax.pph > 0) {
      taxRows.push({
        label: translate(locale, "pages.billing.expenseReportPph"),
        amount: line.tax.pph,
      });
    }
    taxRows.push({
      label: translate(locale, "pages.billing.expenseReportGross"),
      amount: line.tax.gross,
    });
    for (const row of taxRows) {
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(BRAND.muted)
        .text(row.label, PAGE_MARGIN + GROUP_COLS.detail.x + 12, cursor, {
          width: GROUP_COLS.detail.w - 16,
          lineBreak: false,
        });
      drawAmount(doc, formatContractPrice(row.amount), cursor, BRAND.muted, 7);
      cursor += TAX_LINE_H;
    }
  }

  doc.y = y + height;
}

function drawGroupedReport(
  doc: PdfDoc,
  input: ExpenseReportPdfInput,
  grouped: ExpenseReportGrouped
) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const bcp47 = localeToBcp47(locale);

  if (grouped.groups.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(BRAND.ink)
      .text(translate(locale, "pages.billing.expenseReportEmptyGrouped"), {
        width: CONTENT_WIDTH,
      });
    return;
  }

  for (const group of grouped.groups) {
    ensureGroupedSpace(doc, locale, GROUP_HEADER_H + HEADER_H + GROUP_ROW_H);
    const headerY = doc.y;
    doc.rect(PAGE_MARGIN, headerY, CONTENT_WIDTH, GROUP_HEADER_H).fill(BRAND.lavenderSoft);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(BRAND.lavender)
      .text(group.title, PAGE_MARGIN + 8, headerY + 6, {
        width: CONTENT_WIDTH - 16,
      });
    doc.y = headerY + GROUP_HEADER_H;
    drawGroupedTableHeader(doc, locale);

    for (const project of group.projects) {
      ensureGroupedSpace(doc, locale, PROJECT_HEADER_H + GROUP_ROW_H);
      const projectY = doc.y + 3;
      const projectLabel = project.clientName
        ? `${project.projectName}  ·  ${project.clientName}`
        : project.projectName;
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(BRAND.ink)
        .text(projectLabel, PAGE_MARGIN + 4, projectY, {
          width: CONTENT_WIDTH - 8,
        });
      doc.y = projectY + PROJECT_HEADER_H - 3;

      project.lines.forEach((line, index) => {
        drawGroupedLine(doc, locale, bcp47, line, index % 2 === 0);
      });

      drawNetRow(
        doc,
        locale,
        translate(locale, "pages.billing.expenseReportProjectNet"),
        project.net,
        false
      );
      doc.moveDown(0.25);
    }

    drawNetRow(
      doc,
      locale,
      translate(locale, "pages.billing.expenseReportGroupNet"),
      group.net,
      true
    );
    doc.moveDown(0.45);
  }

  ensureGroupedSpace(doc, locale, NET_ROW_H * 3 + 10);
  drawNetRow(
    doc,
    locale,
    translate(locale, "pages.billing.expenseReportIncomeTotal"),
    grouped.incomeDpp,
    false
  );
  drawNetRow(
    doc,
    locale,
    translate(locale, "pages.billing.expenseReportExpenseTotal"),
    grouped.expenseTotal,
    false
  );
  drawNetRow(
    doc,
    locale,
    translate(locale, "pages.billing.expenseReportCompanyNet"),
    grouped.net,
    true
  );
}

function drawFlatReport(doc: PdfDoc, input: ExpenseReportPdfInput) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const bcp47 = localeToBcp47(locale);

  if (input.rows.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(BRAND.ink)
      .text(translate(locale, "pages.billing.expenseReportEmpty"), {
        width: CONTENT_WIDTH,
      });
    return;
  }

  drawTableHeader(doc, locale);
  input.rows.forEach((row, index) => {
    ensureRowSpace(doc, locale, ROW_H);
    const y = doc.y;
    if (index % 2 === 0) {
      doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, ROW_H).fill(BRAND.panelBg);
    }
    const cells = [
      {
        col: COLS.date,
        text: formatDisplayDate(row.invoiceDate, { timeZone: JAKARTA_TZ }, bcp47),
      },
      { col: COLS.vendor, text: row.supplierName || "—" },
      { col: COLS.reference, text: row.invoiceRef?.trim() || "—" },
      { col: COLS.status, text: row.statusLabel },
      {
        col: COLS.amount,
        text: formatContractPrice(row.amount),
        align: "right" as const,
        color: BRAND.expense,
      },
    ];
    for (const cell of cells) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("color" in cell && cell.color ? cell.color : BRAND.ink)
        .text(cell.text, PAGE_MARGIN + cell.col.x + 4, y + 5, {
          width: cell.col.w - 8,
          lineBreak: false,
          ellipsis: true,
          align: cell.align,
        });
    }
    if (row.payFromLabel || row.payToLabel) {
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(BRAND.muted)
        .text(
          translate(locale, "pages.billing.expenseReportBanks", {
            from: row.payFromLabel || "—",
            to: row.payToLabel || "—",
          }),
          PAGE_MARGIN + COLS.vendor.x + 4,
          y + 18,
          {
            width: COLS.reference.w + COLS.status.w + COLS.vendor.w - 8,
            lineBreak: false,
            ellipsis: true,
          }
        );
    }
    doc.y = y + ROW_H;
  });

  ensureRowSpace(doc, locale, ROW_H + 8);
  const totalY = doc.y + 6;
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(BRAND.ink)
    .text(translate(locale, "pages.billing.expenseReportTotal"), PAGE_MARGIN, totalY, {
      width: COLS.amount.x - 8,
    });
  doc
    .fillColor(BRAND.expense)
    .text(formatContractPrice(input.totalAmount), PAGE_MARGIN + COLS.amount.x, totalY, {
      width: COLS.amount.w,
      lineBreak: false,
      align: "right",
    });
}

export async function buildExpenseReportPdfBuffer(
  input: ExpenseReportPdfInput
): Promise<Buffer> {
  const letterhead = letterheadFromCompany(
    await ensureCompanyForPdf(input.company)
  );
  const logoBuffer = await loadBrandLogoBuffer();
  const locale = input.locale ?? DEFAULT_LOCALE;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      info: {
        Title: `${translate(locale, "pages.billing.expenseReportTitle")} — ${input.periodLabel}`,
        Author: letterhead.name,
        Subject: `${letterhead.name} expense report`,
      },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const titleY = drawLetterheadHeader(doc, logoBuffer, letterhead);
    drawTitleBlock(doc, input, titleY);

    if (input.grouped) {
      drawGroupedReport(doc, input, input.grouped);
    } else {
      drawFlatReport(doc, input);
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPdfPageFooter(
        doc,
        `${translate(locale, "pages.billing.expenseReportTitle")}  ·  Page ${i + 1} of ${range.count}`,
        letterhead
      );
    }

    doc.end();
  });
}
