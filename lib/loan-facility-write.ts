import { Prisma, type PrismaClient } from "@prisma/client";

import type { BankLoanKind } from "@/lib/bank-loan";
import { termMonthlyInstallment } from "@/lib/bank-loan";
import {
  nextLoanPayment,
  outstandingPrincipal,
  splitLoanPayment,
  unusedFacility,
  type LoanSource,
} from "@/lib/loan-facility";
import { CASH_PAYMENT_TERMS_DAYS } from "@/lib/invoice-period";
import { decimalToNumber } from "@/lib/project-billing";

type LoanDb = Prisma.TransactionClient | PrismaClient;

const movementSelect = {
  kind: true,
  amount: true,
  principalAmount: true,
  interestAmount: true,
  reversedAt: true,
} as const;

function moneyDec(value: number | null | undefined): Prisma.Decimal | null {
  if (value == null || !Number.isFinite(value)) return null;
  return new Prisma.Decimal(value);
}

async function loadFacilityForWrite(
  db: LoanDb,
  companyId: string,
  facilityId: string
) {
  const facility = await db.loanFacility.findFirst({
    where: { id: facilityId, companyId },
    include: { movements: { select: movementSelect } },
  });
  if (!facility) {
    throw new Error("Register the loan under Finance → Loans first.");
  }
  const likes = facility.movements.map((row) => ({
    kind: row.kind,
    amount: decimalToNumber(row.amount) ?? 0,
    principalAmount: decimalToNumber(row.principalAmount),
    interestAmount: decimalToNumber(row.interestAmount),
    reversedAt: row.reversedAt,
  }));
  const outstanding = outstandingPrincipal(likes);
  return { facility, outstanding };
}

export async function createLoanDraw(options: {
  db: LoanDb;
  companyId: string;
  userId: string;
  facilityId: string;
  amount: number;
  movementDate: Date;
  bankAccountId: string | null;
  notes?: string | null;
  filePath?: string | null;
}): Promise<{ movementId: string; outstanding: number }> {
  const amount = Math.round(options.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter the amount drawn.");
  }
  const { facility, outstanding } = await loadFacilityForWrite(
    options.db,
    options.companyId,
    options.facilityId
  );
  if (facility.status !== "ACTIVE") {
    throw new Error("This loan is closed.");
  }
  const unused = unusedFacility({
    kind: facility.kind,
    facilityLimit: decimalToNumber(facility.facilityLimit),
    outstanding,
  });
  if (unused != null && amount > unused) {
    throw new Error("This draw is above the unused facility limit.");
  }

  const movement = await options.db.loanMovement.create({
    data: {
      facilityId: facility.id,
      kind: "DRAW",
      movementDate: options.movementDate,
      amount: new Prisma.Decimal(amount),
      principalAmount: new Prisma.Decimal(amount),
      interestAmount: new Prisma.Decimal(0),
      bankAccountId: options.bankAccountId,
      notes: options.notes?.trim() || null,
      filePath: options.filePath ?? null,
      createdById: options.userId,
    },
    select: { id: true },
  });

  return { movementId: movement.id, outstanding: outstanding + amount };
}

