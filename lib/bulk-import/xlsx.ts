import { existsSync, readFileSync } from "fs";
import path from "path";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import {
  DATE_FORMAT_PLACEHOLDER,
  excelSerialToIsoDate,
  isDateFormatPlaceholder,
  isImportDateExcelColumn,
} from "@/lib/bulk-import/parse-import-date";
import { isCreatePortalLoginPlaceholder } from "@/lib/create-portal-login-flag";
import {
  isCountryCodePlaceholder,
  isPhoneFormatPlaceholder,
} from "@/lib/phone-normalize";

export type SpreadsheetRow = Record<string, string>;

export type WorksheetWithDataValidations = ExcelJS.Worksheet & {
  dataValidations: {
    add(
      address: string,
      rule: ExcelJS.DataValidation
    ): void;
  };
};

export function worksheetWithDataValidations(
  sheet: ExcelJS.Worksheet
): WorksheetWithDataValidations {
  return sheet as WorksheetWithDataValidations;
}

export type ColumnDef = {
  key: string;
  header: string;
  required?: boolean;
  aliases?: string[];
  /**
   * Soft content-width hint (character units). Final width is
   * max(full header length, this hint, placeholder / example), with a
   * floor. Dropdown / Lists option labels never affect column width.
   */
  width?: number;
  /**
   * Excel list validation — values written to a veryHidden Lists sheet.
   * Identical value arrays share one Lists column; country-code columns also
   * get a workbook named range (`CountryCodes`) for a scrollable dropdown.
   * Option label lengths are ignored when sizing Data columns.
   */
  dropdownValues?: string[];
  /**
   * List values for validation applied outside `dropdownValues`
   * (staff labels, scopes, project names, etc.). Not used for column width.
   */
  contentSamples?: string[];
  /** Center header and data cells horizontally and vertically. */
  centerContent?: boolean;
  /** Excel number format (e.g. dd/mm/yyyy for date columns). */
  numberFormat?: string;
  /** Pre-filled hint in empty data rows; import treats as blank. */
  placeholder?: string;
  /**
   * Excel comment on the column header cell (row 2).
   * Useful for short tips (e.g. Country Code keyboard scroll).
   */
  headerNote?: string;
  /**
   * Second line in the column header cell (row 2), below the title.
   * Rendered in the same cell with wrap; no Excel comment is added for this text.
   */
  headerSubline?: string;
};

/** Header cell text: title (+ optional *), optional subline on the next line. */
export function formatColumnHeaderCellValue(column: ColumnDef): string {
  const title = column.required ? `${column.header}*` : column.header;
  const subline = column.headerSubline?.trim();
  return subline ? `${title}\n${subline}` : title;
}

/** Rich header value when a subline is present (title bold, subline smaller/lighter). */
export function formatColumnHeaderCellRichValue(
  column: ColumnDef
): string | ExcelJS.CellRichTextValue {
  const title = column.required ? `${column.header}*` : column.header;
  const subline = column.headerSubline?.trim();
  if (!subline) return title;
  return {
    richText: [
      { text: `${title}\n`, font: { ...HEADER_TITLE_FONT } },
      { text: subline, font: { ...HEADER_SUBLINE_FONT } },
    ],
  };
}

