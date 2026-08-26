import {
  getPettyCashBalanceAsOf,
  processScheduledPettyCashPays,
} from "@/lib/petty-cash";
import { applyMissingExpenseTopUps } from "@/lib/advance-cash-expense";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { formatEmployeeName } from "@/lib/employee-user-link";

export type AdvanceCashReportPettyRow = {
  id: string;
  entryDate: Date;
  kind: "TOP_UP" | "SPEND" | "PART_TIME_PAY";
  amount: number;
  description: string;
  projectName: string | null;
  clientName: string | null;
  employeeName: string | null;
  purchaseInvoiceId: string | null;
};

export type AdvanceCashReportPrepaidRow = {
  id: string;
  prepaidCardId: string;
  entryDate: Date;
  kind: "TOP_UP" | "SPEND";
  spendKind: "FUEL" | "TOLL" | "PARKING" | null;
  amount: number;
  description: string;
  cardNumber: string;
  vehicleName: string;
  vehiclePlate: string | null;
};

export type PettyCashPeriodStatement = {
  opening: number;
  remaining: number;
  periodTopUp: number;
  periodSpend: number;
  entries: AdvanceCashReportPettyRow[];
};

export type PrepaidCardPeriodStatement = {
  cardId: string;
  cardNumber: string;
  vehicleName: string;
  vehiclePlate: string | null;
  opening: number;
  remaining: number;
  periodTopUp: number;
  periodSpend: number;
  entries: AdvanceCashReportPrepaidRow[];
};

export const EMPTY_PETTY_CASH_STATEMENT: PettyCashPeriodStatement = {
  opening: 0,
  remaining: 0,
  periodTopUp: 0,
  periodSpend: 0,
  entries: [],
};

export function advanceCashRunningBalances(
  opening: number,
  entries: Array<{ kind: string; amount: number }>
): number[] {
  let balance = opening;
  return entries.map((entry) => {
    balance += entry.kind === "TOP_UP" ? entry.amount : -entry.amount;
    return balance;
  });
}

function signedKindTotals(
  groups: Array<{
    prepaidCardId: string;
    kind: string;
    _sum: { amount: { toString(): string } | number | null };
  }>
) {
  const byCard = new Map<string, number>();
  for (const row of groups) {
    const amount = decimalToNumber(row._sum.amount) ?? 0;
    const signed = row.kind === "TOP_UP" ? amount : -amount;
    byCard.set(row.prepaidCardId, (byCard.get(row.prepaidCardId) ?? 0) + signed);
  }
  return byCard;
}

function periodTotals(entries: Array<{ kind: string; amount: number }>) {
  let periodTopUp = 0;
  let periodSpend = 0;
  for (const entry of entries) {
    if (entry.kind === "TOP_UP") periodTopUp += entry.amount;
    else periodSpend += entry.amount;
  }
  return { periodTopUp, periodSpend };
}

function periodWhere(from?: Date, toExclusive?: Date) {
  if (!from && !toExclusive) return {};
  return {
    entryDate: {
      ...(from ? { gte: from } : {}),
      ...(toExclusive ? { lt: toExclusive } : {}),
    },
  };
}

/** Keep float balances current before a Financial Report read. */
export async function syncAdvanceCashBalancesForCompany(options: {
  companyId: string;
  userId: string;
}) {
  await processScheduledPettyCashPays(prisma, options.companyId);
  await prisma.$transaction((tx) =>
    applyMissingExpenseTopUps(tx, {
      companyId: options.companyId,
      userId: options.userId,
    })
  );
}

