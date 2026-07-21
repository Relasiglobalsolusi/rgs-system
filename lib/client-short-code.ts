import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | {
  client: Prisma.ClientDelegate;
};

const SHORT_CODE_PREFIX = "C";
const SHORT_CODE_PAD = 3;

function parseShortCodeSequence(shortCode: string): number | null {
  const match = shortCode
    .trim()
    .toUpperCase()
    .match(new RegExp(`^${SHORT_CODE_PREFIX}(\\d+)$`));
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

function findLowestAvailableSequence(usedSequences: number[]): number {
  const used = new Set(usedSequences);
  let sequence = 1;
  while (used.has(sequence)) {
    sequence += 1;
  }
  return sequence;
}

export function formatClientShortCode(sequence: number): string {
  return `${SHORT_CODE_PREFIX}${String(sequence).padStart(SHORT_CODE_PAD, "0")}`;
}

/**
 * Next company-scoped short code (C001, C002, …). Soft-deleted clients keep
 * their codes so filenames stay stable; gaps are reused only if freed.
 */
export async function getNextClientShortCode(
  companyId: string,
  db: DbClient = prisma
): Promise<string> {
  const clients = await db.client.findMany({
    where: {
      companyId,
      shortCode: { startsWith: SHORT_CODE_PREFIX },
    },
    select: { shortCode: true },
  });

  const usedSequences = clients
    .map((client) => parseShortCodeSequence(client.shortCode))
    .filter((sequence): sequence is number => sequence !== null);

  return formatClientShortCode(findLowestAvailableSequence(usedSequences));
}