function normalizeHeader(value: string): string {
  const firstLine = value.split(/\r?\n/)[0] ?? value;
  return firstLine
    .trim()
    .toLowerCase()
    .replace(/[*:\s_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHeaderLookup(columns: ColumnDef[]) {
  const lookup = new Map<string, string>();

  for (const column of columns) {
    const keys = [column.header, column.key, ...(column.aliases ?? [])];
    for (const key of keys) {
      lookup.set(normalizeHeader(key), column.key);
    }
  }

  return lookup;
}

export function cellToString(value: unknown): string {
  if (value == null) return "";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    const isoFromSerial = excelSerialToIsoDate(value);
    if (isoFromSerial) return isoFromSerial;
    // Large integers (e.g. NPWP) — avoid scientific notation in String(n)
    if (Math.abs(value) >= 1e10) {
      return Math.trunc(value).toLocaleString("en-US", {
        useGrouping: false,
        maximumFractionDigits: 0,
      });
    }
    if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9) {
      return String(Math.round(value));
    }
    return String(value);
  }

  const text = String(value).trim();
  if (/^\d{4,5}(\.\d+)?$/.test(text)) {
    const isoFromSerial = excelSerialToIsoDate(Number(text));
    if (isoFromSerial) return isoFromSerial;
  }
  if (
    isDateFormatPlaceholder(text) ||
    isPhoneFormatPlaceholder(text) ||
    isCountryCodePlaceholder(text) ||
    isCreatePortalLoginPlaceholder(text)
  ) {
    return "";
  }
  // Scientific notation from Excel number cells (e.g. 1.23456E+14)
  if (/^\d+(\.\d+)?e[+-]?\d+$/i.test(text)) {
    const asNumber = Number(text);
    if (Number.isFinite(asNumber) && Math.abs(asNumber) >= 1e10) {
      return Math.trunc(asNumber).toLocaleString("en-US", {
        useGrouping: false,
        maximumFractionDigits: 0,
      });
    }
  }
  // Excel General format often appends ".00" / ",00" to integers — those
  // trailing fraction zeros must not count as NPWP digits.
  if (/^\d+[.,]0+$/.test(text)) {
    return text.replace(/[.,]0+$/, "");
  }
  return text;
}

export function isRowEmpty(row: SpreadsheetRow, columns: ColumnDef[]): boolean {
  return columns.every((column) => !row[column.key]?.trim());
}

export async function readSpreadsheetFile(file: File): Promise<ArrayBuffer> {
  const maxBytes = 5 * 1024 * 1024;
  if (file.size <= 0) {
    throw new Error("The uploaded file is empty.");
  }
  if (file.size > maxBytes) {
    throw new Error("File is too large. Maximum size is 5 MB.");
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    throw new Error("Upload an Excel file (.xlsx).");
  }

  return file.arrayBuffer();
}

function scoreHeaderRow(
  cells: string[],
  headerLookup: Map<string, string>,
  columns: ColumnDef[]
): { score: number; columnIndex: Map<string, number> } {
  const columnIndex = new Map<string, number>();
  cells.forEach((header, index) => {
    if (!header) return;
    const key = headerLookup.get(header);
    if (key && !columnIndex.has(key)) {
      columnIndex.set(key, index);
    }
  });

  const requiredMatched = columns.filter(
    (column) => column.required && columnIndex.has(column.key)
  ).length;
  const requiredTotal = columns.filter((column) => column.required).length;
  const score =
    columnIndex.size * 10 +
    requiredMatched * 100 -
    (requiredTotal > 0 && requiredMatched < requiredTotal ? 500 : 0);

  return { score, columnIndex };
}

export function parseSpreadsheetRows(
  buffer: ArrayBuffer,
  columns: ColumnDef[],
  options?: { sheetName?: string; maxRows?: number }
): { rows: Array<{ rowNumber: number; values: SpreadsheetRow }>; sheetName: string } {
  // Keep Excel date serials as numbers (cellDates: false, raw: true).
  // raw:false returns locale display text (e.g. US "7/25/20") which our
  // day-first parser rejects when the day > 12. cellToString converts serials
  // via SSF.parse_date_code to stable YYYY-MM-DD.
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
  });

  const preferred = options?.sheetName ?? "Data";
  const sheetName =
    workbook.SheetNames.find(
      (name) => name.toLowerCase() === preferred.toLowerCase()
    ) ??
    workbook.SheetNames.find((name) => name.toLowerCase() !== "instructions") ??
    workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("The workbook has no worksheets.");
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
    sheet,
    {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false,
    }
  );

  if (matrix.length === 0) {
    throw new Error("The spreadsheet has no rows.");
  }

  const headerLookup = buildHeaderLookup(columns);
  let headerRowIndex = -1;
  let columnIndex = new Map<string, number>();
  let bestScore = -Infinity;

  const scanLimit = Math.min(matrix.length, 25);
  for (let i = 0; i < scanLimit; i += 1) {
    const headerCells = (matrix[i] ?? []).map((cell) =>
      normalizeHeader(cellToString(cell))
    );
    const scored = scoreHeaderRow(headerCells, headerLookup, columns);
    if (scored.score > bestScore) {
      bestScore = scored.score;
      headerRowIndex = i;
      columnIndex = scored.columnIndex;
    }
  }

  const missingRequired = columns
    .filter((column) => column.required && !columnIndex.has(column.key))
    .map((column) => column.header);

  if (headerRowIndex < 0 || missingRequired.length > 0) {
    throw new Error(
      missingRequired.length > 0
        ? `Missing required column${missingRequired.length === 1 ? "" : "s"}: ${missingRequired.join(", ")}.`
        : "Could not recognize any template columns. Download the template and keep the header row."
    );
  }

  if (columnIndex.size === 0) {
    throw new Error(
      "Could not recognize any template columns. Download the template and keep the header row."
    );
  }

  const maxRows = options?.maxRows ?? 2000;
  const rows: Array<{ rowNumber: number; values: SpreadsheetRow }> = [];

  for (let i = headerRowIndex + 1; i < matrix.length; i += 1) {
    if (rows.length >= maxRows) {
      throw new Error(
        `Too many data rows. Import at most ${maxRows} rows at a time.`
      );
    }

    const line = matrix[i] ?? [];
    const values: SpreadsheetRow = {};

    for (const column of columns) {
      const index = columnIndex.get(column.key);
      values[column.key] =
        index == null ? "" : cellToString(line[index] ?? "");
    }

    if (isRowEmpty(values, columns)) {
      continue;
    }

    // Excel row numbers are 1-based
    rows.push({ rowNumber: i + 1, values });
  }

  return { rows, sheetName };
}

