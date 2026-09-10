import ExcelJS from "exceljs";

import { formatContractPrice } from "@/lib/project-billing";
import type { InternalPayrollPdfInput } from "@/lib/internal-payroll-pdf";

function sheetName(title: string) {
  return title.replace(/[\\/*?:\[\]]/g, " ").slice(0, 31) || "Payroll";
}

export function payrollSheetFilename(
  projectName: string,
  year: number,
  month: number
) {
  const slug =
    projectName
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "payroll-management";
  return `${slug}-${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}.xlsx`;
}

export async function buildInternalPayrollXlsxBuffer(
  input: InternalPayrollPdfInput
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RGS ONE";
  const title = input.title ?? "Payroll Management";
  const sheet = workbook.addWorksheet(sheetName(title));
  sheet.getColumn(1).width = 28;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 16;
  sheet.getColumn(5).width = 16;
  sheet.getColumn(6).width = 18;
  sheet.getColumn(7).width = 14;
  sheet.getColumn(8).width = 36;
  sheet.getColumn(9).width = 16;

  sheet.mergeCells("A1:I1");
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.mergeCells("A2:I2");
  sheet.getCell("A2").value = input.periodLabel;
  sheet.getCell("A2").font = { size: 11 };

  const header = sheet.getRow(4);
  header.values = [
    "Employee",
    "Employee No",
    "Days Worked",
    "Daily Rate",
    "Wage",
    "BPJS Kesehatan",
    "BPJS TK",
    "Deductions / Payables",
    "Net Pay",
  ];
  header.font = { bold: true };

  let rowNumber = 5;
  for (const employee of input.employees) {
    const deductionText = employee.deductions
      .map((line) => {
        const signed = line.payable ? line.amount : -Math.abs(line.amount);
        const detail = line.detail ? ` ${line.detail}` : "";
        return `${line.typeLabel}${detail} ${formatContractPrice(signed)}`;
      })
      .join("; ");
    sheet.getRow(rowNumber).values = [
      employee.name,
      employee.employeeNo,
      employee.daysWorked,
      employee.dailyRate,
      employee.wage,
      employee.bpjsKesehatan,
      employee.bpjsTk,
      deductionText,
      employee.netPay,
    ];
    rowNumber += 1;
  }

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}
