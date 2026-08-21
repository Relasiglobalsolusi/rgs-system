import {
  utcRangeForPayrollPeriod,
  utcRangeForPayrollYear,
} from "@/lib/internal-payroll-period";
import { jakartaYearMonth, utcRangeForJakartaMonth } from "@/lib/vat";

export const FINANCIAL_REPORT_GENERAL_SCOPE = "general";
export const FINANCIAL_REPORT_YEARLY_MONTH = "yearly";
export const FINANCIAL_REPORT_ALL_BANKS = "all";
export const FINANCIAL_REPORT_UNASSIGNED_BANK = "unassigned";

export type FinancialReportBankScope =
  | { kind: "all" }
  | { kind: "unassigned" }
  | { kind: "account"; id: string };

export type FinancialReportSelection = {
  year: number;
  /** 1–12 for one calendar month; null means the whole year. */
  month: number | null;
  /** `all`, `unassigned`, or a CompanyBankAccount id. */
  bank?: string;
};

export function parseFinancialReportBankScope(
  raw: string | null | undefined
): FinancialReportBankScope {
  const value = raw?.trim() || FINANCIAL_REPORT_ALL_BANKS;
  if (value === FINANCIAL_REPORT_ALL_BANKS) return { kind: "all" };
  if (value === FINANCIAL_REPORT_UNASSIGNED_BANK) return { kind: "unassigned" };
  return { kind: "account", id: value };
}

export function bankAccountWhere(
  bank: string
): { bankAccountId?: string | null } {
  const scope = parseFinancialReportBankScope(bank);
  if (scope.kind === "all") return {};
  if (scope.kind === "unassigned") return { bankAccountId: null };
  return { bankAccountId: scope.id };
}

export type DateRange = {
  from: Date;
  toExclusive: Date;
};

type SearchParamValue = string | string[] | undefined;

function firstParam(value: SearchParamValue): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export function parseFinancialReportSelection(
  params: {
    year?: SearchParamValue;
    month?: SearchParamValue;
    bank?: SearchParamValue;
  },
  now: Date = new Date()
): FinancialReportSelection {
  const current = jakartaYearMonth(now);
  const yearRaw = Number(firstParam(params.year));
  const year = Number.isFinite(yearRaw)
    ? Math.max(2000, Math.min(2100, Math.round(yearRaw)))
    : current.year;

  const bankRaw = firstParam(params.bank);
  const bank = bankRaw || FINANCIAL_REPORT_ALL_BANKS;
  const monthRaw = firstParam(params.month).toLowerCase();
  if (
    monthRaw === FINANCIAL_REPORT_YEARLY_MONTH ||
    monthRaw === "year" ||
    monthRaw === "annual"
  ) {
    return { year, month: null, bank };
  }
  if (!monthRaw) {
    return {
      year,
      month: year === current.year ? current.month : null,
      bank,
    };
  }
  const month = Number(monthRaw);
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return {
      year,
      month: year === current.year ? current.month : null,
      bank,
    };
  }
  return { year, month: Math.round(month), bank };
}

export function financialReportCalendarRange(
  selection: FinancialReportSelection
): DateRange {
  if (selection.month == null) {
    return {
      from: new Date(Date.UTC(selection.year, 0, 1)),
      toExclusive: new Date(Date.UTC(selection.year + 1, 0, 1)),
    };
  }
  const { start, endExclusive } = utcRangeForJakartaMonth(
    selection.year,
    selection.month
  );
  return { from: start, toExclusive: endExclusive };
}

export function financialReportWageRange(
  selection: FinancialReportSelection
): DateRange {
  if (selection.month == null) {
    return utcRangeForPayrollYear(selection.year);
  }
  const range = utcRangeForPayrollPeriod(selection.year, selection.month);
  return { from: range.start, toExclusive: range.endExclusive };
}

export function financialReportQueryString(
  selection: FinancialReportSelection
): string {
  const params = new URLSearchParams();
  params.set("year", String(selection.year));
  params.set(
    "month",
    selection.month == null
      ? FINANCIAL_REPORT_YEARLY_MONTH
      : String(selection.month)
  );
  if (selection.bank && selection.bank !== FINANCIAL_REPORT_ALL_BANKS) {
    params.set("bank", selection.bank);
  }
  return params.toString();
}

export function financialReportHref(
  path: string,
  selection: FinancialReportSelection
): string {
  return `${path}?${financialReportQueryString(selection)}`;
}

export function prismaDateFilter(
  from?: Date,
  toExclusive?: Date
): { gte?: Date; lt?: Date } | undefined {
  if (!from && !toExclusive) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(toExclusive ? { lt: toExclusive } : {}),
  };
}

export function financialReportYearOptions(
  selectedYear: number,
  now: Date = new Date()
): number[] {
  const current = jakartaYearMonth(now).year;
  const years = new Set<number>();
  for (let year = current - 5; year <= current + 1; year += 1) {
    years.add(year);
  }
  years.add(selectedYear);
  return [...years].sort((a, b) => a - b);
}
