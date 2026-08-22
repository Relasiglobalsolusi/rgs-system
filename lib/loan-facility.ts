import {
  monthlyInterestRate,
  roundIdr,
  standbyMonthlyInterest,
  termMonthlyInstallment,
  type BankLoanKind,
} from "@/lib/bank-loan";

export const LOAN_SOURCES = ["BANK", "SHAREHOLDER"] as const;
export type LoanSource = (typeof LOAN_SOURCES)[number];

export function isLoanSource(value: string | null | undefined): value is LoanSource {
  return LOAN_SOURCES.includes(String(value ?? "").trim().toUpperCase() as LoanSource);
}

export function parseLoanSource(
  value: FormDataEntryValue | string | null | undefined
): LoanSource | null {
  const raw = String(value ?? "").trim().toUpperCase();
  return isLoanSource(raw) ? raw : null;
}

export type LoanMovementLike = {
  kind: "DRAW" | "REPAYMENT";
  amount?: number | null;
  principalAmount?: number | null;
  interestAmount?: number | null;
  reversedAt?: Date | string | null;
};

export function isActiveLoanMovement(movement: LoanMovementLike): boolean {
  return movement.reversedAt == null;
}

export function outstandingPrincipal(movements: LoanMovementLike[]): number {
  let outstanding = 0;
  for (const movement of movements) {
    if (!isActiveLoanMovement(movement)) continue;
    if (movement.kind === "DRAW") {
      outstanding += Number(movement.principalAmount ?? movement.amount ?? 0);
    } else {
      outstanding -= Number(movement.principalAmount ?? 0);
    }
  }
  return Math.max(0, roundIdr(outstanding));
}

export function sumDraws(movements: LoanMovementLike[]): number {
  return movements.reduce((sum, movement) => {
    if (!isActiveLoanMovement(movement) || movement.kind !== "DRAW") return sum;
    return sum + Number(movement.principalAmount ?? movement.amount ?? 0);
  }, 0);
}

export function sumPrincipalReturned(movements: LoanMovementLike[]): number {
  return movements.reduce((sum, movement) => {
    if (!isActiveLoanMovement(movement) || movement.kind !== "REPAYMENT") {
      return sum;
    }
    return sum + Number(movement.principalAmount ?? 0);
  }, 0);
}

export function sumInterestPaid(movements: LoanMovementLike[]): number {
  return movements.reduce((sum, movement) => {
    if (!isActiveLoanMovement(movement) || movement.kind !== "REPAYMENT") {
      return sum;
    }
    return sum + Number(movement.interestAmount ?? 0);
  }, 0);
}

export type LoanPaymentPreview = {
  suggestedPayment: number;
  interest: number;
  principal: number;
};

export function nextLoanPayment(input: {
  kind: BankLoanKind;
  outstanding: number;
  chargesInterest: boolean;
  annualPercent?: number | null;
  tenorMonths?: number | null;
  monthlyInstallment?: number | null;
}): LoanPaymentPreview {
  const outstanding = Math.max(0, Number(input.outstanding) || 0);
  if (outstanding <= 0) {
    return { suggestedPayment: 0, interest: 0, principal: 0 };
  }

  const chargesInterest = Boolean(input.chargesInterest);
  const annual = chargesInterest ? Number(input.annualPercent) || 0 : 0;

  if (input.kind === "TERM") {
    const installment =
      input.monthlyInstallment != null && input.monthlyInstallment > 0
        ? roundIdr(input.monthlyInstallment)
        : termMonthlyInstallment(
            outstanding,
            annual,
            Number(input.tenorMonths) || 0
          );
    const interest = chargesInterest
      ? roundIdr(outstanding * monthlyInterestRate(annual))
      : 0;
    const principal = Math.min(outstanding, Math.max(0, installment - interest));
    const suggested = Math.min(outstanding + interest, installment || principal + interest);
    return {
      suggestedPayment: suggested,
      interest,
      principal,
    };
  }

  const interest = chargesInterest
    ? standbyMonthlyInterest(outstanding, annual)
    : 0;
  return {
    suggestedPayment: interest,
    interest,
    principal: 0,
  };
}

/** Interest first, then principal, never more than outstanding. */
export function splitLoanPayment(input: {
  amount: number;
  outstanding: number;
  interestDue: number;
}): { interest: number; principal: number } {
  const amount = Math.max(0, roundIdr(input.amount));
  const outstanding = Math.max(0, roundIdr(input.outstanding));
  const interestDue = Math.max(0, roundIdr(input.interestDue));
  const interest = Math.min(amount, interestDue);
  const principal = Math.min(outstanding, Math.max(0, amount - interest));
  return { interest, principal };
}

export function unusedFacility(input: {
  kind: BankLoanKind;
  facilityLimit?: number | null;
  outstanding: number;
}): number | null {
  if (input.kind !== "STANDBY") return null;
  const limit = Number(input.facilityLimit);
  if (!Number.isFinite(limit) || limit <= 0) return null;
  return Math.max(0, roundIdr(limit - input.outstanding));
}
