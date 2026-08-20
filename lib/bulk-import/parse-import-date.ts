import * as XLSX from "xlsx";

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
