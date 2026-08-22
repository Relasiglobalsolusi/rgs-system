/**
 * Indonesian bank-loan helpers.
 *
 * Standby Facility (KRK / revolving): interest only on the amount drawn.
 * Monthly interest ≈ drawn × (annual percent / 12).
 *
 * Term Loan (Kredit Angsuran): fixed monthly anuitas.
 * M = P × r × (1+r)^n / ((1+r)^n − 1) where r = annual/12 and n = tenor months.
 */

export const BANK_LOAN_KINDS = ["STANDBY", "TERM"] as const;
export type BankLoanKind = (typeof BANK_LOAN_KINDS)[number];

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

export function monthlyInterestRate(annualPercent: number): number {
  return moneyOrZero(annualPercent) / 100 / 12;
}

export function standbyMonthlyInterest(
  drawnAmount: number,
  annualPercent: number
): number {
  const drawn = moneyOrZero(drawnAmount);
  if (drawn <= 0) return 0;
  return roundIdr(drawn * monthlyInterestRate(annualPercent));
}

export function termMonthlyInstallment(
  principal: number,
  annualPercent: number,
  tenorMonths: number
): number {
  const amount = moneyOrZero(principal);
  const months = Math.round(moneyOrZero(tenorMonths));
  if (amount <= 0 || months < BANK_LOAN_TENOR_MIN) return 0;
  const rate = monthlyInterestRate(annualPercent);
  if (rate === 0) return roundIdr(amount / months);
  const factor = (1 + rate) ** months;
  return roundIdr((amount * rate * factor) / (factor - 1));
}

export function termFirstMonthSplit(
  principal: number,
  annualPercent: number,
  tenorMonths: number
): { installment: number; interest: number; principal: number } {
  const installment = termMonthlyInstallment(
    principal,
    annualPercent,
    tenorMonths
  );
  const interest = roundIdr(moneyOrZero(principal) * monthlyInterestRate(annualPercent));
  return {
    installment,
    interest,
    principal: Math.max(0, installment - interest),
  };
}

export type BankLoanPreview = {
  kind: BankLoanKind;
  suggestedPayment: number;
  monthlyInterest: number | null;
  monthlyInstallment: number | null;
  firstMonthInterest: number | null;
  firstMonthPrincipal: number | null;
};

export function previewBankLoan(input: {
  kind: BankLoanKind | "" | null;
  drawnAmount?: number | null;
  principal?: number | null;
  annualPercent?: number | null;
  tenorMonths?: number | null;
}): BankLoanPreview | null {
  if (input.kind === "STANDBY") {
    const interest = standbyMonthlyInterest(
      moneyOrZero(input.drawnAmount),
      moneyOrZero(input.annualPercent)
    );
    return {
      kind: "STANDBY",
      suggestedPayment: interest,
      monthlyInterest: interest,
      monthlyInstallment: null,
      firstMonthInterest: interest,
      firstMonthPrincipal: null,
    };
  }
  if (input.kind === "TERM") {
    const split = termFirstMonthSplit(
      moneyOrZero(input.principal),
      moneyOrZero(input.annualPercent),
      moneyOrZero(input.tenorMonths)
    );
    return {
      kind: "TERM",
      suggestedPayment: split.installment,
      monthlyInterest: null,
      monthlyInstallment: split.installment,
      firstMonthInterest: split.interest,
      firstMonthPrincipal: split.principal,
    };
  }
  return null;
}
