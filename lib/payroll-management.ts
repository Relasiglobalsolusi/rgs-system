import { DISPLAY_LOCALE, formatEnglishOrdinalDate } from "@/lib/format-date";
import { addUtcDays, toUtcDateOnly } from "@/lib/invoice-period";
import { decimalToNumber, payrollManagementFeePercent } from "@/lib/project-billing";
import { DEFAULT_PRODUCT_PPN_RATE_PERCENT } from "@/lib/vat";

export const DEFAULT_PAYROLL_MANAGEMENT_TAX_PERCENT =
  DEFAULT_PRODUCT_PPN_RATE_PERCENT;

/** Client cutoff: if start > end, the window wraps the previous month (same idea as 16–15). */
export function utcRangeForClientCutoff(
  year: number,
  month: number,
  startDay: number,
  endDay: number
): { start: Date; endExclusive: Date } {
  const startClamped = Math.min(31, Math.max(1, Math.round(startDay)));
  const endClamped = Math.min(31, Math.max(1, Math.round(endDay)));
  if (startClamped <= endClamped) {
    const start = new Date(Date.UTC(year, month - 1, startClamped));
    const endExclusive = new Date(Date.UTC(year, month - 1, endClamped + 1));
    return { start, endExclusive };
  }
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return {
    start: new Date(Date.UTC(prevYear, prevMonth - 1, startClamped)),
    endExclusive: new Date(Date.UTC(year, month - 1, endClamped + 1)),
  };
}

export function utcDateForDayInMonth(
  year: number,
  month: number,
  day: number
): Date {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clamped = Math.min(Math.max(1, Math.round(day)), lastDay);
  return new Date(Date.UTC(year, month - 1, clamped));
}

export function snapDateToCutoffDay(date: Date, cutoffDay: number): Date {
  const utc = toUtcDateOnly(date);
  return utcDateForDayInMonth(
    utc.getUTCFullYear(),
    utc.getUTCMonth() + 1,
    cutoffDay
  );
}

/**
 * Cutoff-month window: day after the previous cutoff → this month’s cutoff.
 * First period clips to the contract start. Last period clips to the contract end.
 */
export function payrollManagementWindowForCutoffMonth(options: {
  year: number;
  month: number;
  cutoffDay: number;
  contractStart?: Date | null;
  contractEnd?: Date | null;
}): { start: Date; end: Date; endExclusive: Date } {
  const cutoff = utcDateForDayInMonth(
    options.year,
    options.month,
    options.cutoffDay
  );
  const prevMonth = options.month === 1 ? 12 : options.month - 1;
  const prevYear = options.month === 1 ? options.year - 1 : options.year;
  const prevCutoff = utcDateForDayInMonth(
    prevYear,
    prevMonth,
    options.cutoffDay
  );
  let start = addUtcDays(prevCutoff, 1);
  let end = cutoff;
  if (options.contractStart) {
    const contractStart = toUtcDateOnly(options.contractStart);
    if (contractStart.getTime() > start.getTime()) {
      start = contractStart;
    }
  }
  if (options.contractEnd) {
    const contractEnd = toUtcDateOnly(options.contractEnd);
    if (contractEnd.getTime() < end.getTime()) {
      end = contractEnd;
    }
  }
  return { start, end, endExclusive: addUtcDays(end, 1) };
}

export function formatClientCutoffLabel(
  year: number,
  month: number,
  startDay: number,
  endDay: number,
  locale: string = DISPLAY_LOCALE
): string {
  const { start, endExclusive } = utcRangeForClientCutoff(
    year,
    month,
    startDay,
    endDay
  );
  const end = addUtcDays(endExclusive, -1);
  return `${formatEnglishOrdinalDate(start, locale)} – ${formatEnglishOrdinalDate(end, locale)}`;
}

export type PayrollManagementLineInput = {
  employeeName: string;
  amount: number;
  accountNumber?: string | null;
  notes?: string | null;
};

