import type { AppLocale } from "@/lib/i18n/locale";
import {
  columnIndexToLetter,
  type TemplateDataValidationContext,
  worksheetWithDataValidations,
} from "@/lib/bulk-import/xlsx";

/** Columns auto-filled with N/A when Client Type is Individual. */
export const CLIENT_COMPANY_ONLY_COLUMN_KEYS = [
  "email",
  "countryCode",
  "phone",
  "contactPersonPosition",
  "contactPersonEmail",
  "contactPersonCountryCode",
  "contactPersonPhone",
] as const;

const CLIENT_COUNTRY_CODE_COLUMN_KEYS = new Set([
  "countryCode",
  "contactPersonCountryCode",
]);

const NA_DISPLAY_FONT = {
  name: "Calibri",
  size: 11,
  color: { argb: "FF6B7280" },
  italic: true,
};

const NA_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFF3F4F6" },
};

function excelStringLiteral(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function excelQuotedLiteral(value: string): string {
  return excelStringLiteral(value);
}

function individualClientTypeCheck(clientTypeCol: string, row: number): string {
  return `OR(UPPER(TRIM(${clientTypeCol}${row}))="INDIVIDUAL",UPPER(TRIM(${clientTypeCol}${row}))="PERORANGAN")`;
}

function individualClientTypeCheckRelative(
  clientTypeCol: string,
  firstDataRow: number
): string {
  return individualClientTypeCheck(clientTypeCol, firstDataRow);
}

function clientIndividualNaLabel(locale: AppLocale): string {
  return locale === "id" ? "Tidak berlaku" : "N/A";
}

/**
 * Individual rows: auto-fill company-only columns with N/A via formulas,
 * restrict dropdowns, and block edits on those cells (ExcelJS — no VBA).
 * Mirrors the project import Planning-stage N/A pattern.
 */
export function applyClientIndividualNaBehavior(
  locale: AppLocale,
  context: TemplateDataValidationContext
): void {
  const {
    workbook,
    dataSheet,
    listsSheet,
    firstDataRow,
    lastDataRow,
    columnLetter,
  } = context;

  const naLabel = clientIndividualNaLabel(locale);
  const clientTypeCol = columnLetter("clientType");
  const naListCol = context.nextListsColumn;
  listsSheet.getCell(1, naListCol).value = naLabel;
  const naListLetter = columnIndexToLetter(naListCol);
  const naListRange = `Lists!$${naListLetter}$1`;
  workbook.definedNames.add(naListRange, "ClientIndividualNA");

  const isIndividualRel = individualClientTypeCheckRelative(
    clientTypeCol,
    firstDataRow
  );

  for (let row = firstDataRow; row <= lastDataRow; row += 1) {
    for (const key of CLIENT_COMPANY_ONLY_COLUMN_KEYS) {
      const col = columnLetter(key);
      const cell = dataSheet.getCell(`${col}${row}`);
      cell.value = {
        formula: `IF(${individualClientTypeCheck(clientTypeCol, row)},${excelStringLiteral(naLabel)},"")`,
      };
      cell.font = {
        name: "Calibri",
        size: 11,
        color: { argb: "FF000000" },
        italic: false,
        bold: false,
      };
    }
  }

  let cfPriority = 50;
  for (const key of CLIENT_COMPANY_ONLY_COLUMN_KEYS) {
    const col = columnLetter(key);
    const ref = `${col}${firstDataRow}:${col}${lastDataRow}`;
    dataSheet.addConditionalFormatting({
      ref,
      rules: [
        {
          type: "expression",
          priority: cfPriority++,
          formulae: [
            `=${col}${firstDataRow}=${excelQuotedLiteral(naLabel)}`,
          ],
          style: {
            font: NA_DISPLAY_FONT,
            fill: NA_FILL,
          },
        },
      ],
    });
  }

  for (const key of CLIENT_COMPANY_ONLY_COLUMN_KEYS) {
    const col = columnLetter(key);
    const cellRef = `${col}${firstDataRow}`;

    if (CLIENT_COUNTRY_CODE_COLUMN_KEYS.has(key)) {
      worksheetWithDataValidations(dataSheet).dataValidations.add(
        `${col}${firstDataRow}:${col}${lastDataRow}`,
        {
          type: "list",
          allowBlank: true,
          formulae: [`=IF(${isIndividualRel},ClientIndividualNA,CountryCodes)`],
          showErrorMessage: true,
          errorTitle: locale === "id" ? "Nilai tidak valid" : "Invalid value",
          error:
            locale === "id"
              ? "Perorangan: Tidak berlaku saja. Perusahaan: pilih kode negara dari dropdown."
              : "Individual: N/A only. Company: choose a country code from the dropdown.",
        }
      );
      continue;
    }

    worksheetWithDataValidations(dataSheet).dataValidations.add(
      `${col}${firstDataRow}:${col}${lastDataRow}`,
      {
        type: "custom",
        allowBlank: true,
        formulae: [
          `=OR(NOT(${isIndividualRel}),${cellRef}=${excelQuotedLiteral(naLabel)})`,
        ],
        showErrorMessage: true,
        errorTitle: locale === "id" ? "Nilai tidak valid" : "Invalid value",
        error:
          locale === "id"
            ? "Kolom ini otomatis Tidak berlaku untuk Perorangan dan tidak dapat diubah."
            : "This column auto-fills N/A for Individual clients and cannot be edited.",
      }
    );
  }
}
