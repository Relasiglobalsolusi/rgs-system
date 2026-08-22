import type { Prisma } from "@prisma/client";

import { decimalToNumber } from "@/lib/project-billing";
import { prisma } from "@/lib/prisma";
import {
  groupInterestPaidByMonth,
  lastRepaymentDate,
  loanExpenseFeeKind,
  outstandingPrincipal,
  sumDraws,
  sumInterestPaid,
  sumPrincipalReturned,
  unusedFacility,
  type InterestPaidMonth,
  type LoanSource,
} from "@/lib/loan-facility";
import type { BankLoanKind, LoanInterestBasis } from "@/lib/bank-loan";
import {
  buildStandbyUsageSlices,
  englishMonthYearLabel,
  yearMonthKey,
  type LoanInterestMonthRow,
  type StandbyUsageSlice,
} from "@/lib/loan-interest";
import { jakartaTodayAsUtcDateOnly } from "@/lib/leave-employment-status";
import { jakartaYearMonth } from "@/lib/vat";

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
      purchaseInvoice: {
        select: {
          loanProvisionAmount: true,
          loanAdminFeeAmount: true,
          loanInterestAmount: true,
          loanPrincipalAmount: true,
        },
      },
    },
    orderBy: [{ movementDate: "desc" as const }, { createdAt: "desc" as const }],
  },
  purchaseInvoices: {
    where: { reversedAt: null, loanInterestPeriod: { not: null } },
    select: {
      id: true,
      amount: true,
      paidAt: true,
      loanInterestPeriod: true,
      loanInterestAmount: true,
      invoiceRef: true,
    },
    orderBy: [{ invoiceDate: "asc" as const }],
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
  createdAt: Date;
  feeKind: "PROVISION" | "ADMIN_FEE" | null;
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
  bankAccountLabel: string | null;
  chargesInterest: boolean;
  interestRateBasis: LoanInterestBasis;
  annualRatePercent: number | null;
  interestPaidByMonth: InterestPaidMonth[];
  interestMonths: LoanInterestMonthRow[];
  usageSlices: StandbyUsageSlice[];
  dayCountYear: number;
  lastRepaymentDate: Date | null;
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
  interestPaidThisMonth: number;
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
    createdAt: row.createdAt,
    feeKind: row.purchaseInvoice
      ? loanExpenseFeeKind({
          loanProvisionAmount: decimalToNumber(
            row.purchaseInvoice.loanProvisionAmount
          ),
          loanAdminFeeAmount: decimalToNumber(
            row.purchaseInvoice.loanAdminFeeAmount
          ),
          loanInterestAmount: decimalToNumber(
            row.purchaseInvoice.loanInterestAmount
          ),
          loanPrincipalAmount: decimalToNumber(
            row.purchaseInvoice.loanPrincipalAmount
          ),
        })
      : null,
  }));
  const likes = facility.movements.map(movementLike);
  const outstanding = outstandingPrincipal(likes);
  const annualRatePercent = decimalToNumber(facility.annualRatePercent);
  const monthlyInstallment = decimalToNumber(facility.monthlyInstallment);
  const interestRateBasis = facility.interestRateBasis ?? "ANNUAL";
  const interestPaidByMonth = groupInterestPaidByMonth(movements);
  const interestMonths: LoanInterestMonthRow[] = interestPaidByMonth.map(
    (row) => {
      const [year, month] = row.yearMonth.split("-").map(Number);
      const match = movements.find(
        (movement) =>
          movement.kind === "REPAYMENT" &&
          movement.interestAmount > 0 &&
          movement.reversedAt == null &&
          yearMonthKey(
            movement.movementDate.getUTCFullYear(),
            movement.movementDate.getUTCMonth() + 1
          ) === row.yearMonth
      );
      return {
        yearMonth: row.yearMonth,
        year,
        month,
        label: englishMonthYearLabel(year, month),
        accrued: row.interest,
        paid: row.interest,
        due: 0,
        invoiceId: match?.purchaseInvoiceId ?? null,
        paidAt: match?.movementDate ?? null,
      };
    }
  );
  const dayCountYear = facility.dayCountYear === 365 ? 365 : 360;
  const usageSlices =
    facility.kind === "STANDBY"
      ? buildStandbyUsageSlices({
          movements,
          today: jakartaTodayAsUtcDateOnly(),
          ratePercent: annualRatePercent,
          basis: interestRateBasis,
          chargesInterest: facility.chargesInterest,
          dayCountYear,
        })
      : [];
  const suggestedPayment =
    facility.status === "ACTIVE" && facility.kind === "TERM"
      ? monthlyInstallment ?? 0
      : 0;
  const current = jakartaYearMonth();
  const currentKey = yearMonthKey(current.year, current.month);
  const interestPaidThisMonth =
    interestPaidByMonth.find((row) => row.yearMonth === currentKey)?.interest ??
    0;
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
    bankAccountLabel: facility.bankAccount
      ? [facility.bankAccount.label, facility.bankAccount.bankName]
          .filter(Boolean)
          .join(" · ") || facility.bankAccount.accountNumber
      : null,
    chargesInterest: facility.chargesInterest,
    interestRateBasis,
    annualRatePercent,
    interestPaidByMonth,
    interestMonths,
    usageSlices,
    dayCountYear,
    lastRepaymentDate: lastRepaymentDate(movements),
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
    suggestedPayment,
    interestPaidThisMonth,
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

export async function sumLoanInterestDue(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<number> {
  return sumLoanInterestPaidInRange(companyId, from, toExclusive);
}

export async function sumLoanInterestPaidInRange(
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
    _sum: { interestAmount: true },
  });
  return decimalToNumber(agg._sum.interestAmount) ?? 0;
}

export type LoanInterestDueRow = {
  id: string;
  name: string;
  source: LoanSource;
  lenderName: string;
  interestDue: number;
  outstanding: number;
};

export async function listLoanInterestDueRows(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<LoanInterestDueRow[]> {
  const rows = await prisma.loanMovement.findMany({
    where: {
      facility: { companyId },
      kind: "REPAYMENT",
      reversedAt: null,
      interestAmount: { gt: 0 },
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
      interestAmount: true,
      facilityId: true,
      facility: {
        select: { name: true, source: true, lenderName: true },
      },
    },
  });
  const byFacility = new Map<string, LoanInterestDueRow>();
  for (const row of rows) {
    const current = byFacility.get(row.facilityId);
    const interest = decimalToNumber(row.interestAmount) ?? 0;
    if (current) {
      current.interestDue += interest;
      continue;
    }
    byFacility.set(row.facilityId, {
      id: row.facilityId,
      name: row.facility.name,
      source: row.facility.source,
      lenderName: row.facility.lenderName,
      interestDue: interest,
      outstanding: 0,
    });
  }
  return [...byFacility.values()].filter((row) => row.interestDue > 0);
}