const BRAND = {
  /** Dark header band — matches app logo bar (--color-brand-bar #0b1929). */
  navy: "FF0B1929",
  accent: "FF0F9D8A",
  headerText: "FFFFFFFF",
  tableHeader: "FF0C2D3A",
  border: "FF2F3E5A",
  exampleFill: "FFFFF4CE",
  exampleBorder: "FFE6C35C",
  muted: "FF64748B",
  title: "FF0F172A",
};

const HEADER_TITLE_FONT: Partial<ExcelJS.Font> = {
  name: "Calibri",
  size: 11,
  bold: true,
  color: { argb: BRAND.headerText },
};

/** Lighter second line on stacked column headers (dark teal band). */
const HEADER_SUBLINE_FONT: Partial<ExcelJS.Font> = {
  name: "Calibri",
  size: 9,
  bold: false,
  color: { argb: "FFB8C5CE" },
};

const HEADER_LAYOUT = {
  /** Max logo width in px; height follows natural aspect ratio (never cropped). */
  logoMaxWidthPx: 200,
  logoPaddingVPx: 14,
  /** Left inset for logo as a fraction of the first column width. */
  logoColOffset: 0.08,
  titleFontSize: 20,
  columnHeaderRowHeight: 38,
  /** Taller row 2 when any column uses a stacked header subline. */
  columnHeaderRowHeightMultiLine: 62,
  columnHeaderMinWidth: 18,
  dataValidationLastRow: 5000,
  /** Pre-filled placeholder rows on the Data sheet (rows 3–10). */
  placeholderDataRowCount: 8,
};

/** Excel column-width character units for bulk-import Data sheets. */
const COLUMN_WIDTH = {
  /** Modest pad so bold headers aren't flush against the edge. */
  padding: 3,
  /** Absolute minimum — short headers/values stay narrow. */
  min: 10,
  /**
   * Cap for placeholder / example text lengths only.
   * Full header length always wins so titles are never truncated.
   */
  contentMax: 34,
};

/** Template column keys that share the scrollable CountryCodes named range. */
export function isCountryCodeTemplateColumn(columnKey: string): boolean {
  return (
    columnKey === "countryCode" ||
    columnKey === "contactPersonCountryCode" ||
    /CountryCode$/i.test(columnKey)
  );
}

