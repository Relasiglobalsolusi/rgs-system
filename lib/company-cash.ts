import { Prisma } from "@prisma/client";

import { formatBankAccountOptionLabel } from "@/lib/company-bank-accounts";
import { decimalToNumber } from "@/lib/project-billing";

export type PurchasePaymentMethod = "BANK" | "CASH";

type CashDb = {
  companyCashMovement: Prisma.TransactionClient["companyCashMovement"];
  companyBankAccount: Prisma.TransactionClient["companyBankAccount"];
};

export type CompanyCashMovementRow = {
  id: string;
  kind: "WITHDRAW" | "SPEND" | "DEPOSIT";
  amount: number;
  occurredAt: Date;
  note: string | null;
  bankLabel: string | null;
  purchaseInvoiceId: string | null;
  supplierName: string | null;
  invoiceRef: string | null;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parsePurchasePaymentMethod(
  raw: FormDataEntryValue | string | null | undefined
): PurchasePaymentMethod {
  return String(raw ?? "").trim().toUpperCase() === "CASH" ? "CASH" : "BANK";
}

export function purchaseAllowsCashPayment(input: {
  origin?: string | null;
  purchaseCategory?: string | null;
  vehicleExpenseKind?: string | null;
  openCardTopUp?: boolean;
}): boolean {
  const origin = String(input.origin ?? "LOCAL").trim().toUpperCase();
  const category = String(input.purchaseCategory ?? "").trim().toUpperCase();
  const vehicleKind = String(input.vehicleExpenseKind ?? "")
    .trim()
    .toUpperCase();
  if (origin === "IMPORT") return false;
  if (input.openCardTopUp) return false;
  if (category === "OPEN_CARD") return false;
  if (
    category === "PETTY_CASH" ||
    category === "GOVERNMENT" ||
    category === "BANK_LOAN" ||
    category === "EMPLOYEE_PAYMENT"
  ) {
    return false;
  }
  if (vehicleKind === "PREPAID_CARD") return false;
  return true;
}

export async function companyCashBalance(
  db: CashDb,
  companyId: string
): Promise<number> {
  const [withdrawn, spent, deposited] = await Promise.all([
    db.companyCashMovement.aggregate({
      where: { companyId, kind: "WITHDRAW", reversedAt: null },
      _sum: { amount: true },
    }),
    db.companyCashMovement.aggregate({
      where: { companyId, kind: "SPEND", reversedAt: null },
      _sum: { amount: true },
    }),
    db.companyCashMovement.aggregate({
      where: { companyId, kind: "DEPOSIT", reversedAt: null },
      _sum: { amount: true },
    }),
  ]);
  return roundMoney(
    (decimalToNumber(withdrawn._sum.amount) ?? 0) -
      (decimalToNumber(spent._sum.amount) ?? 0) -
      (decimalToNumber(deposited._sum.amount) ?? 0)
  );
}

async function lockCompanyCash(db: CashDb, companyId: string): Promise<void> {
  const tx = db as CashDb & {
    $queryRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  };
  if (typeof tx.$queryRaw === "function") {
    await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;
  }
}

export async function sumCashWithdrawalsFromBank(
  db: CashDb,
  options: {
    companyId: string;
    bankAccountId: string;
    from?: Date;
    toExclusive?: Date;
  }
): Promise<number> {
  const agg = await db.companyCashMovement.aggregate({
    where: {
      companyId: options.companyId,
      kind: "WITHDRAW",
      reversedAt: null,
      bankAccountId: options.bankAccountId,
      occurredAt: {
        ...(options.from ? { gte: options.from } : {}),
        ...(options.toExclusive ? { lt: options.toExclusive } : {}),
      },
    },
    _sum: { amount: true },
  });
  return roundMoney(decimalToNumber(agg._sum.amount) ?? 0);
}

export async function recordCashWithdraw(
  db: CashDb,
  options: {
    companyId: string;
    amount: number;
    occurredAt: Date;
    bankAccountId: string;
    note?: string | null;
    userId: string;
  }
): Promise<void> {
  const amount = roundMoney(options.amount);
  if (!(amount > 0)) {
    throw new Error("Enter a valid amount.");
  }
  const bank = await db.companyBankAccount.findFirst({
    where: { id: options.bankAccountId, companyId: options.companyId },
    select: { id: true },
  });
  if (!bank) {
    throw new Error("Bank account not found.");
  }
  await db.companyCashMovement.create({
    data: {
      companyId: options.companyId,
      kind: "WITHDRAW",
      amount: new Prisma.Decimal(amount),
      occurredAt: options.occurredAt,
      bankAccountId: bank.id,
      note: options.note?.trim() || null,
      createdById: options.userId,
    },
  });
}

export async function recordCashSpend(
  db: CashDb,
  options: {
    companyId: string;
    amount: number;
    occurredAt: Date;
    purchaseInvoiceId: string;
    userId: string;
  }
): Promise<void> {
  const amount = roundMoney(options.amount);
  if (!(amount > 0)) {
    throw new Error("Enter a valid amount.");
  }
  await lockCompanyCash(db, options.companyId);
  const balance = await companyCashBalance(db, options.companyId);
  if (balance < amount) {
    throw new Error("INSUFFICIENT_CASH");
  }
  const existing = await db.companyCashMovement.findFirst({
    where: { purchaseInvoiceId: options.purchaseInvoiceId, reversedAt: null },
    select: { id: true },
  });
  if (existing) {
    throw new Error("This expense is already paid from Cash At Hand.");
  }
  await db.companyCashMovement.create({
    data: {
      companyId: options.companyId,
      kind: "SPEND",
      amount: new Prisma.Decimal(amount),
      occurredAt: options.occurredAt,
      purchaseInvoiceId: options.purchaseInvoiceId,
      createdById: options.userId,
    },
  });
}

export async function recordCashDeposit(
  db: CashDb,
  options: {
    companyId: string;
    amount: number;
    occurredAt: Date;
    bankAccountId: string;
    note?: string | null;
    userId: string;
  }
): Promise<void> {
  const amount = roundMoney(options.amount);
  if (!(amount > 0)) {
    throw new Error("Enter a valid amount.");
  }
  await lockCompanyCash(db, options.companyId);
  const balance = await companyCashBalance(db, options.companyId);
  if (balance < amount) {
    throw new Error("INSUFFICIENT_CASH");
  }
  const bank = await db.companyBankAccount.findFirst({
    where: { id: options.bankAccountId, companyId: options.companyId },
    select: { id: true },
  });
  if (!bank) {
    throw new Error("Bank account not found.");
  }
  await db.companyCashMovement.create({
    data: {
      companyId: options.companyId,
      kind: "DEPOSIT",
      amount: new Prisma.Decimal(amount),
      occurredAt: options.occurredAt,
      bankAccountId: bank.id,
      note: options.note?.trim() || null,
      createdById: options.userId,
    },
  });
}

export async function reverseCashSpendForPurchase(
  db: CashDb,
  purchaseInvoiceId: string
): Promise<void> {
  await db.companyCashMovement.updateMany({
    where: {
      purchaseInvoiceId,
      kind: "SPEND",
      reversedAt: null,
    },
    data: { reversedAt: new Date() },
  });
}

export async function listCompanyCashMovements(
  db: CashDb,
  companyId: string,
  range?: { from?: Date; toExclusive?: Date }
): Promise<CompanyCashMovementRow[]> {
  const rows = await db.companyCashMovement.findMany({
    where: {
      companyId,
      reversedAt: null,
      ...(range?.from || range?.toExclusive
        ? {
            occurredAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.toExclusive ? { lt: range.toExclusive } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      kind: true,
      amount: true,
      occurredAt: true,
      note: true,
      bankAccount: {
        select: {
          bankName: true,
          accountNumber: true,
          accountHolder: true,
          label: true,
        },
      },
      purchaseInvoice: {
        select: { id: true, supplierName: true, invoiceRef: true },
      },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    ...(range?.from || range?.toExclusive ? {} : { take: 200 }),
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    amount: decimalToNumber(row.amount) ?? 0,
    occurredAt: row.occurredAt,
    note: row.note,
    bankLabel: row.bankAccount
      ? formatBankAccountOptionLabel(row.bankAccount)
      : null,
    purchaseInvoiceId: row.purchaseInvoice?.id ?? null,
    supplierName: row.purchaseInvoice?.supplierName ?? null,
    invoiceRef: row.purchaseInvoice?.invoiceRef ?? null,
  }));
}
