import PDFDocument from "pdfkit";

import type {
  BpjsFinanceProgramLine,
  BpjsFinanceRemittanceRow,
  BpjsProgramEmployeeRow,
} from "@/lib/bpjs-finance";
import { ensureCompanyForPdf } from "@/lib/company-for-pdf";
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
const ROW_H = 22;
const EMP_ROW_H = 22;
const HEADER_H = 24;
const SUMMARY_ROW_H = 18;

const LINE_KEYS = {
  kesehatan: "pages.bpjs.lineKesehatan",
  jht: "pages.bpjs.lineJht",
  jp: "pages.bpjs.lineJp",
  jkk: "pages.bpjs.lineJkk",
  jkm: "pages.bpjs.lineJkm",
} as const;

export type BpjsReportPdfInput = {
  periodLabel: string;
  dueDate: Date;
  overdue: boolean;
  alreadyPaid: number;
  stillToPay: number;
  overdueAmount: number;
  holding: number;
  lines: BpjsFinanceProgramLine[];
  kesehatan: BpjsProgramEmployeeRow[];
  ketenagakerjaan: BpjsProgramEmployeeRow[];
  remittances: BpjsFinanceRemittanceRow[];
  company?: CompanyForPdf | null;
  locale?: AppLocale;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

const PROGRAM_COLS = {
  program: { x: 0, w: 118 },
  count: { x: 118, w: 52 },
  employee: { x: 170, w: 78 },
  company: { x: 248, w: 78 },
  paid: { x: 326, w: 72 },
  remaining: { x: 398, w: CONTENT_WIDTH - 398 },
} as const;

const EMP_COLS = {
  no: { x: 0, w: 118 },
  name: { x: 118, w: 120 },
  employee: { x: 238, w: 118 },
  company: { x: 356, w: 90 },
  total: { x: 446, w: CONTENT_WIDTH - 446 },
} as const;

const EMP_ID_W = 48;
const EMP_NAME_W = 70;
const EMP_PROG_W = (CONTENT_WIDTH - EMP_ID_W - EMP_NAME_W) / 7;
const EMP_TK_COLS = {
  no: { x: 0, w: EMP_ID_W },
  name: { x: EMP_ID_W, w: EMP_NAME_W },
  jht: { x: EMP_ID_W + EMP_NAME_W, w: EMP_PROG_W },
  jp: { x: EMP_ID_W + EMP_NAME_W + EMP_PROG_W, w: EMP_PROG_W },
  jkk: { x: EMP_ID_W + EMP_NAME_W + EMP_PROG_W * 2, w: EMP_PROG_W },
  jkm: { x: EMP_ID_W + EMP_NAME_W + EMP_PROG_W * 3, w: EMP_PROG_W },
  employee: { x: EMP_ID_W + EMP_NAME_W + EMP_PROG_W * 4, w: EMP_PROG_W },
  company: { x: EMP_ID_W + EMP_NAME_W + EMP_PROG_W * 5, w: EMP_PROG_W },
  total: { x: EMP_ID_W + EMP_NAME_W + EMP_PROG_W * 6, w: EMP_PROG_W },
} as const;

const PAY_COLS = {
  date: { x: 0, w: 78 },
  program: { x: 78, w: 140 },
  reference: { x: 218, w: 164 },
  amount: { x: 382, w: CONTENT_WIDTH - 382 },
} as const;

function programTitle(
  locale: AppLocale,
  key: "kesehatan" | "ketenagakerjaan" | string
) {
  return key === "ketenagakerjaan"
    ? translate(locale, "pages.bpjs.ketenagakerjaan")
    : translate(locale, "pages.bpjs.kesehatan");
}

function programmeAmount(row: BpjsProgramEmployeeRow, key: string) {
  const line = row.components.find((item) => item.key === key);
  if (!line) return null;
  return line.employeeAmount + line.companyAmount;
}

function drawTitleBlock(
  doc: PdfDoc,
  input: BpjsReportPdfInput,
  titleY: number
) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const bcp47 = localeToBcp47(locale);
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(BRAND.ink)
    .text(translate(locale, "pages.bpjs.reportTitle"), PAGE_MARGIN, titleY, {
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
    .text(translate(locale, "pages.bpjs.reportHint"), PAGE_MARGIN, doc.y + 2, {
      width: CONTENT_WIDTH,
    });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.body)
    .text(
      translate(locale, "pages.bpjs.dueDateHint", {
        date: formatDisplayDate(
          input.dueDate,
          { timeZone: JAKARTA_TZ },
          bcp47
        ),
      }),
      PAGE_MARGIN,
      doc.y + 4,
      { width: CONTENT_WIDTH }
    );
  doc.moveDown(1);
}

function ensureSpace(doc: PdfDoc, needed: number, onNewPage?: () => void) {
  if (doc.y + needed <= BOTTOM_SAFE) return;
  doc.addPage();
  onNewPage?.();
}

function drawSectionTitle(doc: PdfDoc, title: string) {
  ensureSpace(doc, 28);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(BRAND.ink)
    .text(title, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.35);
}

function drawSummary(doc: PdfDoc, input: BpjsReportPdfInput) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const lines = [
    [translate(locale, "pages.bpjs.alreadyPaid"), input.alreadyPaid],
    [translate(locale, "pages.bpjs.stillToPay"), input.stillToPay],
    [translate(locale, "pages.bpjs.overdue"), input.overdueAmount],
    [translate(locale, "pages.bpjs.reportHolding"), input.holding],
  ] as const;

  for (const [label, value] of lines) {
    ensureSpace(doc, SUMMARY_ROW_H);
    const y = doc.y;
    doc.font("Helvetica").fontSize(9).fillColor(BRAND.body).text(label, PAGE_MARGIN, y, {
      width: CONTENT_WIDTH - 160,
    });
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(BRAND.ink)
      .text(formatContractPrice(value), PAGE_MARGIN + CONTENT_WIDTH - 160, y, {
        width: 160,
        align: "right",
      });
    doc.y = y + SUMMARY_ROW_H;
  }
  doc.moveDown(0.6);
}

