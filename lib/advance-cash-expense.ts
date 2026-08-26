import { Prisma } from "@prisma/client";

import { decimalToNumber } from "@/lib/project-billing";

type AdvanceCashDb = Prisma.TransactionClient;

export function prepaidTopUpDescription(
  invoiceRef: string,
  notes?: string | null
) {
  const trimmed = notes?.trim() ?? "";
  return trimmed ? `${trimmed} · ${invoiceRef}` : `Top-up ${invoiceRef}`;
}

export function isPrepaidCardTopUpInvoice(invoice: {
  purpose?: string | null;
  purchaseCategory?: string | null;
  supplierName?: string | null;
  invoiceRef?: string | null;
}) {
  return (
    invoice.supplierName === "Prepaid Card" ||
    (invoice.invoiceRef ?? "").startsWith("PPC-")
  );
}

export function isPettyCashTopUpInvoice(invoice: {
  purpose?: string | null;
  purchaseCategory?: string | null;
  supplierName?: string | null;
  invoiceRef?: string | null;
}) {
  return (
    invoice.purpose === "PETTY_CASH" &&
    invoice.purchaseCategory === "PETTY_CASH" &&
    !isPrepaidCardTopUpInvoice(invoice)
  );
}

export async function creditPrepaidCardFromExpense(
  tx: AdvanceCashDb,
  options: {
    companyId: string;
    userId: string;
    prepaidCardId: string;
    amount: Prisma.Decimal | number;
    invoiceRef: string;
    invoiceDate: Date;
    notes?: string | null;
    filePath?: string | null;
  }
) {
  const card = await tx.prepaidCard.findFirst({
    where: { id: options.prepaidCardId, companyId: options.companyId },
  });
  if (!card) throw new Error("Prepaid card not found.");
  const amount = decimalToNumber(options.amount) ?? 0;
  if (amount <= 0) throw new Error("Enter a valid amount.");
  const previous = decimalToNumber(card.currentBalance) ?? 0;
  const resulting = previous + amount;
  await tx.prepaidCard.update({
    where: { id: card.id },
    data: { currentBalance: new Prisma.Decimal(resulting) },
  });
  await tx.prepaidCardEntry.create({
    data: {
      prepaidCardId: card.id,
      kind: "TOP_UP",
      amount: options.amount,
      previousBalance: previous,
      resultingBalance: resulting,
      proofPath: options.filePath || null,
      entryDate: options.invoiceDate,
      description: prepaidTopUpDescription(options.invoiceRef, options.notes),
      createdById: options.userId,
    },
  });
  return card;
}

/** Reverse a prepaid-card top-up that came from an expense. */
export async function unwindPrepaidTopUpFromInvoice(
  tx: AdvanceCashDb,
  invoice: { id: string; invoiceRef: string; amount: Prisma.Decimal | number }
) {
  const amount = decimalToNumber(invoice.amount) ?? 0;
  const entries = await tx.prepaidCardEntry.findMany({
    where: {
      kind: "TOP_UP",
      description: { contains: invoice.invoiceRef },
    },
    select: { id: true, prepaidCardId: true, amount: true },
  });
  for (const entry of entries) {
    const card = await tx.prepaidCard.findUnique({
      where: { id: entry.prepaidCardId },
      select: { id: true, currentBalance: true },
    });
    if (card) {
      const next =
        (decimalToNumber(card.currentBalance) ?? 0) -
        (decimalToNumber(entry.amount) ?? amount);
      await tx.prepaidCard.update({
        where: { id: card.id },
        data: { currentBalance: new Prisma.Decimal(next) },
      });
    }
    await tx.prepaidCardEntry.delete({ where: { id: entry.id } });
  }
}

/**
 * Apply expense top-ups that never landed on petty cash / prepaid balances.
 * Safe to run on page load: skips invoices that already have a matching entry.
 */
export async function applyMissingExpenseTopUps(
  tx: AdvanceCashDb,
  options: { companyId: string; userId: string }
) {
  const invoices = await tx.purchaseInvoice.findMany({
    where: {
      companyId: options.companyId,
      reversedAt: null,
      OR: [
        { purpose: "PETTY_CASH", purchaseCategory: "PETTY_CASH" },
        { purchaseCategory: "VEHICLE", supplierName: "Prepaid Card" },
        { invoiceRef: { startsWith: "PPC-" } },
      ],
    },
    select: {
      id: true,
      invoiceRef: true,
      invoiceDate: true,
      amount: true,
      notes: true,
      filePath: true,
      supplierName: true,
      purchaseCategory: true,
      purpose: true,
      createdById: true,
      pettyCashEntry: { select: { id: true } },
    },
  });

  for (const invoice of invoices) {
    const amount = decimalToNumber(invoice.amount) ?? 0;
    if (amount <= 0) continue;

    if (isPrepaidCardTopUpInvoice(invoice)) {
      const already = await tx.prepaidCardEntry.findFirst({
        where: {
          kind: "TOP_UP",
          description: { contains: invoice.invoiceRef },
        },
        select: { id: true },
      });
      if (already) continue;

      const cardNumber =
        invoice.notes?.match(/Prepaid card top-up\s+(.+)$/i)?.[1]?.trim() ??
        "";
      const card = cardNumber
        ? await tx.prepaidCard.findFirst({
            where: { companyId: options.companyId, cardNumber },
            select: { id: true, currentBalance: true },
          })
        : null;
      if (!card) continue;

      await creditPrepaidCardFromExpense(tx, {
        companyId: options.companyId,
        userId: invoice.createdById ?? options.userId,
        prepaidCardId: card.id,
        amount: invoice.amount,
        invoiceRef: invoice.invoiceRef,
        invoiceDate: invoice.invoiceDate,
        notes: invoice.notes,
        filePath: invoice.filePath,
      });
      continue;
    }

    if (!isPettyCashTopUpInvoice(invoice) || invoice.pettyCashEntry) continue;

    await tx.pettyCashEntry.create({
      data: {
        companyId: options.companyId,
        kind: "TOP_UP",
        status: "POSTED",
        amount: invoice.amount,
        entryDate: invoice.invoiceDate,
        description: invoice.notes || `Petty Cash top-up ${invoice.invoiceRef}`,
        purchaseInvoiceId: invoice.id,
        createdById: invoice.createdById ?? options.userId,
        postedAt: new Date(),
        proofPath: invoice.filePath || null,
      },
    });
  }
}
