import { Prisma, type PrismaClient } from "@prisma/client";

import type { BankLoanKind, LoanInterestBasis } from "@/lib/bank-loan";
import {
  earlySettlementPenalty,
  runningInterestToDate,
  termMonthlyInstallment,
} from "@/lib/bank-loan";
import {
  lastRepaymentDate,
  allocateTermLoanPayment,
  loanFeeBillName,
  loanFeeInvoiceRef,
  outstandingPrincipal,
  unusedFacility,
  type LoanSource,
} from "@/lib/loan-facility";
import { CASH_PAYMENT_TERMS_DAYS } from "@/lib/invoice-period";
import { decimalToNumber } from "@/lib/project-billing";

type LoanDb = Prisma.TransactionClient | PrismaClient;

const movementSelect = {
  kind: true,
  movementDate: true,
  amount: true,
  principalAmount: true,
  interestAmount: true,
  reversedAt: true,
  createdAt: true,
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
    throw new Error("This draw is above the unused Plafon Kredit.");
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
  standbyPayment?: "INTEREST" | "PRINCIPAL" | null;
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

  const transferFee =
    options.transferFeeIdr != null && options.transferFeeIdr > 0
      ? Math.round(options.transferFeeIdr)
      : null;
  const invoiceRef = options.invoiceRef.trim();
  if (!invoiceRef) {
    throw new Error("Enter the loan account or payment reference.");
  }

  if (facility.kind === "STANDBY") {
    const standbyPayment =
      options.standbyPayment === "PRINCIPAL" ? "PRINCIPAL" : "INTEREST";
    if (standbyPayment === "PRINCIPAL") {
      if (outstanding <= 0) {
        throw new Error("This loan has no outstanding principal.");
      }
      if (amount > outstanding) {
        throw new Error("This return is more than outstanding principal.");
      }
      const created = await createPaidLoanInvoiceAndMovement({
        db: options.db,
        companyId: options.companyId,
        facility,
        userId: options.userId,
        amount,
        interest: 0,
        principal: amount,
        transferFee,
        movementDate: options.movementDate,
        bankAccountId: options.bankAccountId,
        invoiceRef,
        filePath: options.filePath,
        notes: options.notes?.trim() || "Standby principal returned",
      });
      return {
        purchaseInvoiceId: created.purchaseInvoiceId,
        movementId: created.movementId,
        interest: 0,
        principal: amount,
      };
    }

    const created = await createPaidLoanInvoiceAndMovement({
      db: options.db,
      companyId: options.companyId,
      facility,
      userId: options.userId,
      amount,
      interest: amount,
      principal: 0,
      transferFee,
      movementDate: options.movementDate,
      bankAccountId: options.bankAccountId,
      invoiceRef,
      filePath: options.filePath,
      notes: options.notes?.trim() || "Standby interest paid",
    });
    return {
      purchaseInvoiceId: created.purchaseInvoiceId,
      movementId: created.movementId,
      interest: amount,
      principal: 0,
    };
  }

  const split = allocateTermLoanPayment({
    outstanding,
    amount,
    ratePercent: decimalToNumber(facility.annualRatePercent),
    interestRateBasis: facility.interestRateBasis,
    chargesInterest: facility.chargesInterest,
  });
  if (split.interest + split.principal <= 0) {
    throw new Error("Enter the amount paid.");
  }

  const created = await createPaidLoanInvoiceAndMovement({
    db: options.db,
    companyId: options.companyId,
    facility,
    userId: options.userId,
    amount,
    interest: split.interest,
    principal: split.principal,
    transferFee,
    movementDate: options.movementDate,
    bankAccountId: options.bankAccountId,
    invoiceRef,
    filePath: options.filePath,
    notes:
      options.notes?.trim() ||
      (facility.source === "SHAREHOLDER"
        ? "Shareholder loan repayment"
        : "Term loan payment"),
  });

  if (outstanding > 0 && outstanding - split.principal <= 0) {
    await options.db.loanFacility.update({
      where: { id: facility.id },
      data: { status: "CLOSED" },
    });
  }

  return {
    purchaseInvoiceId: created.purchaseInvoiceId,
    movementId: created.movementId,
    interest: split.interest,
    principal: split.principal,
  };
}