function drawProgramHeader(doc: PdfDoc, locale: AppLocale) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);
  const labels = [
    {
      col: PROGRAM_COLS.program,
      text: translate(locale, "pages.bpjs.columns.program"),
    },
    {
      col: PROGRAM_COLS.count,
      text: translate(locale, "pages.bpjs.columns.enrolled"),
    },
    {
      col: PROGRAM_COLS.employee,
      text: translate(locale, "pages.bpjs.columns.employeeShare"),
    },
    {
      col: PROGRAM_COLS.company,
      text: translate(locale, "pages.bpjs.columns.companyShare"),
    },
    {
      col: PROGRAM_COLS.paid,
      text: translate(locale, "pages.bpjs.columns.paid"),
    },
    {
      col: PROGRAM_COLS.remaining,
      text: translate(locale, "pages.bpjs.stillToPay"),
    },
  ];
  doc.font("Helvetica-Bold").fontSize(7).fillColor(BRAND.white);
  for (const label of labels) {
    doc.text(label.text, PAGE_MARGIN + label.col.x + 4, y + 8, {
      width: label.col.w - 8,
      lineBreak: false,
    });
  }
  doc.y = y + HEADER_H;
}

function drawProgramTable(doc: PdfDoc, locale: AppLocale, lines: BpjsFinanceProgramLine[]) {
  drawProgramHeader(doc, locale);
  lines.forEach((line, index) => {
    ensureSpace(doc, ROW_H, () => drawProgramHeader(doc, locale));
    const y = doc.y;
    if (index % 2 === 0) {
      doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, ROW_H).fill(BRAND.panelBg);
    }
    doc.font("Helvetica").fontSize(8).fillColor(BRAND.ink);
    const cells = [
      { col: PROGRAM_COLS.program, text: programTitle(locale, line.key) },
      { col: PROGRAM_COLS.count, text: String(line.employeeCount) },
      {
        col: PROGRAM_COLS.employee,
        text: formatContractPrice(line.employeeShare),
      },
      {
        col: PROGRAM_COLS.company,
        text: formatContractPrice(line.companyShare),
      },
      {
        col: PROGRAM_COLS.paid,
        text: formatContractPrice(line.alreadyPaid),
      },
      {
        col: PROGRAM_COLS.remaining,
        text: formatContractPrice(line.remaining),
        color: BRAND.expense,
      },
    ];
    for (const cell of cells) {
      doc
        .fillColor("color" in cell && cell.color ? cell.color : BRAND.ink)
        .text(cell.text, PAGE_MARGIN + cell.col.x + 4, y + 6, {
          width: cell.col.w - 8,
          lineBreak: false,
          ellipsis: true,
          align: "left",
        });
    }
    doc.y = y + ROW_H;
  });
  doc.moveDown(0.6);
}

