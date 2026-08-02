/**
 * Indonesian THR (Tunjangan Hari Raya Idul Fitri) helpers.
 *
 * Idul Fitri (1 Syawal / 1 Shawwal) is computed from the Umm al-Qura Hijri
 * calendar via `hijri-converter` — no yearly manual date table.
 * Official Indonesian sidang isbat may differ by about ±1 day; that is accepted.
 */

import { toGregorian } from "hijri-converter";

/** Practical Gregorian range covered by the Umm al-Qura table in hijri-converter. */
const IDUL_FITRI_MIN_YEAR = 1980;
const IDUL_FITRI_MAX_YEAR = 2077;

/** Generate THR this many calendar days before Idul Fitri. */
export const THR_GENERATE_LEAD_DAYS = 15;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function utcDateFromYmd(year: number, month: number, day: number): Date | null {
  const date = new Date(
    `${year}-${pad2(month)}-${pad2(day)}T00:00:00.000Z`
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Gregorian date of Idul Fitri (1 Shawwal) that falls in `year`.
 * When two fall in one Gregorian year (rare lunar drift), returns the earliest.
 */
export function getIdulFitriDate(year: number): Date | null {
  if (!Number.isInteger(year) || year < IDUL_FITRI_MIN_YEAR || year > IDUL_FITRI_MAX_YEAR) {
    return null;
  }

  // Shawwal of Hijri year H lands near Gregorian year H + 579.
  for (let hy = year - 580; hy <= year - 577; hy++) {
    if (hy < 1) continue;
    let g: { gy: number; gm: number; gd: number };
    try {
      g = toGregorian(hy, 10, 1);
    } catch {
      continue;
    }
    if (!g || g.gy !== year || g.gy < IDUL_FITRI_MIN_YEAR) continue;
    return utcDateFromYmd(g.gy, g.gm, g.gd);
  }

  return null;
}

/** Rolling Gregorian years that have a computable Idul Fitri date (UI / validation). */
export function listKnownIdulFitriYears(
  aroundYear: number = new Date().getUTCFullYear()
): number[] {
  const start = Math.max(IDUL_FITRI_MIN_YEAR, aroundYear - 1);
  const end = Math.min(IDUL_FITRI_MAX_YEAR, aroundYear + 10);
  const years: number[] = [];
  for (let year = start; year <= end; year++) {
    if (getIdulFitriDate(year)) years.push(year);
  }
  return years;
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
  const known = listKnownIdulFitriYears(year).find((y) => {
    const d = getIdulFitriDate(y);
    return d != null && today <= d;
  });
  return known ?? null;
}
