import {
  monthlyInterestRate,
  roundIdr,
  type BankLoanKind,
  type LoanInterestBasis,
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

export const LOAN_PAYMENT_PURPOSES = [
  "INTEREST",
  "INSTALLMENT",
  "PROVISION",
  "ADMIN_FEE",
] as const;
export type LoanPaymentPurpose = (typeof LOAN_PAYMENT_PURPOSES)[number];

export function isLoanPaymentPurpose(
  value: string | null | undefined
): value is LoanPaymentPurpose {
  return LOAN_PAYMENT_PURPOSES.includes(
    String(value ?? "").trim().toUpperCase() as LoanPaymentPurpose
  );
}

export function parseLoanPaymentPurpose(
  value: FormDataEntryValue | string | null | undefined
): LoanPaymentPurpose | null {
  const raw = String(value ?? "").trim().toUpperCase();
  return isLoanPaymentPurpose(raw) ? raw : null;
}

export function isLoanFeePurpose(
  value: string | null | undefined
): value is "PROVISION" | "ADMIN_FEE" {
  return value === "PROVISION" || value === "ADMIN_FEE";
}

export function loanFeeBillName(
  facilityName: string,
  feeKind: "PROVISION" | "ADMIN_FEE"
): string {
  const name = facilityName.trim() || "Bank Loan";
  return feeKind === "PROVISION"
    ? `${name} — Bank Provision`
    : `${name} — Bank Admin Fee`;
}

export function loanFeeInvoiceRef(
  feeKind: "PROVISION" | "ADMIN_FEE",
  date: Date
): string {
  const yearMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(date);
  return feeKind === "PROVISION"
    ? `LOAN-PROV-${yearMonth}`
    : `LOAN-ADM-${yearMonth}`;
}

export function shareholderLoanInvoiceRef(date: Date): string {
  const yearMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(date);
  return `LOAN-SHR-${yearMonth}`;
}

export function loanExpenseFeeKind(invoice: {
  loanProvisionAmount?: number | null;
  loanAdminFeeAmount?: number | null;
  loanInterestAmount?: number | null;
  loanPrincipalAmount?: number | null;
}): "PROVISION" | "ADMIN_FEE" | null {
  const provision = Number(invoice.loanProvisionAmount ?? 0);
  const admin = Number(invoice.loanAdminFeeAmount ?? 0);
  const interest = Number(invoice.loanInterestAmount ?? 0);
  const principal = Number(invoice.loanPrincipalAmount ?? 0);
  if (provision > 0 && interest <= 0 && principal <= 0) return "PROVISION";
  if (admin > 0 && interest <= 0 && principal <= 0) return "ADMIN_FEE";
  return null;
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

export type InterestPaidMonth = {
  yearMonth: string;
  interest: number;
};

/** Interest actually paid, grouped by Asia/Jakarta calendar month. */
export function groupInterestPaidByMonth(
  movements: Array<{
    kind: "DRAW" | "REPAYMENT";
    movementDate: Date | string;
    interestAmount?: number | null;
    reversedAt?: Date | string | null;
  }>
): InterestPaidMonth[] {
  const totals = new Map<string, number>();
  for (const movement of movements) {
    if (movement.kind !== "REPAYMENT" || movement.reversedAt != null) continue;
    const interest = Number(movement.interestAmount ?? 0);
    if (!Number.isFinite(interest) || interest <= 0) continue;
    const date =
      movement.movementDate instanceof Date
        ? movement.movementDate
        : new Date(movement.movementDate);
    const yearMonth = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
    }).format(date);
    totals.set(yearMonth, (totals.get(yearMonth) ?? 0) + interest);
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([yearMonth, interest]) => ({ yearMonth, interest }));
}

export function lastRepaymentDate(
  movements: Array<{
    kind: "DRAW" | "REPAYMENT";
    movementDate: Date | string;
    reversedAt?: Date | string | null;
  }>
): Date | null {
  let latest: Date | null = null;
  for (const movement of movements) {
    if (movement.kind !== "REPAYMENT" || movement.reversedAt != null) continue;
    const date =
      movement.movementDate instanceof Date
        ? movement.movementDate
        : new Date(movement.movementDate);
    if (!latest || date.getTime() > latest.getTime()) latest = date;
  }
  return latest;
}

/**
 * Term anuitas split: interest is leftover × monthly rate.
 * Cash below interest is booked as interest only. Extra after interest
 * reduces principal. The full installment is never P&L.
 */
export function allocateTermLoanPayment(input: {
  outstanding: number;
  amount: number;
  ratePercent?: number | null;
  interestRateBasis?: LoanInterestBasis | null;
  chargesInterest?: boolean;
}): { interest: number; principal: number } {
  const outstanding = Math.max(0, roundIdr(input.outstanding));
  const paid = Math.max(0, roundIdr(input.amount));
  const chargesInterest = input.chargesInterest !== false;
  const rate = chargesInterest
    ? monthlyInterestRate(
        Number(input.ratePercent) || 0,
        input.interestRateBasis ?? "ANNUAL"
      )
    : 0;
  const interestDue = roundIdr(outstanding * rate);
  if (paid <= interestDue) {
    return { interest: paid, principal: 0 };
  }
  return {
    interest: interestDue,
    principal: Math.min(outstanding, paid - interestDue),
  };
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