export async function listPettyCashReportEntries(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<AdvanceCashReportPettyRow[]> {
  const entries = await prisma.pettyCashEntry.findMany({
    where: {
      companyId,
      status: "POSTED",
      ...periodWhere(from, toExclusive),
    },
    select: {
      id: true,
      entryDate: true,
      kind: true,
      amount: true,
      description: true,
      purchaseInvoiceId: true,
      project: { select: { name: true } },
      client: { select: { name: true } },
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });
  return entries.map((entry) => ({
    id: entry.id,
    entryDate: entry.entryDate,
    kind: entry.kind,
    amount: decimalToNumber(entry.amount) ?? 0,
    description: entry.description,
    projectName: entry.project?.name ?? null,
    clientName: entry.client?.name ?? null,
    employeeName: entry.employee ? formatEmployeeName(entry.employee) : null,
    purchaseInvoiceId: entry.purchaseInvoiceId,
  }));
}

export async function listPrepaidCardReportEntries(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<AdvanceCashReportPrepaidRow[]> {
  const entries = await prisma.prepaidCardEntry.findMany({
    where: {
      prepaidCard: { companyId },
      ...periodWhere(from, toExclusive),
    },
    select: {
      id: true,
      prepaidCardId: true,
      entryDate: true,
      kind: true,
      spendKind: true,
      amount: true,
      description: true,
      prepaidCard: {
        select: {
          cardNumber: true,
          vehicleItem: {
            select: {
              name: true,
              equipmentAssets: {
                select: { assetCode: true },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              },
            },
          },
        },
      },
    },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });
  return entries.map((entry) => ({
    id: entry.id,
    prepaidCardId: entry.prepaidCardId,
    entryDate: entry.entryDate,
    kind: entry.kind,
    spendKind: entry.spendKind,
    amount: decimalToNumber(entry.amount) ?? 0,
    description: entry.description,
    cardNumber: entry.prepaidCard.cardNumber,
    vehicleName: entry.prepaidCard.vehicleItem.name,
    vehiclePlate:
      entry.prepaidCard.vehicleItem.equipmentAssets
        .map((asset) => asset.assetCode)
        .filter(Boolean)
        .join(" / ") || null,
  }));
}

export async function getPettyCashPeriodStatement(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<PettyCashPeriodStatement> {
  const [opening, remaining, entries] = await Promise.all([
    from
      ? getPettyCashBalanceAsOf(prisma, companyId, from)
      : Promise.resolve(0),
    getPettyCashBalanceAsOf(prisma, companyId, toExclusive),
    listPettyCashReportEntries(companyId, from, toExclusive),
  ]);
  return {
    opening,
    remaining,
    ...periodTotals(entries),
    entries,
  };
}

export async function listPrepaidCardPeriodStatements(
  companyId: string,
  from?: Date,
  toExclusive?: Date
): Promise<PrepaidCardPeriodStatement[]> {
  const [cards, openingGroups, remainingGroups, entries] = await Promise.all([
    prisma.prepaidCard.findMany({
      where: { companyId },
      select: {
        id: true,
        cardNumber: true,
        vehicleItem: {
          select: {
            name: true,
            equipmentAssets: {
              select: { assetCode: true },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            },
          },
        },
      },
      orderBy: { cardNumber: "asc" },
    }),
    prisma.prepaidCardEntry.groupBy({
      by: ["prepaidCardId", "kind"],
      where: {
        prepaidCard: { companyId },
        ...(from ? { entryDate: { lt: from } } : { id: "__none__" }),
      },
      _sum: { amount: true },
    }),
    prisma.prepaidCardEntry.groupBy({
      by: ["prepaidCardId", "kind"],
      where: {
        prepaidCard: { companyId },
        ...(toExclusive ? { entryDate: { lt: toExclusive } } : {}),
      },
      _sum: { amount: true },
    }),
    listPrepaidCardReportEntries(companyId, from, toExclusive),
  ]);

  const openingByCard = signedKindTotals(openingGroups);
  const remainingByCard = signedKindTotals(remainingGroups);

  const entriesByCard = new Map<string, AdvanceCashReportPrepaidRow[]>();
  for (const entry of entries) {
    const current = entriesByCard.get(entry.prepaidCardId) ?? [];
    current.push(entry);
    entriesByCard.set(entry.prepaidCardId, current);
  }

  return cards
    .map((card) => {
      const cardEntries = entriesByCard.get(card.id) ?? [];
      const opening = openingByCard.get(card.id) ?? 0;
      const totals = periodTotals(cardEntries);
      const remaining =
        remainingByCard.get(card.id) ??
        opening + totals.periodTopUp - totals.periodSpend;
      return {
        cardId: card.id,
        cardNumber: card.cardNumber,
        vehicleName: card.vehicleItem.name,
        vehiclePlate:
          card.vehicleItem.equipmentAssets
            .map((asset) => asset.assetCode)
            .filter(Boolean)
            .join(" / ") || null,
        opening,
        remaining,
        ...totals,
        entries: cardEntries,
      };
    })
    .filter(
      (card) =>
        card.opening !== 0 ||
        card.remaining !== 0 ||
        card.entries.length > 0
    );
}