export function resolvePayrollManagementFeePercent(
  serviceFeePercent: number | null | undefined
): number {
  const fee = payrollManagementFeePercent(serviceFeePercent);
  if (fee == null) {
    throw new Error("Enter the management fee percent on this project.");
  }
  return fee;
}

export function resolvePayrollManagementTaxPercent(
  taxPercent: number | null | undefined
): number {
  if (taxPercent == null || !Number.isFinite(taxPercent)) {
    return DEFAULT_PAYROLL_MANAGEMENT_TAX_PERCENT;
  }
  if (taxPercent < 0 || taxPercent > 100) {
    throw new Error("Enter a valid tax percent.");
  }
  return Math.round(taxPercent * 100) / 100;
}

export function computePayrollManagementTotals(
  lines: Array<{ amount: number }>,
  serviceFeePercent: number,
  taxPercent: number = DEFAULT_PAYROLL_MANAGEMENT_TAX_PERCENT
): {
  wagesTotal: number;
  feeAmount: number;
  taxAmount: number;
  taxPercent: number;
  clientBillAmount: number;
} {
  const wagesTotal = Math.round(
    lines.reduce((sum, line) => sum + (Number.isFinite(line.amount) ? line.amount : 0), 0)
  );
  const fee = resolvePayrollManagementFeePercent(serviceFeePercent);
  const feeAmount = Math.round((wagesTotal * fee) / 100);
  const rate = resolvePayrollManagementTaxPercent(taxPercent);
  const taxAmount = Math.round((feeAmount * rate) / 100);
  return {
    wagesTotal,
    feeAmount,
    taxAmount,
    taxPercent: rate,
    clientBillAmount: wagesTotal + feeAmount + taxAmount,
  };
}

export function parsePayrollManagementLinesJson(
  raw: string
): PayrollManagementLineInput[] {
  if (!raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Employee pay list is not valid JSON.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Employee pay list must be an array.");
  }

  return parsed.map((row, index) => {
    const record = row as Record<string, unknown>;
    const employeeName = String(record.employeeName ?? record.name ?? "").trim();
    const amount = Number(record.amount);
    if (!employeeName) {
      throw new Error(`Row ${index + 1}: employee name is required.`);
    }
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Row ${index + 1}: enter a valid wage amount.`);
    }
    return {
      employeeName,
      amount: Math.round(amount),
      accountNumber: String(record.accountNumber ?? "").trim() || null,
      notes: String(record.notes ?? "").trim() || null,
    };
  });
}

export function formatPayrollManagementWindowLabel(
  window: {
    start: Date;
    end: Date;
  },
  locale: string = DISPLAY_LOCALE
): string {
  return `${formatEnglishOrdinalDate(window.start, locale)} – ${formatEnglishOrdinalDate(window.end, locale)}`;
}

export function periodMoneyNumbers(period: {
  wagesTotal: Parameters<typeof decimalToNumber>[0];
  feeAmount: Parameters<typeof decimalToNumber>[0];
  clientBillAmount: Parameters<typeof decimalToNumber>[0];
  serviceFeePercent: Parameters<typeof decimalToNumber>[0];
  taxRatePercent?: Parameters<typeof decimalToNumber>[0];
  taxAmount?: Parameters<typeof decimalToNumber>[0];
}) {
  return {
    wagesTotal: decimalToNumber(period.wagesTotal) ?? 0,
    feeAmount: decimalToNumber(period.feeAmount) ?? 0,
    taxPercent:
      decimalToNumber(period.taxRatePercent) ??
      DEFAULT_PAYROLL_MANAGEMENT_TAX_PERCENT,
    taxAmount: decimalToNumber(period.taxAmount) ?? 0,
    clientBillAmount: decimalToNumber(period.clientBillAmount) ?? 0,
    serviceFeePercent: decimalToNumber(period.serviceFeePercent) ?? 0,
  };
}