function drawEmployeeHeader(
  doc: PdfDoc,
  locale: AppLocale,
  showProgrammes: boolean
) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);
  const labels = showProgrammes
    ? [
        {
          col: EMP_TK_COLS.no,
          text: translate(locale, "pages.bpjs.columns.employeeNo"),
        },
        {
          col: EMP_TK_COLS.name,
          text: translate(locale, "pages.bpjs.columns.employee"),
        },
        { col: EMP_TK_COLS.jht, text: translate(locale, LINE_KEYS.jht) },
        { col: EMP_TK_COLS.jp, text: translate(locale, LINE_KEYS.jp) },
        { col: EMP_TK_COLS.jkk, text: translate(locale, LINE_KEYS.jkk) },
        { col: EMP_TK_COLS.jkm, text: translate(locale, LINE_KEYS.jkm) },
        {
          col: EMP_TK_COLS.employee,
          text: translate(locale, "pages.bpjs.columns.employeeShare"),
        },
        {
          col: EMP_TK_COLS.company,
          text: translate(locale, "pages.bpjs.columns.companyShare"),
        },
        {
          col: EMP_TK_COLS.total,
          text: translate(locale, "pages.bpjs.columns.total"),
        },
      ]
    : [
        {
          col: EMP_COLS.no,
          text: translate(locale, "pages.bpjs.columns.employeeNo"),
        },
        {
          col: EMP_COLS.name,
          text: translate(locale, "pages.bpjs.columns.employee"),
        },
        {
          col: EMP_COLS.employee,
          text: translate(locale, "pages.bpjs.columns.employeeShare"),
        },
        {
          col: EMP_COLS.company,
          text: translate(locale, "pages.bpjs.columns.companyShare"),
        },
        {
          col: EMP_COLS.total,
          text: translate(locale, "pages.bpjs.columns.total"),
        },
      ];
  doc.font("Helvetica-Bold").fontSize(7).fillColor(BRAND.white);
  for (const label of labels) {
    doc.text(label.text, PAGE_MARGIN + label.col.x + 4, y + 8, {
      width: label.col.w - 8,
      lineBreak: false,
    });
  }
  doc.y = y + HEADER_H;
}

