import type { Prisma } from "@prisma/client";

import { decimalToNumber } from "@/lib/project-billing";
import { prisma } from "@/lib/prisma";
import {
  nextLoanPayment,
  outstandingPrincipal,
  sumDraws,
  sumInterestPaid,
  sumPrincipalReturned,
  unusedFacility,
  type LoanSource,
} from "@/lib/loan-facility";
import type { BankLoanKind } from "@/lib/bank-loan";

const facilityInclude = {
  vendor: { select: { id: true, name: true } },
  bankAccount: {
    select: { id: true, bankName: true, accountNumber: true, label: true },
  },
  movements: {
    select: {
      id: true,
      kind: true,
      movementDate: true,
      amount: true,
      principalAmount: true,
      interestAmount: true,
      transferFeeIdr: true,
      notes: true,
      filePath: true,
      reversedAt: true,
      purchaseInvoiceId: true,
      bankAccountId: true,
      createdAt: true,
    },
    orderBy: [{ movementDate: "desc" as const }, { createdAt: "desc" as const }],
  },
} satisfies Prisma.LoanFacilityInclude;

export type LoanMovementRow = {
  id: string;
  kind: "DRAW" | "REPAYMENT";
  movementDate: Date;
  amount: number;
  principalAmount: number;
  interestAmount: number;
  transferFeeIdr: number;
  notes: string | null;
  filePath: string | null;
  reversedAt: Date | null;
  purchaseInvoiceId: string | null;
  bankAccountId: string | null;
};

export type LoanFacilitySnapshot = {
  id: string;
  name: string;
  source: LoanSource;
  kind: BankLoanKind;
  status: "ACTIVE" | "CLOSED";
  lenderName: string;
  vendorId: string | null;
  vendorName: string | null;
  bankAccountId: string | null;
  chargesInterest: boolean;
  annualRatePercent: number | null;
  facilityLimit: number | null;
  principal: number | null;
  tenorMonths: number | null;
  monthlyInstallment: number | null;
  startDate: Date;
  notes: string | null;
  outstanding: number;
  drawn: number;
  principalReturned: number;
  interestPaid: number;
  unusedLimit: number | null;
  suggestedPayment: number;
  interestDue: number;
  principalDue: number;
  movements: LoanMovementRow[];
};

function movementLike(row: {
  kind: "DRAW" | "REPAYMENT";
  amount: unknown;
  principalAmount: unknown;
  interestAmount: unknown;
  reversedAt: Date | null;
}) {
  return {
    kind: row.kind,
    amount: decimalToNumber(row.amount as never) ?? 0,
    principalAmount: decimalToNumber(row.principalAmount as never),
    interestAmount: decimalToNumber(row.interestAmount as never),
    reversedAt: row.reversedAt,
  };
}

export function snapshotLoanFacility(
  facility: Prisma.LoanFacilityGetPayload<{ include: typeof facilityInclude }>
): LoanFacilitySnapshot {
  const movements = facility.movements.map((row) => ({
    id: row.id,
    kind: row.kind,
    movementDate: row.movementDate,
    amount: decimalToNumber(row.amount) ?? 0,
    principalAmount: decimalToNumber(row.principalAmount) ?? 0,
    interestAmount: decimalToNumber(row.interestAmount) ?? 0,
    transferFeeIdr: decimalToNumber(row.transferFeeIdr) ?? 0,
    notes: row.notes,
    filePath: row.filePath,
    reversedAt: row.reversedAt,
    purchaseInvoiceId: row.purchaseInvoiceId,
    bankAccountId: row.bankAccountId,
  }));
  const likes = facility.movements.map(movementLike);
  const outstanding = outstandingPrincipal(likes);
  const annualRatePercent = decimalToNumber(facility.annualRatePercent);
  const monthlyInstallment = decimalToNumber(facility.monthlyInstallment);
  const next = nextLoanPayment({
    kind: facility.kind,
    outstanding,
    chargesInterest: facility.chargesInterest,
    annualPercent: annualRatePercent,
    tenorMonths: facility.tenorMonths,
    monthlyInstallment,
  });
  return {
    id: facility.id,
    name: facility.name,
    source: facility.source,
    kind: facility.kind,
    status: facility.status,
    lenderName: facility.lenderName,
    vendorId: facility.vendorId,
    vendorName: facility.vendor?.name ?? null,
    bankAccountId: facility.bankAccountId,
    chargesInterest: facility.chargesInterest,
    annualRatePercent,
    facilityLimit: decimalToNumber(facility.facilityLimit),
    principal: decimalToNumber(facility.principal),
    tenorMonths: facility.tenorMonths,
    monthlyInstallment,
    startDate: facility.startDate,
    notes: facility.notes,
    outstanding,
    drawn: sumDraws(likes),
    principalReturned: sumPrincipalReturned(likes),
    interestPaid: sumInterestPaid(likes),
    unusedLimit: unusedFacility({
      kind: facility.kind,
      facilityLimit: decimalToNumber(facility.facilityLimit),
      outstanding,
    }),
    suggestedPayment: next.suggestedPayment,
    interestDue: next.interest,
    principalDue: next.principal,
    movements,
  };
}