/** Default data-entry font for empty / typed cells. */
const DATA_ENTRY_FONT: Partial<ExcelJS.Font> = {
  name: "Calibri",
  size: 11,
  color: { argb: "FF000000" },
  italic: false,
  bold: false,
};

/** Gray italic for pre-filled placeholder text. */
const PLACEHOLDER_FONT: Partial<ExcelJS.Font> = {
  name: "Calibri",
  size: 11,
  color: { argb: "FF9CA3AF" },
  italic: true,
};

function resolveColumnPlaceholder(column: ColumnDef): string | null {
  if (column.placeholder) return column.placeholder;
  if (isImportDateExcelColumn(column.numberFormat)) {
    return DATE_FORMAT_PLACEHOLDER;
  }
  return null;
}

/**
 * Per-column Excel width for Add Bulk templates.
 * max(full header length + pad, content hint), floored at min.
 * Content hints: soft `column.width` (Excel units), capped placeholder /
 * example lengths. Dropdown / Lists option labels are excluded.
 */
export function resolveImportColumnWidth(
  column: ColumnDef,
  exampleValue?: string
): number {
  const headerLabel = formatColumnHeaderCellValue(column);
  const headerWidth = Math.max(
    ...headerLabel.split(/\r?\n/).map((line) => line.length)
  );
  const placeholder = resolveColumnPlaceholder(column);
  const textHint = Math.min(
    COLUMN_WIDTH.contentMax,
    Math.max(placeholder?.length ?? 0, exampleValue?.trim().length ?? 0)
  );
  const contentHint = Math.max(
    column.width ?? 0,
    textHint > 0 ? textHint + COLUMN_WIDTH.padding : 0
  );

  return Math.max(
    COLUMN_WIDTH.min,
    headerWidth + COLUMN_WIDTH.padding,
    contentHint
  );
}

function excelQuotedLiteral(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function applyPlaceholderCell(cell: ExcelJS.Cell, column: ColumnDef): void {
  const placeholder = resolveColumnPlaceholder(column);
  if (!placeholder) return;
  cell.value = placeholder;
  // Keep black as the cell's own font. Grey italic is applied only via
  // conditional formatting while the value still equals the placeholder.
  // (If the cell font itself is grey, Excel keeps grey/italic on typed
  // and dropdown-selected values.)
  cell.font = { ...DATA_ENTRY_FONT };
  if (column.numberFormat) {
    cell.numFmt = column.numberFormat;
  }
}

/**
 * Show grey italic only while the cell still holds the placeholder hint.
 * Once the user types or picks a real value, CF no longer matches and the
 * cell's black DATA_ENTRY_FONT is what Excel keeps.
 */
function applyPlaceholderConditionalFormatting(
  dataSheet: ExcelJS.Worksheet,
  columns: ColumnDef[],
  firstDataRow: number,
  lastDataRow: number
): void {
  let priority = 1;
  columns.forEach((column, index) => {
    const placeholder = resolveColumnPlaceholder(column);
    if (!placeholder) return;

    const colLetter = columnIndexToLetter(index + 1);
    const ref = `${colLetter}${firstDataRow}:${colLetter}${lastDataRow}`;

    dataSheet.addConditionalFormatting({
      ref,
      rules: [
        {
          type: "cellIs",
          operator: "equal",
          priority: priority++,
          formulae: [excelQuotedLiteral(placeholder)],
          style: {
            font: { ...PLACEHOLDER_FONT },
          },
        },
      ],
    });
  });
}

function readPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buffer.subarray(0, 8).equals(pngSignature)) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function computeLogoDisplaySize(
  naturalWidth: number,
  naturalHeight: number,
  maxWidthPx: number
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: maxWidthPx, height: Math.round(maxWidthPx * 0.67) };
  }
  const scale = Math.min(1, maxWidthPx / naturalWidth);
  return {
    width: Math.round(naturalWidth * scale),
    height: Math.round(naturalHeight * scale),
  };
}

/** Excel row height is in points; image ext uses pixels at ~96 DPI. */
function pixelsToRowHeightPoints(px: number): number {
  return Math.round(px * (72 / 96) * 10) / 10;
}