export async function createLoanRepayment(options: {
  db: LoanDb;
  companyId: string;
  userId: string;
  facilityId: string;
  amount: number;
  transferFeeIdr?: number | null;
  movementDate: Date;
  bankAccountId: string | null;
  invoiceRef: string;
  filePath: string;
  notes?: string | null;
}): Promise<{
  purchaseInvoiceId: string;
  movementId: string;
  interest: number;
  principal: number;
}> {
  const amount = Math.round(options.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter the amount paid.");
  }
  const { facility, outstanding } = await loadFacilityForWrite(
    options.db,
    options.companyId,
    options.facilityId
  );
  if (facility.status !== "ACTIVE") {
    throw new Error("This loan is closed.");
  }
  const next = nextLoanPayment({
    kind: facility.kind,
    outstanding,
    chargesInterest: facility.chargesInterest,
    annualPercent: decimalToNumber(facility.annualRatePercent),
    tenorMonths: facility.tenorMonths,
    monthlyInstallment: decimalToNumber(facility.monthlyInstallment),
  });
  const split = splitLoanPayment({
    amount,
    outstanding,
    interestDue: next.interest,
  });
  if (split.interest + split.principal <= 0) {
    throw new Error("This loan has nothing left to pay.");
  }
  if (amount > split.interest + split.principal) {
    throw new Error(
      "This payment is more than outstanding principal plus interest due."
    );
  }
  const transferFee =
    options.transferFeeIdr != null && options.transferFeeIdr > 0
      ? Math.round(options.transferFeeIdr)
      : null;
  const invoiceRef = options.invoiceRef.trim();
  if (!invoiceRef) {
    throw new Error("Enter the loan account or payment reference.");
  }

  const invoice = await options.db.purchaseInvoice.create({
    data: {
      companyId: options.companyId,
      supplierName: facility.lenderName,
      vendorId: facility.vendorId,
      invoiceRef,
      invoiceDate: options.movementDate,
      amount: new Prisma.Decimal(amount),
      filePath: options.filePath,
      notes:
        options.notes?.trim() ||
        (facility.source === "SHAREHOLDER"
          ? "Shareholder loan repayment"
          : facility.kind === "STANDBY"
            ? "Bank loan payment — Standby Facility"
            : "Bank loan payment — Term Loan"),
      includesPpn: false,
      purchaseCategory: "BANK_LOAN",
      purpose: "INTERNAL",
      origin: "LOCAL",
      paymentTermsDays: CASH_PAYMENT_TERMS_DAYS,
      paidAt: new Date(),
      paidById: options.userId,
      bankAccountId: options.bankAccountId,
      createdById: options.userId,
      transferFeeIdr: moneyDec(transferFee),
      bankLoanKind: facility.kind,
      bankLoanPrincipal: facility.principal,
      bankLoanFacilityLimit: facility.facilityLimit,
      bankLoanAnnualRatePercent: facility.annualRatePercent,
      bankLoanTenorMonths: facility.tenorMonths,
      bankLoanMonthlyInstallment: facility.monthlyInstallment,
      loanFacilityId: facility.id,
      loanSource: facility.source,
      loanPrincipalAmount: new Prisma.Decimal(split.principal),
      loanInterestAmount: new Prisma.Decimal(split.interest),
    },
    select: { id: true },
  });

  const movement = await options.db.loanMovement.create({
    data: {
      facilityId: facility.id,
      kind: "REPAYMENT",
      movementDate: options.movementDate,
      amount: new Prisma.Decimal(amount),
      principalAmount: new Prisma.Decimal(split.principal),
      interestAmount: new Prisma.Decimal(split.interest),
      transferFeeIdr: moneyDec(transferFee),
      bankAccountId: options.bankAccountId,
      purchaseInvoiceId: invoice.id,
      notes: options.notes?.trim() || null,
      filePath: options.filePath,
      createdById: options.userId,
    },
    select: { id: true },
  });

  return {
    purchaseInvoiceId: invoice.id,
    movementId: movement.id,
    interest: split.interest,
    principal: split.principal,
  };
}

export function resolveFacilityMonthlyInstallment(input: {
  kind: BankLoanKind;
  principal: number | null;
  annualPercent: number | null;
  tenorMonths: number | null;
}): number | null {
  if (input.kind !== "TERM") return null;
  const principal = input.principal ?? 0;
  const tenor = input.tenorMonths ?? 0;
  if (principal <= 0 || tenor <= 0) return null;
  return termMonthlyInstallment(principal, input.annualPercent ?? 0, tenor);
}

export function defaultFacilityName(input: {
  source: LoanSource;
  lenderName: string;
  kind: BankLoanKind;
}): string {
  if (input.source === "SHAREHOLDER") {
    return `Shareholder Loan — ${input.lenderName}`;
  }
  return input.kind === "TERM"
    ? `${input.lenderName} Term Loan`
    : `${input.lenderName} Standby Facility`;
}