function drawEmployeeTable(
  doc: PdfDoc,
  locale: AppLocale,
  rows: BpjsProgramEmployeeRow[],
  showProgrammes = false
) {
  if (rows.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BRAND.body)
      .text(translate(locale, "pages.bpjs.employeesEmpty"), PAGE_MARGIN, doc.y, {
        width: CONTENT_WIDTH,
      });
    doc.moveDown(1);
    return;
  }

  const header = () => drawEmployeeHeader(doc, locale, showProgrammes);
  header();
  let employeeShare = 0;
  let companyShare = 0;
  let total = 0;
  const programmeTotals = { jht: 0, jp: 0, jkk: 0, jkm: 0 };
  rows.forEach((row, index) => {
    ensureSpace(doc, EMP_ROW_H, header);
    const y = doc.y;
    if (index % 2 === 0) {
      doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, EMP_ROW_H).fill(BRAND.panelBg);
    }
    employeeShare += row.employeeShare;
    companyShare += row.companyShare;
    total += row.total;
    doc.font("Helvetica").fontSize(7).fillColor(BRAND.ink);
    if (showProgrammes) {
      doc.text(row.employeeNo || "—", PAGE_MARGIN + EMP_TK_COLS.no.x + 4, y + 6, {
        width: EMP_TK_COLS.no.w - 8,
        lineBreak: false,
      });
      doc.text(row.name || "—", PAGE_MARGIN + EMP_TK_COLS.name.x + 4, y + 6, {
        width: EMP_TK_COLS.name.w - 8,
        lineBreak: false,
        ellipsis: true,
      });
      (["jht", "jp", "jkk", "jkm"] as const).forEach((key) => {
        const amount = programmeAmount(row, key);
        if (amount != null) programmeTotals[key] += amount;
        doc.text(
          amount == null ? "—" : formatContractPrice(amount),
          PAGE_MARGIN + EMP_TK_COLS[key].x + 4,
          y + 6,
          { width: EMP_TK_COLS[key].w - 8, lineBreak: false }
        );
      });
      doc.text(
        formatContractPrice(row.employeeShare),
        PAGE_MARGIN + EMP_TK_COLS.employee.x + 4,
        y + 6,
        { width: EMP_TK_COLS.employee.w - 8, lineBreak: false }
      );
      doc.text(
        formatContractPrice(row.companyShare),
        PAGE_MARGIN + EMP_TK_COLS.company.x + 4,
        y + 6,
        { width: EMP_TK_COLS.company.w - 8, lineBreak: false }
      );
      doc
        .fillColor(BRAND.expense)
        .text(
          formatContractPrice(row.total),
          PAGE_MARGIN + EMP_TK_COLS.total.x + 4,
          y + 6,
          { width: EMP_TK_COLS.total.w - 8, lineBreak: false }
        );
    } else {
      doc.text(row.employeeNo || "—", PAGE_MARGIN + EMP_COLS.no.x + 4, y + 6, {
        width: EMP_COLS.no.w - 8,
        lineBreak: false,
      });
      doc.text(row.name || "—", PAGE_MARGIN + EMP_COLS.name.x + 4, y + 6, {
        width: EMP_COLS.name.w - 8,
        lineBreak: false,
        ellipsis: true,
      });
      doc.text(
        formatContractPrice(row.employeeShare),
        PAGE_MARGIN + EMP_COLS.employee.x + 4,
        y + 6,
        { width: EMP_COLS.employee.w - 8, lineBreak: false }
      );
      doc.text(
        formatContractPrice(row.companyShare),
        PAGE_MARGIN + EMP_COLS.company.x + 4,
        y + 6,
        { width: EMP_COLS.company.w - 8, lineBreak: false }
      );
      doc
        .fillColor(BRAND.expense)
        .text(
          formatContractPrice(row.total),
          PAGE_MARGIN + EMP_COLS.total.x + 4,
          y + 6,
          { width: EMP_COLS.total.w - 8, lineBreak: false }
        );
    }
    doc.y = y + EMP_ROW_H;
  });

  ensureSpace(doc, ROW_H + 8);
  const totalY = doc.y + 6;
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(BRAND.ink)
    .text(translate(locale, "pages.bpjs.reportTotal"), PAGE_MARGIN, totalY, {
      width: showProgrammes ? EMP_TK_COLS.name.x + EMP_TK_COLS.name.w - 8 : EMP_COLS.employee.x - 8,
    });
  if (showProgrammes) {
    (["jht", "jp", "jkk", "jkm"] as const).forEach((key) => {
      doc.text(
        formatContractPrice(programmeTotals[key]),
        PAGE_MARGIN + EMP_TK_COLS[key].x,
        totalY,
        { width: EMP_TK_COLS[key].w, lineBreak: false }
      );
    });
    doc.text(formatContractPrice(employeeShare), PAGE_MARGIN + EMP_TK_COLS.employee.x, totalY, {
      width: EMP_TK_COLS.employee.w,
      lineBreak: false,
    });
    doc.text(formatContractPrice(companyShare), PAGE_MARGIN + EMP_TK_COLS.company.x, totalY, {
      width: EMP_TK_COLS.company.w,
      lineBreak: false,
    });
    doc
      .fillColor(BRAND.expense)
      .text(formatContractPrice(total), PAGE_MARGIN + EMP_TK_COLS.total.x, totalY, {
        width: EMP_TK_COLS.total.w,
        lineBreak: false,
      });
  } else {
    doc.text(formatContractPrice(employeeShare), PAGE_MARGIN + EMP_COLS.employee.x, totalY, {
      width: EMP_COLS.employee.w,
      lineBreak: false,
    });
    doc.text(formatContractPrice(companyShare), PAGE_MARGIN + EMP_COLS.company.x, totalY, {
      width: EMP_COLS.company.w,
      lineBreak: false,
    });
    doc
      .fillColor(BRAND.expense)
      .text(formatContractPrice(total), PAGE_MARGIN + EMP_COLS.total.x, totalY, {
        width: EMP_COLS.total.w,
        lineBreak: false,
      });
  }
  doc.y = totalY + ROW_H;
}

function drawPayHeader(doc: PdfDoc, locale: AppLocale) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);
  const labels = [
    { col: PAY_COLS.date, text: translate(locale, "pages.bpjs.paidAt") },
    { col: PAY_COLS.program, text: translate(locale, "pages.bpjs.columns.program") },
    { col: PAY_COLS.reference, text: translate(locale, "pages.bpjs.reference") },
    {
      col: PAY_COLS.amount,
      text: translate(locale, "pages.bpjs.amount"),
    },
  ];
  doc.font("Helvetica-Bold").fontSize(7).fillColor(BRAND.white);
  for (const label of labels) {
    doc.text(label.text, PAGE_MARGIN + label.col.x + 4, y + 8, {
      width: label.col.w - 8,
      lineBreak: false,
      align: "left",
    });
  }
  doc.y = y + HEADER_H;
}