function computeHeaderBandRowHeight(logoHeightPx: number, verticalPaddingPx: number): number {
  const totalPx = logoHeightPx + verticalPaddingPx * 2;
  return Math.max(pixelsToRowHeightPoints(totalPx), 88);
}

/** Vertically center the logo in the header band (fractional row offset). */
function computeLogoRowOffset(
  headerBandHeightPoints: number,
  logoHeightPx: number
): number {
  const rowHeightPx = headerBandHeightPoints * (96 / 72);
  if (rowHeightPx <= 0 || logoHeightPx <= 0) return 0.08;
  const paddingPx = Math.max(0, (rowHeightPx - logoHeightPx) / 2);
  return paddingPx / rowHeightPx;
}

function columnIndexToLetter(index: number): string {
  let letter = "";
  let value = index;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    value = Math.floor((value - 1) / 26);
  }
  return letter;
}

function resolveBrandLogoPath(): string | null {
  // White RGS + gradient ONE (transparent PNG) on the dark navy header band.
  const root = path.join(/*turbopackIgnore: true*/ process.cwd());
  const candidates = [
    path.join(root, "public", "brand", "rgs-one-logo.png"),
    path.join(root, "public", "rgs-one-logo.png"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export type TemplateDataValidationContext = {
  workbook: ExcelJS.Workbook;
  dataSheet: ExcelJS.Worksheet;
  listsSheet: ExcelJS.Worksheet;
  columns: ColumnDef[];
  firstDataRow: number;
  lastDataRow: number;
  columnLetter: (columnKey: string) => string;
  /** Next free 1-based column on Lists after built-in dropdown columns. */
  nextListsColumn: number;
};

export type ProfessionalTemplateOptions = {
  columns: ColumnDef[];
  title: string;
  sheetName?: string;
  /** Localized Instructions sheet tab name (default "Instructions"). */
  instructionsSheetName?: string;
  /**
   * When true, add a visible Instructions worksheet.
   * Default false — only the Data sheet is visible. Lists stays veryHidden
   * when dropdowns need it.
   */
  includeInstructionsSheet?: boolean;
  /**
   * Short guidance shown as an Excel comment on the frozen title cell (row 1).
   * Use instead of a separate Instructions sheet.
   */
  headerNote?: string;
  /** Optional sample row (highlighted). Prefer omitting for clean templates. */
  exampleRow?: Record<string, string>;
  /** Instruction rows; only used when includeInstructionsSheet is true. */
  instructions?: string[][];
  /** Extra list / conditional validations after standard dropdown columns. */
  applyExtraDataValidations?: (context: TemplateDataValidationContext) => void;
};

/** Professional branded .xlsx template (logo, header band; optional Instructions sheet). */
export async function buildProfessionalImportTemplate(
  options: ProfessionalTemplateOptions
): Promise<Buffer> {
  try {
    return await buildExcelJsImportTemplate(options);
  } catch (error) {
    console.error(
      "[bulk-import] ExcelJS template failed; falling back to sheetjs:",
      error
    );
    return buildTemplateWorkbookBuffer(options);
  }
}

function thinBorder(color = BRAND.border): Partial<ExcelJS.Borders> {
  const edge: Partial<ExcelJS.Border> = { style: "thin", color: { argb: color } };
  return { top: edge, bottom: edge, left: edge, right: edge };
}

async function buildExcelJsImportTemplate(
  options: ProfessionalTemplateOptions
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RGS ONE";
  workbook.created = new Date();

  const sheetName = options.sheetName ?? "Data";
  const dataSheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  const lastCol = options.columns.length;

  // Brand header band (row 1): dark background, logo top-left, title centered
  dataSheet.mergeCells(1, 1, 1, lastCol);
  const titleCell = dataSheet.getCell(1, 1);
  titleCell.value = options.title;
  titleCell.font = {
    name: "Calibri",
    size: HEADER_LAYOUT.titleFontSize,
    bold: true,
    color: { argb: BRAND.headerText },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND.navy },
  };
  if (options.headerNote?.trim()) {
    titleCell.note = options.headerNote.trim();
  }

  const logoPath = resolveBrandLogoPath();
  let headerBandHeight = 80;
  if (logoPath) {
    try {
      const logoBuffer = readFileSync(logoPath);
      const natural = readPngDimensions(logoBuffer) ?? { width: 1024, height: 682 };
      const display = computeLogoDisplaySize(
        natural.width,
        natural.height,
        HEADER_LAYOUT.logoMaxWidthPx
      );
      headerBandHeight = computeHeaderBandRowHeight(
        display.height,
        HEADER_LAYOUT.logoPaddingVPx
      );
      dataSheet.getRow(1).height = headerBandHeight;

      const imageId = workbook.addImage({
        filename: logoPath,
        extension: "png",
      });
      dataSheet.addImage(imageId, {
        tl: {
          col: HEADER_LAYOUT.logoColOffset,
          row: computeLogoRowOffset(headerBandHeight, display.height),
        },
        ext: { width: display.width, height: display.height },
      });
    } catch (error) {
      console.warn("[bulk-import] Skipping logo embed:", error);
      dataSheet.getRow(1).height = headerBandHeight;
    }
  } else {
    dataSheet.getRow(1).height = headerBandHeight;
  }

  const columnAlignment = (
    column: ColumnDef
  ): Partial<ExcelJS.Alignment> => ({
    vertical: "middle",
    horizontal: column.centerContent ? "center" : "left",
    wrapText: true,
  });

  /** Column defaults — must include wrapText or ExcelJS drops it from row-2 headers. */
  const centeredColumnAlignment = (): Partial<ExcelJS.Alignment> => ({
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  });

  const hasMultiLineHeaders = options.columns.some((column) =>
    column.headerSubline?.trim()
  );

  // Column header row (row 2)
  const headerRow = dataSheet.getRow(2);
  options.columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    const headerValue = formatColumnHeaderCellRichValue(column);
    cell.value = headerValue;
    if (typeof headerValue === "string") {
      cell.font = { ...HEADER_TITLE_FONT };
    }
    cell.alignment = columnAlignment(column);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND.tableHeader },
    };
    cell.border = thinBorder(BRAND.accent);
    if (column.headerNote?.trim()) {
      cell.note = column.headerNote.trim();
    }
  });
  headerRow.height = hasMultiLineHeaders
    ? HEADER_LAYOUT.columnHeaderRowHeightMultiLine
    : HEADER_LAYOUT.columnHeaderRowHeight;

  options.columns.forEach((column, index) => {
    const col = dataSheet.getColumn(index + 1);
    col.width = resolveImportColumnWidth(
      column,
      options.exampleRow?.[column.key]
    );
    if (column.centerContent) {
      col.alignment = centeredColumnAlignment();
    }
    if (column.numberFormat) {
      col.numFmt = column.numberFormat;
    }
  });

  // Re-apply after column defaults — ExcelJS merges column alignment into header styles.
  options.columns.forEach((column, index) => {
    headerRow.getCell(index + 1).alignment = columnAlignment(column);
  });

  // Optional sample row (row 3) — legacy; new templates omit this
  const firstDataRow = 3;
  if (options.exampleRow) {
    const exampleRow = dataSheet.getRow(3);
    options.columns.forEach((column, index) => {
      const cell = exampleRow.getCell(index + 1);
      cell.value = options.exampleRow?.[column.key] ?? "";
      cell.font = { ...DATA_ENTRY_FONT };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND.exampleFill },
      };
      cell.border = thinBorder(BRAND.exampleBorder);
      if (column.centerContent) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
      if (column.numberFormat) {
        cell.numFmt = column.numberFormat;
      }
    });
    exampleRow.height = 20;
  } else {
    // Pre-draw bordered rows with format hints (dates, phone, etc.)
    for (
      let r = firstDataRow;
      r < firstDataRow + HEADER_LAYOUT.placeholderDataRowCount;
      r += 1
    ) {
      const emptyRow = dataSheet.getRow(r);
      options.columns.forEach((column, colIndex) => {
        const cell = emptyRow.getCell(colIndex + 1);
        cell.border = thinBorder();
        cell.font = { ...DATA_ENTRY_FONT };
        if (column.centerContent) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        }
        if (resolveColumnPlaceholder(column)) {
          applyPlaceholderCell(cell, column);
        } else if (column.numberFormat) {
          cell.numFmt = column.numberFormat;
        }
      });
      emptyRow.height = 20;
    }

    applyPlaceholderConditionalFormatting(
      dataSheet,
      options.columns,
      firstDataRow,
      HEADER_LAYOUT.dataValidationLastRow
    );
  }

  const dropdownColumns = options.columns.filter(
    (column) => column.dropdownValues && column.dropdownValues.length > 0
  );

  const listsSheet =
    dropdownColumns.length > 0 || options.applyExtraDataValidations
      ? workbook.addWorksheet("Lists", {
          state: "veryHidden",
        })
      : null;

  /** 1-based Lists columns occupied by built-in ColumnDef dropdowns. */
  let nextListsColumn = 1;

  if (listsSheet && dropdownColumns.length > 0) {
    type ListBucket = {
      values: string[];
      columns: ColumnDef[];
      listCol: number;
    };
    const buckets: ListBucket[] = [];
    const bucketIndexBySignature = new Map<string, number>();

    for (const column of dropdownColumns) {
      const values = column.dropdownValues ?? [];
      const signature = values.join("\u0001");
      const existing = bucketIndexBySignature.get(signature);
      if (existing !== undefined) {
        buckets[existing]!.columns.push(column);
        continue;
      }
      const listCol = nextListsColumn;
      nextListsColumn += 1;
      values.forEach((value, rowIdx) => {
        listsSheet.getCell(rowIdx + 1, listCol).value = value;
      });
      bucketIndexBySignature.set(signature, buckets.length);
      buckets.push({ values, columns: [column], listCol });
    }

    for (const bucket of buckets) {
      const listColLetter = columnIndexToLetter(bucket.listCol);
      const listRange = `Lists!$${listColLetter}$1:$${listColLetter}$${bucket.values.length}`;
      const usesCountryCodes = bucket.columns.some((column) =>
        isCountryCodeTemplateColumn(column.key)
      );

      // Named range → Excel shows a normal scrollable dropdown (not a truncated
      // inline CSV). Country-code columns always share `CountryCodes`.
      let formula1 = listRange;
      if (usesCountryCodes) {
        workbook.definedNames.add(listRange, "CountryCodes");
        formula1 = "CountryCodes";
      } else if (bucket.values.length > 40) {
        const name = `ListCol${listColLetter}`;
        workbook.definedNames.add(listRange, name);
        formula1 = name;
      }

      for (const column of bucket.columns) {
        const dataColIndex =
          options.columns.findIndex((entry) => entry.key === column.key) + 1;
        const dataColLetter = columnIndexToLetter(dataColIndex);
        worksheetWithDataValidations(dataSheet).dataValidations.add(
          `${dataColLetter}${firstDataRow}:${dataColLetter}${HEADER_LAYOUT.dataValidationLastRow}`,
          {
            type: "list",
            allowBlank: !column.required,
            formulae: [formula1],
            showErrorMessage: true,
            errorTitle: "Invalid value",
            error: `Choose a value from the ${column.header} dropdown.`,
          }
        );
      }
    }
  }

  if (listsSheet && options.applyExtraDataValidations) {
    const columnLetter = (columnKey: string) => {
      const dataColIndex =
        options.columns.findIndex((entry) => entry.key === columnKey) + 1;
      if (dataColIndex <= 0) {
        throw new Error(`Unknown template column key: ${columnKey}`);
      }
      return columnIndexToLetter(dataColIndex);
    };

    options.applyExtraDataValidations({
      workbook,
      dataSheet,
      listsSheet,
      columns: options.columns,
      firstDataRow,
      lastDataRow: HEADER_LAYOUT.dataValidationLastRow,
      columnLetter,
      nextListsColumn,
    });
  }

  // Instructions sheet is opt-in; bulk templates use Data + veryHidden Lists only
  if (options.includeInstructionsSheet === true) {
    const instructionsTabName = options.instructionsSheetName ?? "Instructions";
    const instructionsSheet = workbook.addWorksheet(instructionsTabName);
    instructionsSheet.getColumn(1).width = 96;

    instructionsSheet.mergeCells(1, 1, 1, 1);
    const instrTitle = instructionsSheet.getCell(1, 1);
    instrTitle.value = options.title;
    instrTitle.font = {
      name: "Calibri",
      size: 16,
      bold: true,
      color: { argb: BRAND.headerText },
    };
    instrTitle.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND.navy },
    };
    instrTitle.alignment = { vertical: "middle", horizontal: "center" };
    instructionsSheet.getRow(1).height = 36;

    const instrLogoPath = resolveBrandLogoPath();
    if (instrLogoPath) {
      try {
        const logoBuffer = readFileSync(instrLogoPath);
        const natural = readPngDimensions(logoBuffer) ?? { width: 1024, height: 682 };
        const display = computeLogoDisplaySize(natural.width, natural.height, 120);
        const instrBandHeight = computeHeaderBandRowHeight(display.height, 12);
        instructionsSheet.getRow(1).height = instrBandHeight;
        const imageId = workbook.addImage({
          filename: instrLogoPath,
          extension: "png",
        });
        instructionsSheet.addImage(imageId, {
          tl: {
            col: 0.06,
            row: computeLogoRowOffset(instrBandHeight, display.height),
          },
          ext: { width: display.width, height: display.height },
        });
      } catch {
        // Instructions sheet logo is optional
      }
    }

    let rowIndex = 3;
    for (const line of options.instructions ?? []) {
      const cell = instructionsSheet.getCell(rowIndex, 1);
      cell.value = line[0] ?? "";
      cell.font = {
        name: "Calibri",
        size: 11,
        bold: Boolean(line[0] && !line[0].startsWith("-") && line[0].endsWith(":")),
        color: { argb: BRAND.title },
      };
      cell.alignment = { wrapText: true, vertical: "top" };
      if (line[0]) {
        instructionsSheet.getRow(rowIndex).height = Math.min(
          60,
          16 + Math.ceil(line[0].length / 90) * 14
        );
      }
      rowIndex += 1;
    }
  }

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

