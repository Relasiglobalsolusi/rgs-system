/**
 * Indonesian THR (Tunjangan Hari Raya Idul Fitri) helpers.
 * Dates are a maintainable government/calendar table — update when sidang isbat confirms.
 */

/** First day of Idul Fitri (1 Syawal) as UTC date YYYY-MM-DD. */
const IDUL_FITRI_DATES: Record<number, string> = {
  2024: "2024-04-10",
  2025: "2025-03-31",
  2026: "2026-03-20",
  2027: "2027-03-10",
  2028: "2028-02-26",
  2029: "2029-02-14",
  2030: "2030-02-04",
  2031: "2031-01-25",
  2032: "2032-01-14",
  2033: "2033-01-03",
  2034: "2034-12-23",
  2035: "2035-12-12",
};

/** Generate THR this many calendar days before Idul Fitri. */
export const THR_GENERATE_LEAD_DAYS = 15;

export function getIdulFitriDate(year: number): Date | null {
  const iso = IDUL_FITRI_DATES[year];
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function listKnownIdulFitriYears(): number[] {
  return Object.keys(IDUL_FITRI_DATES)
    .map(Number)
    .sort((a, b) => a - b);
}

/** Whole months of tenure from hire date through Hari Raya (inclusive calendar months). */
export function tenureMonthsAt(
  hiredAt: Date | null | undefined,
  asOf: Date
): number {
  if (!hiredAt) return 0;
  const hire = new Date(hiredAt);
  if (Number.isNaN(hire.getTime()) || hire > asOf) return 0;

  let months =
    (asOf.getUTCFullYear() - hire.getUTCFullYear()) * 12 +
    (asOf.getUTCMonth() - hire.getUTCMonth());

  if (asOf.getUTCDate() < hire.getUTCDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

/**
 * Lebaran THR v1 (base pay as upah):
 * - &lt; 1 month: 0 (not eligible)
 * - 1–11 months: (months / 12) × basePay
 * - ≥ 12 months: 1 × basePay
 */
export function calculateThrAmount(basePay: number, tenureMonths: number): number {
  const pay = Math.max(0, Number.isFinite(basePay) ? basePay : 0);
  if (tenureMonths < 1 || pay <= 0) return 0;
  if (tenureMonths >= 12) return Math.round(pay);
  return Math.round((tenureMonths / 12) * pay);
}

export function utcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** True when today is within [hariRaya − leadDays, hariRaya] inclusive. */
export function isWithinThrGenerateWindow(
  hariRayaDate: Date,
  today: Date = utcToday(),
  leadDays = THR_GENERATE_LEAD_DAYS
): boolean {
  const windowStart = addUtcDays(hariRayaDate, -leadDays);
  return today >= windowStart && today <= hariRayaDate;
}

/** Prefer current-year Idul Fitri; if past, next known year. */
export function resolveThrTargetYear(today: Date = utcToday()): number | null {
  const year = today.getUTCFullYear();
  const thisYear = getIdulFitriDate(year);
  if (thisYear && today <= thisYear) return year;
  const next = getIdulFitriDate(year + 1);
  if (next) return year + 1;
  const known = listKnownIdulFitriYears().find((y) => {
    const d = getIdulFitriDate(y);
    return d != null && today <= d;
  });
  return known ?? null;
}
