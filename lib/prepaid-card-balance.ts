import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";

/** Posted card top-ups minus spends as of the period end. Live when the end is still open. */
export async function getPrepaidCardsBalanceAsOf(
  companyId: string,
  toExclusive?: Date
): Promise<number> {
  const groups = await prisma.prepaidCardEntry.groupBy({
    by: ["kind"],
    where: {
      prepaidCard: { companyId },
      ...(toExclusive ? { entryDate: { lt: toExclusive } } : {}),
    },
    _sum: { amount: true },
  });
  let topUp = 0;
  let spend = 0;
  for (const row of groups) {
    const amount = decimalToNumber(row._sum.amount) ?? 0;
    if (row.kind === "TOP_UP") topUp += amount;
    else spend += amount;
  }
  return topUp - spend;
}
