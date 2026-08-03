/**
 * VAT / PPN helpers for Finance → VAT.
 *
 * Commercial amounts in this ERP are treated as **tax-inclusive** when PPN applies
 * (same assumption as tax-invoice verification). Until DPP/PPN are stored from
 * faktur OCR, we derive them with the standard inclusive split at 11%.
 */

/** Inclusive PPN rate used when faktur DPP/PPN amounts are not stored. */
export const DEFAULT_INCLUSIVE_PPN_RATE = 0.11;

/** Common purchase VAT % presets (Indonesia). Services often need a different %). */
export const PURCHASE_PPN_RATE_PRESETS = [11, 12] as const;

export const DEFAULT_PRODUCT_PPN_RATE_PERCENT = 11;
/** Services start blank in UI so staff enter the rate from the invoice. */
export const DEFAULT_SERVICE_PPN_RATE_PERCENT = 11;

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
