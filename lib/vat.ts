/**
 * VAT / PPN helpers for Finance → VAT.
 *
 * Project contract prices and typed invoice amounts are **exclude tax**.
 * Billing adds the project’s charged tax (Value Added Tax / final / other).
 * Stored invoice period amounts are the billed gross. Finance still splits
 * those gross receipts into DPP + PPN when a VAT rate is present.
 */

/** Inclusive PPN rate used when faktur DPP/PPN amounts are not stored. */
export const DEFAULT_INCLUSIVE_PPN_RATE = 0.11;

/** Default VAT % prefilled on invoices / purchases / sold-off (editable). */
export const DEFAULT_PRODUCT_PPN_RATE_PERCENT = 11;
/** Default editable PPN % for Inventory Sold Off (ex-PPN unit price). */
export const DEFAULT_SOLD_OFF_PPN_RATE_PERCENT = 11;

export function ppnRateFromPercent(percent: number): number {
  return percent / 100;
}

/** Parse a percent like 11 or 12.5; null if invalid. */
export function parsePpnRatePercent(raw: string): number | null {
  const trimmed = raw.trim().replace("%", "");
  if (!trimmed) return null;
  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0 || value > 100) return null;
  return Math.round(value * 100) / 100;
}

export type VatSplit = {
  gross: number;
  dpp: number;
  ppn: number;
  rate: number;
};

/** Split a tax-inclusive IDR amount into DPP + PPN (rounded to whole rupiah). */
export function splitInclusiveVat(
  grossAmount: number,
  rate: number = DEFAULT_INCLUSIVE_PPN_RATE
): VatSplit {
  const gross = Math.max(0, Math.round(grossAmount));
  if (gross <= 0 || rate <= 0) {
    return { gross, dpp: gross, ppn: 0, rate };
  }
  const divisor = 1 + rate;
  const dpp = Math.round(gross / divisor);
  const ppn = gross - dpp;
  return { gross, dpp, ppn, rate };
}

/** Apply PPN on a pre-tax (ex-PPN) IDR amount (rounded to whole rupiah). */
export function applyExclusiveVat(
  dppAmount: number,
  rate: number
): VatSplit {
  const dpp = Math.max(0, Math.round(dppAmount));
  if (dpp <= 0 || rate <= 0) {
    return { gross: dpp, dpp, ppn: 0, rate };
  }
  const ppn = Math.round(dpp * rate);
  return { gross: dpp + ppn, dpp, ppn, rate };
}

/**
 * Inventory / asset cost basis from a tax-inclusive unit price.
 * Purchase invoice commercial lines are gross when PPN applies; stock valuation
 * and EquipmentAsset.unitCost must store the ex-tax (DPP) portion only.
 */
export function exclusiveUnitCostFromInclusive(
  inclusiveUnitPrice: number,
  rate: number
): number {
  if (!Number.isFinite(inclusiveUnitPrice) || inclusiveUnitPrice < 0) {
    return 0;
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    return inclusiveUnitPrice;
  }
  return assertInclusiveCreditableTax(inclusiveUnitPrice, rate).dpp;
}

/**
 * Tax Included = Yes and the tax is creditable (PPN):
 * amount paid (DPP) + tax credit = the inclusive unit cost.
 */
export function assertInclusiveCreditableTax(
  inclusiveAmount: number,
  rate: number
): VatSplit {
  const split = splitInclusiveVat(inclusiveAmount, rate);
  if (split.dpp + split.ppn !== split.gross) {
    throw new Error(
      "The amount paid plus the tax credit must equal the tax-included unit cost."
    );
  }
  return split;
}

export function jakartaYearMonth(now: Date = new Date()): {
  year: number;
  month: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { year, month };
}

/** UTC day bounds for a Jakarta calendar month (for `@db.Date` / issued timestamps). */
export function utcRangeForJakartaMonth(year: number, month: number): {
  start: Date;
  endExclusive: Date;
} {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const endExclusive = new Date(Date.UTC(year, month, 1));
  return { start, endExclusive };
}

/** UTC day bounds for one Jakarta calendar date (`@db.Date`). */
export function utcRangeForJakartaDate(
  year: number,
  month: number,
  day: number
): {
  start: Date;
  endExclusive: Date;
} {
  const start = new Date(Date.UTC(year, month - 1, day));
  const endExclusive = new Date(Date.UTC(year, month - 1, day + 1));
  return { start, endExclusive };
}

export function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
export function utcRangeForJakartaYear(year: number): {
  start: Date;
  endExclusive: Date;
} {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    endExclusive: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

export function isDateInJakartaMonth(
  date: Date | null | undefined,
  year: number,
  month: number
): boolean {
  if (!date) return false;
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(date);
  const [y, m] = key.split("-").map(Number);
  return y === year && m === month;
}

export function isDateInJakartaYear(
  date: Date | null | undefined,
  year: number
): boolean {
  if (!date) return false;
  return jakartaYearMonth(date).year === year;
}

/**
 * Unused input VAT still available at the start of `asOf` month.
 * Each earlier month applies input − output against the running credit;
 * a month that still owes VAT after using the credit is remitted, so the
 * credit cannot go below zero.
 */
export function broughtForwardVatCredit(
  outputRows: Array<{ date: string | null; ppn: number }>,
  inputRows: Array<{ date: string | null; ppn: number }>,
  asOfYear: number,
  asOfMonth: number
): number {
  const cutoff = asOfYear * 12 + asOfMonth;
  const buckets = new Map<number, { output: number; input: number }>();

  function add(
    rows: Array<{ date: string | null; ppn: number }>,
    kind: "output" | "input"
  ) {
    for (const row of rows) {
      if (!row.date || !Number.isFinite(row.ppn) || row.ppn === 0) continue;
      const ym = jakartaYearMonth(new Date(row.date));
      if (!Number.isFinite(ym.year) || !Number.isFinite(ym.month)) continue;
      const key = ym.year * 12 + ym.month;
      if (key >= cutoff) continue;
      const bucket = buckets.get(key) ?? { output: 0, input: 0 };
      bucket[kind] += row.ppn;
      buckets.set(key, bucket);
    }
  }

  add(outputRows, "output");
  add(inputRows, "input");

  let credit = 0;
  for (const key of [...buckets.keys()].sort((a, b) => a - b)) {
    const bucket = buckets.get(key);
    if (!bucket) continue;
    credit = Math.max(0, credit + bucket.input - bucket.output);
  }
  return Math.round(credit);
}
