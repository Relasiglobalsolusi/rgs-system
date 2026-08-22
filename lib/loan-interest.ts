/**
 * Standby / KRK (kredit rekening koran) daily interest.
 *
 * Indonesian commercial banks (BCA Kredit Lokal, Mandiri working-capital /
 * rekening koran) accrue bunga harian on baki debet, then bill once a month.
 * Mandiri’s published formula uses a 360-day year:
 *   interest = outstanding × annual% × days / 360
 *
 * This is Actual/360, not “full month if any day used”.
 * A 1 Jun draw is charged for each June day it stayed out.
 * A 20 Jun draw is charged from 20 Jun through month end only.
 *
 * Monthly quote: that month’s percent ÷ actual days in the Jakarta month
 * (June 1% / 30). Annual quote: percent / 360 per day.
 */
import type { LoanInterestBasis } from "@/lib/bank-loan";
import { roundIdr } from "@/lib/bank-loan";
import { toUtcDateOnly } from "@/lib/invoice-period";

export const LOAN_DAY_COUNT_YEAR = 360;

export type DatedPrincipalMovement = {
  kind: "DRAW" | "REPAYMENT";
  movementDate: Date | string;
  createdAt?: Date | string | null;
  principalAmount?: number | null;
  amount?: number | null;
  reversedAt?: Date | string | null;
};

function utcDay(value: Date | string): Date {
  return toUtcDateOnly(value instanceof Date ? value : new Date(value));
}

function dayKey(date: Date | string): number {
  return utcDay(date).getTime();
}

function principalDelta(movement: DatedPrincipalMovement): number {
  if (movement.kind === "DRAW") {
    return Math.max(0, Number(movement.principalAmount ?? movement.amount ?? 0));
  }
  return -Math.max(0, Number(movement.principalAmount ?? 0));
}

export function sortDatedMovements(
  movements: DatedPrincipalMovement[]
): DatedPrincipalMovement[] {
  return [...movements]
    .filter((row) => row.reversedAt == null)
    .sort((left, right) => {
      const dateDiff = dayKey(left.movementDate) - dayKey(right.movementDate);
      if (dateDiff !== 0) return dateDiff;
      const leftCreated = left.createdAt
        ? new Date(left.createdAt).getTime()
        : 0;
      const rightCreated = right.createdAt
        ? new Date(right.createdAt).getTime()
        : 0;
      return leftCreated - rightCreated;
    });
}

/** End-of-day outstanding: draws and returns on this date already applied. */
export function outstandingAtEndOfDay(
  movements: DatedPrincipalMovement[],
  day: Date
): number {
  const cutoff = dayKey(day);
  let outstanding = 0;
  for (const movement of sortDatedMovements(movements)) {
    if (dayKey(movement.movementDate) > cutoff) break;
    outstanding += principalDelta(movement);
  }
  return Math.max(0, outstanding);
}

export function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Daily decimal rate for one Jakarta calendar day. */
export function dailyInterestRate(
  ratePercent: number,
  basis: LoanInterestBasis | null | undefined,
  daysInMonth: number
): number {
  const percent = Number(ratePercent);
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  if (basis === "MONTHLY") {
    return daysInMonth > 0 ? percent / 100 / daysInMonth : 0;
  }
  return percent / 100 / LOAN_DAY_COUNT_YEAR;
}

export function eachUtcDateInclusive(from: Date, to: Date): Date[] {
  const start = utcDay(from);
  const end = utcDay(to);
  const days: Date[] = [];
  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    days.push(cursor);
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1)
    );
  }
  return days;
}

export function standbyInterestForDateRange(input: {
  movements: DatedPrincipalMovement[];
  ratePercent: number | null | undefined;
  basis: LoanInterestBasis | null | undefined;
  chargesInterest: boolean;
  from: Date;
  to: Date;
}): number {
  if (!input.chargesInterest) return 0;
  const rate = Number(input.ratePercent) || 0;
  if (rate <= 0) return 0;
  let total = 0;
  for (const day of eachUtcDateInclusive(input.from, input.to)) {
    const outstanding = outstandingAtEndOfDay(input.movements, day);
    if (outstanding <= 0) continue;
    const daysInMonth = daysInUtcMonth(day.getUTCFullYear(), day.getUTCMonth() + 1);
    total += outstanding * dailyInterestRate(rate, input.basis, daysInMonth);
  }
  return roundIdr(total);
}

export function yearMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function englishMonthYearLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export type StandbyUsageSlice = {
  from: Date;
  to: Date;
  outstanding: number;
  days: number;
  interest: number;
  open: boolean;
};

function addUtcDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}

function utcDayDiff(from: Date, toExclusive: Date): number {
  return Math.max(
    0,
    Math.round((utcDay(toExclusive).getTime() - utcDay(from).getTime()) / 86_400_000)
  );
}

/** Interest on a fixed outstanding from `from` inclusive to `toExclusive`. */
export function standbySliceInterest(input: {
  outstanding: number;
  from: Date;
  toExclusive: Date;
  ratePercent: number | null | undefined;
  basis: LoanInterestBasis | null | undefined;
  chargesInterest: boolean;
  dayCountYear?: number;
}): number {
  const outstanding = Math.max(0, Number(input.outstanding) || 0);
  if (!input.chargesInterest || outstanding <= 0) return 0;
  const rate = Number(input.ratePercent) || 0;
  if (rate <= 0) return 0;
  const days = utcDayDiff(input.from, input.toExclusive);
  if (days <= 0) return 0;
  if (input.basis === "MONTHLY") {
    const last = addUtcDays(utcDay(input.toExclusive), -1);
    return standbyInterestForDateRange({
      movements: [
        {
          kind: "DRAW",
          movementDate: input.from,
          principalAmount: outstanding,
        },
      ],
      ratePercent: rate,
      basis: "MONTHLY",
      chargesInterest: true,
      from: utcDay(input.from),
      to: last,
    });
  }
  const year = input.dayCountYear === 365 ? 365 : LOAN_DAY_COUNT_YEAR;
  return roundIdr(outstanding * (rate / 100) * days / year);
}

/**
 * Sequential usage slices: previous event date → this event date,
 * at the outstanding that was in force. Draw/return close the prior
 * slice and open a new one. Does not create expenses.
 */
export function buildStandbyUsageSlices(input: {
  movements: DatedPrincipalMovement[];
  today: Date;
  ratePercent: number | null | undefined;
  basis: LoanInterestBasis | null | undefined;
  chargesInterest: boolean;
  dayCountYear?: number;
}): StandbyUsageSlice[] {
  const events = sortDatedMovements(input.movements).filter((row) => {
    const principal = Math.abs(principalDelta(row));
    return principal > 0;
  });
  const slices: StandbyUsageSlice[] = [];
  let outstanding = 0;
  let from: Date | null = null;
  const today = utcDay(input.today);
  const todayExclusive = addUtcDays(today, 1);

  function closeSlice(toExclusive: Date, open: boolean) {
    if (!from || outstanding <= 0) return;
    const days = utcDayDiff(from, toExclusive);
    if (days <= 0) return;
    slices.push({
      from,
      to: addUtcDays(toExclusive, -1),
      outstanding,
      days,
      interest: standbySliceInterest({
        outstanding,
        from,
        toExclusive,
        ratePercent: input.ratePercent,
        basis: input.basis,
        chargesInterest: input.chargesInterest,
        dayCountYear: input.dayCountYear,
      }),
      open,
    });
  }

  for (const event of events) {
    const eventDay = utcDay(event.movementDate);
    if (from) closeSlice(eventDay, false);
    outstanding = Math.max(0, outstanding + principalDelta(event));
    from = eventDay;
  }
  if (from) closeSlice(todayExclusive, true);
  return slices;
}

/** Live preview of the slice a Return Principal on `returnDate` would close. */
export function closingStandbySlicePreview(input: {
  sliceFrom: Date | string;
  returnDate: Date | string;
  outstanding: number;
  ratePercent: number | null | undefined;
  basis: LoanInterestBasis | null | undefined;
  chargesInterest: boolean;
  dayCountYear?: number;
}): { from: Date; to: Date; days: number; interest: number } {
  const from = utcDay(input.sliceFrom);
  const returnDay = utcDay(input.returnDate);
  const toExclusive = addUtcDays(returnDay, 1);
  const days = utcDayDiff(from, toExclusive);
  return {
    from,
    to: returnDay,
    days,
    interest:
      days <= 0
        ? 0
        : standbySliceInterest({
            outstanding: input.outstanding,
            from,
            toExclusive,
            ratePercent: input.ratePercent,
            basis: input.basis,
            chargesInterest: input.chargesInterest,
            dayCountYear: input.dayCountYear,
          }),
  };
}

export type LoanInterestMonthRow = {
  yearMonth: string;
  year: number;
  month: number;
  label: string;
  accrued: number;
  paid: number;
  due: number;
  invoiceId: string | null;
  paidAt: Date | null;
};
