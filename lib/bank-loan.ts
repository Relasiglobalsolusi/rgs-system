/**
 * Indonesian bank-loan helpers.
 *
 * Standby Facility (KRK / revolving): interest only on the amount drawn.
 * Monthly interest = drawn × monthly rate.
 *
 * Term Loan (Kredit Angsuran): fixed monthly anuitas.
 * M = P × r × (1+r)^n / ((1+r)^n − 1) where r is the monthly rate.
 * That is the usual Indonesian bank method. Flat and sliding-effective exist,
 * but this ERP uses anuitas so the installment matches a typical bank schedule.
 *
 * Rate quote: Monthly 1% = 1% this month. Annual 12% = 12% / 12 this month.
 */

import { jakartaYearMonth } from "@/lib/vat";

export const BANK_LOAN_KINDS = ["STANDBY", "TERM"] as const;
export type BankLoanKind = (typeof BANK_LOAN_KINDS)[number];

export const LOAN_INTEREST_BASES = ["MONTHLY", "ANNUAL"] as const;
export type LoanInterestBasis = (typeof LOAN_INTEREST_BASES)[number];

export const BANK_LOAN_TENOR_MIN = 1;
export const BANK_LOAN_TENOR_MAX = 360;

function moneyOrZero(value: number | null | undefined): number {
  return Number.isFinite(value) && (value ?? 0) >= 0 ? Number(value) : 0;
}

export function roundIdr(value: number): number {
  return Math.round(value);
}

export function isBankLoanKind(value: string | null | undefined): value is BankLoanKind {
  return BANK_LOAN_KINDS.includes(String(value ?? "").trim().toUpperCase() as BankLoanKind);
}

export function parseBankLoanKind(
  value: FormDataEntryValue | string | null | undefined
): BankLoanKind | null {
  const raw = String(value ?? "").trim().toUpperCase();
  return isBankLoanKind(raw) ? raw : null;
}

export function isLoanInterestBasis(
  value: string | null | undefined
): value is LoanInterestBasis {
  return LOAN_INTEREST_BASES.includes(
    String(value ?? "").trim().toUpperCase() as LoanInterestBasis
  );
}

export function parseLoanInterestBasis(
  value: FormDataEntryValue | string | null | undefined
): LoanInterestBasis | null {
  const raw = String(value ?? "").trim().toUpperCase();
  return isLoanInterestBasis(raw) ? raw : null;
}

/** Decimal monthly rate from the quoted percent. */
export function monthlyInterestRate(
  ratePercent: number,
  basis: LoanInterestBasis | null | undefined = "ANNUAL"
): number {
  const percent = moneyOrZero(ratePercent);
  if (basis === "MONTHLY") return percent / 100;
  return percent / 100 / 12;
}

export function termMonthlyInstallment(
  principal: number,
  ratePercent: number,
  tenorMonths: number,
  basis: LoanInterestBasis | null | undefined = "ANNUAL"
): number {
  const amount = moneyOrZero(principal);
  const months = Math.round(moneyOrZero(tenorMonths));
  if (amount <= 0 || months < BANK_LOAN_TENOR_MIN) return 0;
  const rate = monthlyInterestRate(ratePercent, basis);
  if (rate === 0) return roundIdr(amount / months);
  const factor = (1 + rate) ** months;
  return roundIdr((amount * rate * factor) / (factor - 1));
}

/** Months left on a term loan, counting from the facility start month. */
export function remainingTenorMonths(
  startDate: Date,
  tenorMonths: number,
  asOf: Date = new Date()
): number {
  const months = Math.round(moneyOrZero(tenorMonths));
  if (months < BANK_LOAN_TENOR_MIN) return 0;
  const asOfYm = jakartaYearMonth(asOf);
  const elapsed =
    (asOfYm.year - startDate.getUTCFullYear()) * 12 +
    (asOfYm.month - (startDate.getUTCMonth() + 1));
  return Math.max(1, months - Math.max(0, elapsed));
}

/** Bunga berjalan on a fixed remaining principal: Actual/360 (or monthly ÷ days in month). */
export function runningInterestToDate(input: {
  outstanding: number;
  ratePercent: number | null | undefined;
  basis: LoanInterestBasis | null | undefined;
  chargesInterest: boolean;
  from: Date;
  to: Date;
}): number {
  if (!input.chargesInterest) return 0;
  const outstanding = moneyOrZero(input.outstanding);
  if (outstanding <= 0) return 0;
  const days = Math.max(
    0,
    Math.round((input.to.getTime() - input.from.getTime()) / 86_400_000)
  );
  if (days <= 0) return 0;
  const to = input.to;
  const daysInMonth = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const daily =
    input.basis === "MONTHLY"
      ? moneyOrZero(input.ratePercent) / 100 / Math.max(1, daysInMonth)
      : moneyOrZero(input.ratePercent) / 100 / 360;
  return roundIdr(outstanding * daily * days);
}

export function earlySettlementPenalty(
  remainingPrincipal: number,
  penaltyPercent: number
): number {
  return roundIdr(moneyOrZero(remainingPrincipal) * (moneyOrZero(penaltyPercent) / 100));
}