/** @deprecated Prefer buildProfessionalImportTemplate — kept for simple fallbacks. */
export function buildTemplateWorkbookBuffer(options: {
  columns: ColumnDef[];
  sheetName?: string;
  instructionsSheetName?: string;
  includeInstructionsSheet?: boolean;
  exampleRow?: Record<string, string>;
  instructions?: string[][];
  filenameHint?: string;
}): Buffer {
  const workbook = XLSX.utils.book_new();
  const sheetName = options.sheetName ?? "Data";
  const instructionsTabName = options.instructionsSheetName ?? "Instructions";
  const headers = options.columns.map((column) =>
    column.required ? `${column.header}*` : column.header
  );

  const data: string[][] = [headers];
  if (options.exampleRow) {
    data.push(
      options.columns.map((column) => options.exampleRow?.[column.key] ?? "")
    );
  }

  const dataSheet = XLSX.utils.aoa_to_sheet(data);
  dataSheet["!cols"] = options.columns.map((column) => ({
    wch: resolveImportColumnWidth(column, options.exampleRow?.[column.key]),
  }));

  XLSX.utils.book_append_sheet(workbook, dataSheet, sheetName);

  if (options.includeInstructionsSheet === true) {
    const instructionsSheet = XLSX.utils.aoa_to_sheet([
      [instructionsTabName],
      [""],
      ...(options.instructions ?? []),
    ]);
    instructionsSheet["!cols"] = [{ wch: 92 }];
    XLSX.utils.book_append_sheet(
      workbook,
      instructionsSheet,
      instructionsTabName
    );
  }

  const output = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  return Buffer.isBuffer(output) ? output : Buffer.from(output as ArrayBuffer);
}
