import * as XLSX from "xlsx";

import { parseDateInput } from "@/lib/invoice-period";

/** Example shown in import errors and template instructions. */
export const IMPORT_DATE_EXAMPLE = "15/01/2026";

/** Excel numFmt for date columns in bulk-import templates. */
export const IMPORT_DATE_EXCEL_FORMAT = "dd/mm/yyyy";

/** Gray hint pre-filled in template date cells; import treats as blank. */
export const DATE_FORMAT_PLACEHOLDER = "DD/MM/YYYY";

export function isDateFormatPlaceholder(value: string): boolean {
  return value.trim().toLowerCase() === "dd/mm/yyyy";
}

export function isImportDateExcelColumn(
  numberFormat: string | undefined
): boolean {
  return numberFormat === IMPORT_DATE_EXCEL_FORMAT;
}

function utcDateFromParts(year: number, month: number, day: number): Date {
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return parseDateInput(iso);
}

function isValidCalendarDate(
  year: number,
  month: number,
  day: number
): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = utcDateFromParts(year, month, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function invalidDateError(columnLabel: string): Error {
  return new Error(
    `${columnLabel} could not be read. Enter a valid date (e.g. ${IMPORT_DATE_EXAMPLE}). / ${columnLabel} tidak dapat dibaca. Masukkan tanggal valid (mis. ${IMPORT_DATE_EXAMPLE}).`
  );
}

/** Expand 2-digit years: 00–69 → 2000–2069, 70–99 → 1970–1999. */
function expandTwoDigitYear(year: number): number {
  return year + (year >= 70 ? 1900 : 2000);
}

function normalizeYear(yearRaw: string): number {
  return yearRaw.length === 2
    ? expandTwoDigitYear(Number(yearRaw))
    : Number(yearRaw);
}

/** Excel serial (1900 date system) → YYYY-MM-DD, or null if out of range. */
export function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const whole = Math.trunc(serial);
  if (whole < 20000 || whole >= 80000) return null;
  const parsed = XLSX.SSF.parse_date_code(whole);
  if (!parsed?.y || !parsed.m || !parsed.d) return null;
  const month = String(parsed.m).padStart(2, "0");
  const day = String(parsed.d).padStart(2, "0");
  return `${parsed.y}-${month}-${day}`;
}

function parseExcelSerialValue(value: string, columnLabel: string): Date | null {
  const serial = Number(value);
  if (!Number.isFinite(serial)) return null;
  const iso = excelSerialToIsoDate(serial);
  if (!iso) return null;
  const parts = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  if (!isValidCalendarDate(year, month, day)) {
    throw invalidDateError(columnLabel);
  }
  return utcDateFromParts(year, month, day);
}

/**
 * Parse slash/dash/dot date text.
 * - Day > 12 → day-first (DD/MM)
 * - Month slot > 12 (second number) → month-first (MM/DD), Excel US display
 * - Both ≤ 12 → day-first (Indonesian / template default)
 */
function parseDelimitedTextDate(value: string, columnLabel: string): Date {
  const match = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (!match) {
    throw invalidDateError(columnLabel);
  }

  const a = Number(match[1]);
  const b = Number(match[2]);
  const year = normalizeYear(match[3]);

  const tryParts = (day: number, month: number): Date | null => {
    if (!isValidCalendarDate(year, month, day)) return null;
    return utcDateFromParts(year, month, day);
  };

  if (b > 12 && a <= 12) {
    const us = tryParts(b, a);
    if (us) return us;
  }

  if (a > 12 && b <= 12) {
    const dmy = tryParts(a, b);
    if (dmy) return dmy;
  }

  const dayFirst = tryParts(a, b);
  if (dayFirst) return dayFirst;

  const monthFirst = tryParts(b, a);
  if (monthFirst) return monthFirst;

  throw invalidDateError(columnLabel);
}

/** Display a parsed import date as DD/MM/YYYY (UTC calendar parts). */
export function formatImportDateDisplay(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Parse a spreadsheet date cell for bulk import.
 * Accepts:
 * - ISO year-first dates (YYYY-MM-DD) from Excel serials via cellToString
 * - Day-first text DD/MM/YYYY or D/M/YYYY
 * - US-style MM/DD/YYYY when the day > 12 (Excel locale display)
 * - Separators `/` `-` `.` and 2-digit years
 */
export function parseImportDate(
  raw: string,
  columnLabel: string
): Date | null {
  const value = raw.trim();
  if (!value || isDateFormatPlaceholder(value)) return null;

  // Strip trailing time if a Date was stringified (e.g. ISO with T…)
  const isoMatch = value.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/
  );
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!isValidCalendarDate(year, month, day)) {
      throw invalidDateError(columnLabel);
    }
    return utcDateFromParts(year, month, day);
  }

  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(value)) {
    return parseDelimitedTextDate(value, columnLabel);
  }

  // Excel serial stored as number text (e.g. "45028") or with time fraction
  if (/^\d{4,5}(\.\d+)?$/.test(value)) {
    const parsed = parseExcelSerialValue(value, columnLabel);
    if (parsed) return parsed;
  }

  throw invalidDateError(columnLabel);
}

/** Like parseImportDate but defaults when the cell is blank. */
export function parseImportDateWithDefault(
  raw: string,
  columnLabel: string,
  defaultDate: Date
): Date {
  const parsed = parseImportDate(raw, columnLabel);
  return parsed ?? defaultDate;
}

/** Parse YYYY-MM-DD from a form date input (local midnight). */
export function parseFormDateInput(
  value: FormDataEntryValue | null,
  options?: { required?: boolean; fieldLabel?: string }
): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) {
    if (options?.required) {
      throw new Error(`${options.fieldLabel ?? "Date"} is required.`);
    }
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(
      `${options?.fieldLabel ?? "Date"} is invalid. Use YYYY-MM-DD.`
    );
  }

  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `${options?.fieldLabel ?? "Date"} is invalid. Use YYYY-MM-DD.`
    );
  }

  return date;
}