export async function listLoanFacilitySnapshots(
  companyId: string,
  options?: { status?: "ACTIVE" | "CLOSED" | "ALL"; source?: LoanSource }
): Promise<LoanFacilitySnapshot[]> {
  const rows = await prisma.loanFacility.findMany({
    where: {
      companyId,
      ...(options?.status && options.status !== "ALL"
        ? { status: options.status }
        : {}),
      ...(options?.source ? { source: options.source } : {}),
    },
    include: facilityInclude,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
  return rows.map(snapshotLoanFacility);
}

export async function getLoanFacilitySnapshot(
  companyId: string,
  facilityId: string
): Promise<LoanFacilitySnapshot | null> {
  const row = await prisma.loanFacility.findFirst({
    where: { id: facilityId, companyId },
    include: facilityInclude,
  });
  return row ? snapshotLoanFacility(row) : null;
}

export async function sumLoanDrawsInRange(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<number> {
  const agg = await prisma.loanMovement.aggregate({
    where: {
      facility: { companyId },
      kind: "DRAW",
      reversedAt: null,
      ...(from || toExclusive
        ? {
            movementDate: {
              ...(from ? { gte: from } : {}),
              ...(toExclusive ? { lt: toExclusive } : {}),
            },
          }
        : {}),
    },
    _sum: { amount: true },
  });
  return decimalToNumber(agg._sum.amount) ?? 0;
}

export async function sumLoanPrincipalReturnedInRange(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<number> {
  const agg = await prisma.loanMovement.aggregate({
    where: {
      facility: { companyId },
      kind: "REPAYMENT",
      reversedAt: null,
      ...(from || toExclusive
        ? {
            movementDate: {
              ...(from ? { gte: from } : {}),
              ...(toExclusive ? { lt: toExclusive } : {}),
            },
          }
        : {}),
    },
    _sum: { principalAmount: true },
  });
  return decimalToNumber(agg._sum.principalAmount) ?? 0;
}

export async function sumLoansPayable(companyId: string): Promise<number> {
  const snapshots = await listLoanFacilitySnapshots(companyId, {
    status: "ALL",
  });
  return snapshots.reduce((sum, row) => sum + row.outstanding, 0);
}

export type LoanFundingRow = {
  id: string;
  facilityId: string;
  facilityName: string;
  source: LoanSource;
  lenderName: string;
  movementDate: Date;
  amount: number;
};

export type LoanPayableRow = {
  id: string;
  name: string;
  source: LoanSource;
  lenderName: string;
  outstanding: number;
  unusedLimit: number | null;
};

export async function listLoanFundingInRange(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<LoanFundingRow[]> {
  const rows = await prisma.loanMovement.findMany({
    where: {
      facility: { companyId },
      kind: "DRAW",
      reversedAt: null,
      ...(from || toExclusive
        ? {
            movementDate: {
              ...(from ? { gte: from } : {}),
              ...(toExclusive ? { lt: toExclusive } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      amount: true,
      movementDate: true,
      facilityId: true,
      facility: {
        select: { name: true, source: true, lenderName: true },
      },
    },
    orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
    take: 80,
  });
  return rows.map((row) => ({
    id: row.id,
    facilityId: row.facilityId,
    facilityName: row.facility.name,
    source: row.facility.source,
    lenderName: row.facility.lenderName,
    movementDate: row.movementDate,
    amount: decimalToNumber(row.amount) ?? 0,
  }));
}

export async function listLoanPrincipalReturnedInRange(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<LoanFundingRow[]> {
  const rows = await prisma.loanMovement.findMany({
    where: {
      facility: { companyId },
      kind: "REPAYMENT",
      reversedAt: null,
      ...(from || toExclusive
        ? {
            movementDate: {
              ...(from ? { gte: from } : {}),
              ...(toExclusive ? { lt: toExclusive } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      principalAmount: true,
      movementDate: true,
      facilityId: true,
      facility: {
        select: { name: true, source: true, lenderName: true },
      },
    },
    orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
    take: 80,
  });
  return rows.map((row) => ({
    id: row.id,
    facilityId: row.facilityId,
    facilityName: row.facility.name,
    source: row.facility.source,
    lenderName: row.facility.lenderName,
    movementDate: row.movementDate,
    amount: decimalToNumber(row.principalAmount) ?? 0,
  }));
}

export async function listLoansPayableRows(
  companyId: string
): Promise<LoanPayableRow[]> {
  const snapshots = await listLoanFacilitySnapshots(companyId, {
    status: "ALL",
  });
  return snapshots
    .filter((row) => row.outstanding > 0)
    .map((row) => ({
      id: row.id,
      name: row.name,
      source: row.source,
      lenderName: row.lenderName,
      outstanding: row.outstanding,
      unusedLimit: row.unusedLimit,
    }));
}