export async function createLoanFeePayment(options: {
  db: LoanDb;
  companyId: string;
  userId: string;
  facilityId: string;
  amount: number;
  feeKind: "PROVISION" | "ADMIN_FEE";
  transferFeeIdr?: number | null;
  movementDate: Date;
  bankAccountId: string | null;
  invoiceRef: string;
  filePath: string;
  notes?: string | null;
}): Promise<{ purchaseInvoiceId: string; movementId: string }> {
  const amount = Math.round(options.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter the amount paid.");
  }
  const { facility } = await loadFacilityForWrite(
    options.db,
    options.companyId,
    options.facilityId
  );
  if (facility.status !== "ACTIVE") {
    throw new Error("This loan is closed.");
  }
  if (facility.source !== "BANK") {
    throw new Error("Bank Provision and Bank Admin Fee are only for a Bank Loan.");
  }
  const transferFee =
    options.transferFeeIdr != null && options.transferFeeIdr > 0
      ? Math.round(options.transferFeeIdr)
      : null;
  const generatedRef = loanFeeInvoiceRef(options.feeKind, options.movementDate);
  const typedRef = options.invoiceRef.trim();
  const invoiceRef = generatedRef;
  const title = loanFeeBillName(facility.name, options.feeKind);
  const notes = [
    options.notes?.trim() ||
      (options.feeKind === "PROVISION" ? "Bank provision" : "Bank admin fee"),
    typedRef && typedRef !== generatedRef ? typedRef : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return createPaidLoanInvoiceAndMovement({
    db: options.db,
    companyId: options.companyId,
    facility,
    userId: options.userId,
    amount,
    interest: 0,
    principal: 0,
    provision: options.feeKind === "PROVISION" ? amount : null,
    adminFee: options.feeKind === "ADMIN_FEE" ? amount : null,
    supplierName: title,
    transferFee,
    movementDate: options.movementDate,
    bankAccountId: options.bankAccountId,
    invoiceRef,
    filePath: options.filePath,
    notes,
  });
}

export async function createLoanEarlySettlement(options: {
  db: LoanDb;
  companyId: string;
  userId: string;
  facilityId: string;
  movementDate: Date;
  penaltyPercent: number;
  penaltyAmount?: number | null;
  adminFeeAmount?: number | null;
  transferFeeIdr?: number | null;
  bankAccountId: string | null;
  invoiceRef: string;
  filePath: string;
  notes?: string | null;
}): Promise<{
  purchaseInvoiceId: string;
  movementId: string;
  interest: number;
  principal: number;
  penalty: number;
  adminFee: number;
  total: number;
}> {
  const { facility, outstanding } = await loadFacilityForWrite(
    options.db,
    options.companyId,
    options.facilityId
  );
  if (facility.status !== "ACTIVE") {
    throw new Error("This loan is closed.");
  }
  if (facility.kind !== "TERM") {
    throw new Error("Settle Early is only for a Term Loan.");
  }
  if (outstanding <= 0) {
    throw new Error("This term loan is already settled.");
  }

  const invoiceRef = options.invoiceRef.trim();
  if (!invoiceRef) {
    throw new Error("Enter the loan account or payment reference.");
  }

  const lastPaid = lastRepaymentDate(
    facility.movements.map((row) => ({
      kind: row.kind,
      movementDate: row.movementDate,
      reversedAt: row.reversedAt,
    }))
  );
  const from = lastPaid ?? facility.startDate;
  const interest = runningInterestToDate({
    outstanding,
    ratePercent: decimalToNumber(facility.annualRatePercent),
    basis: facility.interestRateBasis ?? "ANNUAL",
    chargesInterest: facility.chargesInterest,
    from,
    to: options.movementDate,
  });
  const penalty =
    options.penaltyAmount != null && Number.isFinite(options.penaltyAmount)
      ? Math.max(0, Math.round(options.penaltyAmount))
      : earlySettlementPenalty(outstanding, options.penaltyPercent);
  const adminFee =
    options.adminFeeAmount != null && options.adminFeeAmount > 0
      ? Math.round(options.adminFeeAmount)
      : 0;
  const transferFee =
    options.transferFeeIdr != null && options.transferFeeIdr > 0
      ? Math.round(options.transferFeeIdr)
      : null;
  const total = outstanding + interest + penalty + adminFee;

  const invoice = await options.db.purchaseInvoice.create({
    data: {
      companyId: options.companyId,
      supplierName: facility.lenderName,
      vendorId: facility.vendorId,
      invoiceRef,
      invoiceDate: options.movementDate,
      amount: new Prisma.Decimal(total),
      filePath: options.filePath,
      notes:
        options.notes?.trim() ||
        "Term Loan early settlement (pelunasan dipercepat)",
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
      bankLoanInterestRateBasis: facility.interestRateBasis,
      bankLoanTenorMonths: facility.tenorMonths,
      bankLoanMonthlyInstallment: facility.monthlyInstallment,
      loanFacilityId: facility.id,
      loanSource: facility.source,
      loanPrincipalAmount: new Prisma.Decimal(outstanding),
      loanInterestAmount: new Prisma.Decimal(interest),
      loanPenaltyAmount: new Prisma.Decimal(penalty),
      loanAdminFeeAmount: adminFee > 0 ? new Prisma.Decimal(adminFee) : null,
    },
    select: { id: true },
  });

  const movement = await options.db.loanMovement.create({
    data: {
      facilityId: facility.id,
      kind: "REPAYMENT",
      movementDate: options.movementDate,
      amount: new Prisma.Decimal(total),
      principalAmount: new Prisma.Decimal(outstanding),
      interestAmount: new Prisma.Decimal(interest),
      transferFeeIdr: moneyDec(transferFee),
      bankAccountId: options.bankAccountId,
      purchaseInvoiceId: invoice.id,
      notes: options.notes?.trim() || "Early settlement",
      filePath: options.filePath,
      createdById: options.userId,
    },
    select: { id: true },
  });

  await options.db.loanFacility.update({
    where: { id: facility.id },
    data: { status: "CLOSED" },
  });

  return {
    purchaseInvoiceId: invoice.id,
    movementId: movement.id,
    interest,
    principal: outstanding,
    penalty,
    adminFee,
    total,
  };
}

export function resolveFacilityMonthlyInstallment(input: {
  kind: BankLoanKind;
  principal: number | null;
  annualPercent: number | null;
  tenorMonths: number | null;
  interestRateBasis?: LoanInterestBasis | null;
  calculationMethod?: import("@/lib/bank-loan").LoanCalculationMethod | null;
}): number | null {
  if (input.kind !== "TERM") return null;
  const principal = input.principal ?? 0;
  const tenor = input.tenorMonths ?? 0;
  if (principal <= 0 || tenor <= 0) return null;
  return termMonthlyInstallment(
    principal,
    input.annualPercent ?? 0,
    tenor,
    input.interestRateBasis ?? "ANNUAL",
    input.calculationMethod ?? "ANNUITY"
  );
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
    : `${input.lenderName} Standby Loan`;
}

export async function recordLoanInterestBillPaid(options: {
  db: LoanDb;
  invoiceId: string;
  userId: string;
  bankAccountId: string | null;
  filePath: string | null;
  paidAt: Date;
}): Promise<void> {
  const invoice = await options.db.purchaseInvoice.findFirst({
    where: { id: options.invoiceId, reversedAt: null },
    select: {
      id: true,
      loanFacilityId: true,
      loanInterestPeriod: true,
      loanInterestAmount: true,
      amount: true,
      bankAccountId: true,
      filePath: true,
    },
  });
  if (!invoice?.loanFacilityId || !invoice.loanInterestPeriod) return;
  const existing = await options.db.loanMovement.findFirst({
    where: { purchaseInvoiceId: invoice.id, reversedAt: null },
    select: { id: true },
  });
  if (existing) return;
  const interest =
    decimalToNumber(invoice.loanInterestAmount) ??
    decimalToNumber(invoice.amount) ??
    0;
  await options.db.loanMovement.create({
    data: {
      facilityId: invoice.loanFacilityId,
      kind: "REPAYMENT",
      movementDate: options.paidAt,
      amount: new Prisma.Decimal(interest),
      principalAmount: new Prisma.Decimal(0),
      interestAmount: new Prisma.Decimal(interest),
      bankAccountId: options.bankAccountId ?? invoice.bankAccountId,
      purchaseInvoiceId: invoice.id,
      notes: "Monthly standby interest",
      filePath: options.filePath ?? invoice.filePath,
      createdById: options.userId,
    },
  });
}

async function createPaidLoanInvoiceAndMovement(options: {
  db: LoanDb;
  companyId: string;
  facility: {
    id: string;
    name: string;
    lenderName: string;
    vendorId: string | null;
    source: LoanSource;
    kind: BankLoanKind;
    principal: Prisma.Decimal | null;
    facilityLimit: Prisma.Decimal | null;
    annualRatePercent: Prisma.Decimal | null;
    interestRateBasis: LoanInterestBasis;
    tenorMonths: number | null;
    monthlyInstallment: Prisma.Decimal | null;
  };
  userId: string;
  amount: number;
  interest: number;
  principal: number;
  provision?: number | null;
  adminFee?: number | null;
  supplierName?: string;
  transferFee: number | null;
  movementDate: Date;
  bankAccountId: string | null;
  invoiceRef: string;
  filePath: string;
  notes: string;
}): Promise<{ purchaseInvoiceId: string; movementId: string }> {
  const invoice = await options.db.purchaseInvoice.create({
    data: {
      companyId: options.companyId,
      supplierName: options.supplierName ?? options.facility.lenderName,
      vendorId: options.facility.vendorId,
      invoiceRef: options.invoiceRef,
      invoiceDate: options.movementDate,
      amount: new Prisma.Decimal(options.amount),
      filePath: options.filePath,
      notes: options.notes,
      includesPpn: false,
      purchaseCategory: "BANK_LOAN",
      purpose: "INTERNAL",
      origin: "LOCAL",
      paymentTermsDays: CASH_PAYMENT_TERMS_DAYS,
      paidAt: new Date(),
      paidById: options.userId,
      bankAccountId: options.bankAccountId,
      createdById: options.userId,
      transferFeeIdr: moneyDec(options.transferFee),
      bankLoanKind: options.facility.kind,
      bankLoanPrincipal: options.facility.principal,
      bankLoanFacilityLimit: options.facility.facilityLimit,
      bankLoanAnnualRatePercent: options.facility.annualRatePercent,
      bankLoanInterestRateBasis: options.facility.interestRateBasis,
      bankLoanTenorMonths: options.facility.tenorMonths,
      bankLoanMonthlyInstallment: options.facility.monthlyInstallment,
      loanFacilityId: options.facility.id,
      loanSource: options.facility.source,
      loanPrincipalAmount: new Prisma.Decimal(options.principal),
      loanInterestAmount: new Prisma.Decimal(options.interest),
      loanProvisionAmount: moneyDec(options.provision),
      loanAdminFeeAmount: moneyDec(options.adminFee),
    },
    select: { id: true },
  });
  const movement = await options.db.loanMovement.create({
    data: {
      facilityId: options.facility.id,
      kind: "REPAYMENT",
      movementDate: options.movementDate,
      amount: new Prisma.Decimal(options.amount),
      principalAmount: new Prisma.Decimal(options.principal),
      interestAmount: new Prisma.Decimal(options.interest),
      transferFeeIdr: moneyDec(options.transferFee),
      bankAccountId: options.bankAccountId,
      purchaseInvoiceId: invoice.id,
      notes: options.notes,
      filePath: options.filePath,
      createdById: options.userId,
    },
    select: { id: true },
  });
  return { purchaseInvoiceId: invoice.id, movementId: movement.id };
}