function drawRemittanceTable(
  doc: PdfDoc,
  locale: AppLocale,
  rows: BpjsFinanceRemittanceRow[]
) {
  const bcp47 = localeToBcp47(locale);
  if (rows.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BRAND.body)
      .text(translate(locale, "pages.bpjs.remittancesEmpty"), PAGE_MARGIN, doc.y, {
        width: CONTENT_WIDTH,
      });
    doc.moveDown(1);
    return;
  }

  drawPayHeader(doc, locale);
  let total = 0;
  rows.forEach((row, index) => {
    ensureSpace(doc, ROW_H, () => drawPayHeader(doc, locale));
    const y = doc.y;
    if (index % 2 === 0) {
      doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, ROW_H).fill(BRAND.panelBg);
    }
    total += row.amount;
    doc.font("Helvetica").fontSize(8).fillColor(BRAND.ink);
    const cells = [
      {
        col: PAY_COLS.date,
        text: formatDisplayDate(row.paidAt, { timeZone: JAKARTA_TZ }, bcp47),
      },
      {
        col: PAY_COLS.program,
        text: programTitle(
          locale,
          row.program === "KETENAGAKERJAAN" ? "ketenagakerjaan" : "kesehatan"
        ),
      },
      { col: PAY_COLS.reference, text: row.reference?.trim() || "—" },
      {
        col: PAY_COLS.amount,
        text: formatContractPrice(row.amount),
        color: BRAND.expense,
      },
    ];
    for (const cell of cells) {
      doc
        .fillColor("color" in cell && cell.color ? cell.color : BRAND.ink)
        .text(cell.text, PAGE_MARGIN + cell.col.x + 4, y + 6, {
          width: cell.col.w - 8,
          lineBreak: false,
          ellipsis: true,
          align: "left",
        });
    }
    doc.y = y + ROW_H;
  });

  ensureSpace(doc, ROW_H + 8);
  const totalY = doc.y + 6;
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(BRAND.ink)
    .text(translate(locale, "pages.bpjs.reportTotal"), PAGE_MARGIN, totalY, {
      width: PAY_COLS.amount.x - 8,
    });
  doc
    .fillColor(BRAND.expense)
    .text(formatContractPrice(total), PAGE_MARGIN + PAY_COLS.amount.x, totalY, {
      width: PAY_COLS.amount.w,
      lineBreak: false,
    });
  doc.y = totalY + ROW_H;
}

export async function buildBpjsReportPdfBuffer(
  input: BpjsReportPdfInput
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
        Title: `${translate(locale, "pages.bpjs.reportTitle")} — ${input.periodLabel}`,
        Author: letterhead.name,
        Subject: `${letterhead.name} BPJS report`,
      },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const titleY = drawLetterheadHeader(doc, logoBuffer, letterhead);
    drawTitleBlock(doc, input, titleY);
    drawSummary(doc, input);

    const hasEmployees =
      input.kesehatan.length > 0 || input.ketenagakerjaan.length > 0;
    if (!hasEmployees && input.remittances.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(BRAND.ink)
        .text(translate(locale, "pages.bpjs.reportEmpty"), {
          width: CONTENT_WIDTH,
        });
    } else {
      drawSectionTitle(doc, translate(locale, "pages.bpjs.program"));
      drawProgramTable(doc, locale, input.lines);

      drawSectionTitle(
        doc,
        `${translate(locale, "pages.bpjs.reportEmployees")} — ${translate(locale, "pages.bpjs.kesehatan")}`
      );
      drawEmployeeTable(doc, locale, input.kesehatan);

      drawSectionTitle(
        doc,
        `${translate(locale, "pages.bpjs.reportEmployees")} — ${translate(locale, "pages.bpjs.ketenagakerjaan")}`
      );
      drawEmployeeTable(doc, locale, input.ketenagakerjaan, true);

      drawSectionTitle(doc, translate(locale, "pages.bpjs.remittancesTitle"));
      drawRemittanceTable(doc, locale, input.remittances);
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPdfPageFooter(
        doc,
        `${translate(locale, "pages.bpjs.reportTitle")}  ·  Page ${i + 1} of ${range.count}`,
        letterhead
      );
    }

    doc.end();
  });
}
