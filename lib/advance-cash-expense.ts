import { Prisma } from "@prisma/client";

import {
  canTopUpPrepaidCard,
  prepaidTopUpLabel,
} from "@/lib/prepaid-card";
import { currentPrepaidAssignment, writePrepaidCardEntry } from "@/lib/prepaid-card-lifecycle";
import { decimalToNumber } from "@/lib/project-billing";

type AdvanceCashDb = Prisma.TransactionClient;

export function isPrepaidCardReplacementFeeInvoice(invoice: {
  invoiceRef?: string | null;
}) {
  return (invoice.invoiceRef ?? "").startsWith("CRF-");
}

export function isPrepaidOpenCardTopUpInvoice(invoice: {
  invoiceRef?: string | null;
  purchaseCategory?: string | null;
  prepaidCard?: { kind?: string | null } | null;
}) {
  if (invoice.prepaidCard?.kind === "OPEN") return true;
  return (invoice.invoiceRef ?? "").startsWith("OPC-");
}

export function isPrepaidCardTopUpInvoice(invoice: {
  purpose?: string | null;
  purchaseCategory?: string | null;
  supplierName?: string | null;
  invoiceRef?: string | null;
  prepaidCard?: { kind?: string | null } | null;
}) {
  if (isPrepaidCardReplacementFeeInvoice(invoice)) return false;
  if ((invoice.invoiceRef ?? "").startsWith("PPC-")) return true;
  if ((invoice.invoiceRef ?? "").startsWith("OPC-")) return true;
  if (invoice.prepaidCard?.kind === "OPEN" || invoice.prepaidCard?.kind === "VEHICLE") {
    return true;
  }
  return invoice.supplierName === "Prepaid Card";
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
    purchaseInvoiceId?: string | null;
  }
) {
  const card = await tx.prepaidCard.findFirst({
    where: { id: options.prepaidCardId, companyId: options.companyId },
  });
  if (!card) throw new Error("Prepaid card not found.");
  if (!canTopUpPrepaidCard(card.status)) {
    throw new Error("This Card cannot be topped up.");
  }
  const amount = decimalToNumber(options.amount) ?? 0;
  if (amount <= 0) throw new Error("Enter a valid amount.");
  const assignment = await currentPrepaidAssignment(tx, card.id);
  const label = prepaidTopUpLabel(card.kind, card.cardNumber);
  const note = options.notes?.trim();
  await writePrepaidCardEntry(tx, {
    cardId: card.id,
    kind: "TOP_UP",
    amount,
    balanceDelta: amount,
    entryDate: options.invoiceDate,
    description: note ? `${label} · ${note}` : label,
    createdById: options.userId,
    proofPath: options.filePath || null,
    assignmentId: assignment?.id ?? null,
    purchaseInvoiceId: options.purchaseInvoiceId ?? null,
  });
  return card;
}

/** Reverse a prepaid-card top-up that came from an expense. */
export async function unwindPrepaidTopUpFromInvoice(
  tx: AdvanceCashDb,
  invoice: { id: string; invoiceRef: string; amount: Prisma.Decimal | number }
) {
  const amount = decimalToNumber(invoice.amount) ?? 0;
  const byInvoice = await tx.prepaidCardEntry.findMany({
    where: { kind: "TOP_UP", purchaseInvoiceId: invoice.id },
    select: { id: true, prepaidCardId: true, amount: true },
  });
  const entries =
    byInvoice.length > 0
      ? byInvoice
      : await tx.prepaidCardEntry.findMany({
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
        { invoiceRef: { startsWith: "OPC-" } },
        { prepaidCardId: { not: null } },
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
      prepaidCardId: true,
      employeeId: true,
      pettyCashEntry: { select: { id: true } },
    },
  });

  for (const invoice of invoices) {
    const amount = decimalToNumber(invoice.amount) ?? 0;
    if (amount <= 0) continue;
    if (isPrepaidCardReplacementFeeInvoice(invoice)) continue;

    if (isPrepaidCardTopUpInvoice(invoice)) {
      const already = await tx.prepaidCardEntry.findFirst({
        where: {
          kind: "TOP_UP",
          OR: [
            { purchaseInvoiceId: invoice.id },
            { description: { contains: invoice.invoiceRef } },
          ],
        },
        select: { id: true },
      });
      if (already) continue;

      const card =
        invoice.prepaidCardId
          ? await tx.prepaidCard.findFirst({
              where: { id: invoice.prepaidCardId, companyId: options.companyId },
              select: { id: true },
            })
          : null;
      const cardNumber =
        invoice.notes?.match(/Prepaid card top-up\s+(.+)$/i)?.[1]?.trim() ??
        invoice.notes?.match(/Top up (?:Vehicle|Open) Card\s+(.+)$/i)?.[1]?.replace(/\s+/g, "") ??
        "";
      const byNumber =
        card ??
        (cardNumber
          ? await tx.prepaidCard.findFirst({
              where: { companyId: options.companyId, cardNumber },
              select: { id: true },
            })
          : null);
      if (!byNumber) continue;

      await creditPrepaidCardFromExpense(tx, {
        companyId: options.companyId,
        userId: invoice.createdById ?? options.userId,
        prepaidCardId: byNumber.id,
        amount: invoice.amount,
        invoiceRef: invoice.invoiceRef,
        invoiceDate: invoice.invoiceDate,
        notes: invoice.notes,
        filePath: invoice.filePath,
        purchaseInvoiceId: invoice.id,
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
        employeeId: invoice.employeeId,
        holderEmployeeId: invoice.employeeId,
      },
    });
  }
}
