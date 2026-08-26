import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";

export type PeriodReviewAmounts = {
  clientRequestedAmount: number | null;
  hoProposedAmount: number | null;
};

function toAmounts(row: {
  clientRequestedAmount?: unknown;
  hoProposedAmount?: unknown;
} | null | undefined): PeriodReviewAmounts {
  return {
    clientRequestedAmount: decimalToNumber(row?.clientRequestedAmount as never),
    hoProposedAmount: decimalToNumber(row?.hoProposedAmount as never),
  };
}

export async function loadPeriodReviewAmounts(
  periodId: string
): Promise<PeriodReviewAmounts> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ clientRequestedAmount: unknown; hoProposedAmount: unknown }>
    >`
      SELECT "clientRequestedAmount", "hoProposedAmount"
      FROM "ProjectInvoicePeriod"
      WHERE id = ${periodId}
    `;
    return toAmounts(rows[0]);
  } catch {
    return toAmounts(null);
  }
}

export async function loadPeriodReviewAmountsByIds(
  periodIds: string[]
): Promise<Map<string, PeriodReviewAmounts>> {
  const result = new Map<string, PeriodReviewAmounts>();
  if (periodIds.length === 0) return result;
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        clientRequestedAmount: unknown;
        hoProposedAmount: unknown;
      }>
    >`
      SELECT id, "clientRequestedAmount", "hoProposedAmount"
      FROM "ProjectInvoicePeriod"
      WHERE id IN (${Prisma.join(periodIds)})
    `;
    for (const row of rows) {
      result.set(row.id, toAmounts(row));
    }
    return result;
  } catch {
    return result;
  }
}

export async function setPeriodClientRequestedAmount(
  periodId: string,
  amount: number | null
) {
  await prisma.$executeRaw`
    UPDATE "ProjectInvoicePeriod"
    SET "clientRequestedAmount" = ${amount}
    WHERE id = ${periodId}
  `;
}

export async function setPeriodHoProposedAmount(
  periodId: string,
  amount: number | null
) {
  await prisma.$executeRaw`
    UPDATE "ProjectInvoicePeriod"
    SET "hoProposedAmount" = ${amount}
    WHERE id = ${periodId}
  `;
}

export async function clearPeriodReviewAmounts(periodId: string) {
  await prisma.$executeRaw`
    UPDATE "ProjectInvoicePeriod"
    SET "clientRequestedAmount" = NULL, "hoProposedAmount" = NULL
    WHERE id = ${periodId}
  `;
}

export async function setPurchaseHandlingHasTaxInvoice(
  invoiceId: string,
  value: boolean | null,
  db: { $executeRaw: typeof prisma.$executeRaw } = prisma
) {
  try {
    await db.$executeRaw`
      UPDATE "PurchaseInvoice"
      SET "handlingHasTaxInvoice" = ${value}
      WHERE id = ${invoiceId}
    `;
  } catch {
    // Column is in schema; Prisma client may not be regenerated yet.
  }
}
