import PDFDocument from "pdfkit";

import { ensureCompanyForPdf } from "@/lib/company-for-pdf";
import { formatDisplayDate } from "@/lib/format-date";
import { localeToBcp47, type AppLocale } from "@/lib/i18n/locale";
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
import { formatContractPrice } from "@/lib/project-billing";

export type PayrollPdfDeductionLine = {
  typeLabel: string;
  amount: number;
  detail?: string | null;
  payable?: boolean;
};

export type PayrollPdfEmployee = {
  name: string;
  employeeNo: string;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  daysWorked: number;
  dailyRate: number;
  wage: number;
  bpjsKesehatan: number;
  bpjsTk: number;
  deductions: PayrollPdfDeductionLine[];
  netPay: number;
};

export type InternalPayrollPdfInput = {
  year: number;
  month: number;
  periodLabel: string;
  employees: PayrollPdfEmployee[];
  company?: CompanyForPdf | null;
  locale?: AppLocale;
  title?: string;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

function ensureSpace(doc: PdfDoc, needed: number) {
  if (doc.y + needed > BOTTOM_SAFE) {
    doc.addPage();
  }
}

function idr(amount: number) {
  return formatContractPrice(amount);
}

export async function buildInternalPayrollPdfBuffer(
  input: InternalPayrollPdfInput
): Promise<Buffer> {
  const locale = input.locale ?? "en";
  const logo = await loadBrandLogoBuffer();
  const letterhead = letterheadFromCompany(
    await ensureCompanyForPdf(input.company)
  );

  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    info: {
      Title: `${input.title ?? "Internal Payroll"} — ${input.periodLabel}`,
      Author: letterhead.name,
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const headerBottom = drawLetterheadHeader(doc, logo, letterhead);
  doc.y = headerBottom + 16;

  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(BRAND.ink)
    .text(
      input.title ?? translate(locale, "pages.payroll.pdfTitle"),
      PAGE_MARGIN,
      doc.y,
      {
      width: CONTENT_WIDTH,
    });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(BRAND.lavender)
    .text(input.periodLabel, PAGE_MARGIN, doc.y + 4, { width: CONTENT_WIDTH });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(BRAND.muted)
    .text(
      `${translate(locale, "pages.payroll.pdfGenerated")} ${formatDisplayDate(new Date(), undefined, localeToBcp47(locale))}`,
      PAGE_MARGIN,
      doc.y + 2,
      { width: CONTENT_WIDTH }
    );
  doc.moveDown(1);

  const totalGross = input.employees.reduce((sum, row) => sum + row.wage, 0);
  const totalNet = input.employees.reduce((sum, row) => sum + row.netPay, 0);

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.body)
    .text(
      `${translate(locale, "pages.payroll.totalWage")}: ${idr(totalGross)}    ${translate(locale, "pages.payroll.totalNetPay")}: ${idr(totalNet)}`,
      PAGE_MARGIN,
      doc.y,
      { width: CONTENT_WIDTH }
    );
  doc.moveDown(0.8);

  for (const employee of input.employees) {
    ensureSpace(doc, 90);
    const blockTop = doc.y;
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(BRAND.ink)
      .text(employee.name, PAGE_MARGIN, blockTop, {
        width: CONTENT_WIDTH * 0.65,
      });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.muted)
      .text(employee.employeeNo, PAGE_MARGIN + CONTENT_WIDTH * 0.65, blockTop, {
        width: CONTENT_WIDTH * 0.35,
        align: "right",
      });
    doc.moveDown(0.25);

    const lines: Array<[string, string]> = [
      [
        translate(locale, "pages.payroll.columns.bankName"),
        employee.bankName?.trim() || "—",
      ],
      [
        translate(locale, "pages.payroll.columns.accountNumber"),
        employee.bankAccountNumber?.trim() || "—",
      ],
      [
        translate(locale, "pages.payroll.columns.accountHolder"),
        employee.bankAccountName?.trim() || "—",
      ],
      [translate(locale, "pages.payroll.columns.daysWorked"), String(employee.daysWorked)],
      [translate(locale, "pages.payroll.columns.dailyRate"), idr(employee.dailyRate)],
      [translate(locale, "pages.payroll.pdfGross"), idr(employee.wage)],
    ];
    if (employee.bpjsKesehatan > 0) {
      lines.push([
        translate(locale, "pages.payroll.columns.bpjsKesehatan"),
        `− ${idr(employee.bpjsKesehatan)}`,
      ]);
    }
    if (employee.bpjsTk > 0) {
      lines.push([
        translate(locale, "pages.payroll.columns.bpjsTk"),
        `− ${idr(employee.bpjsTk)}`,
      ]);
    }
    for (const deduction of employee.deductions) {
      const prefix = deduction.payable ? "+" : "−";
      const label = deduction.detail
        ? `${deduction.typeLabel} (${deduction.detail})`
        : deduction.typeLabel;
      lines.push([label, `${prefix} ${idr(deduction.amount)}`]);
    }
    lines.push([translate(locale, "pages.payroll.columns.netPay"), idr(employee.netPay)]);

    for (const [label, value] of lines) {
      ensureSpace(doc, 14);
      const y = doc.y;
      doc
        .font(label === translate(locale, "pages.payroll.columns.netPay")
          ? "Helvetica-Bold"
          : "Helvetica")
        .fontSize(8.5)
        .fillColor(BRAND.body)
        .text(label, PAGE_MARGIN, y, { width: CONTENT_WIDTH * 0.7 });
      doc
        .font(label === translate(locale, "pages.payroll.columns.netPay")
          ? "Helvetica-Bold"
          : "Helvetica")
        .fontSize(8.5)
        .fillColor(BRAND.ink)
        .text(value, PAGE_MARGIN + CONTENT_WIDTH * 0.7, y, {
          width: CONTENT_WIDTH * 0.3,
          align: "right",
        });
      doc.y = y + 13;
    }
    doc.moveDown(0.45);
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
      .strokeColor(BRAND.rule)
      .lineWidth(0.6)
      .stroke();
    doc.moveDown(0.5);
  }

  if (input.employees.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BRAND.muted)
      .text(translate(locale, "pages.payroll.emptyDesc"), {
        width: CONTENT_WIDTH,
      });
  }

  drawPdfPageFooter(doc, "Internal Payroll", letterhead);
  doc.end();
  return done;
}
