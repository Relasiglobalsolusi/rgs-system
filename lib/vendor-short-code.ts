import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | {
  vendor: Prisma.VendorDelegate;
};

const SHORT_CODE_PREFIX = "V";
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

export function formatVendorShortCode(sequence: number): string {
  return `${SHORT_CODE_PREFIX}${String(sequence).padStart(SHORT_CODE_PAD, "0")}`;
}

/**
 * Next company-scoped short code (V001, V002, …). Soft-deleted vendors keep
 * their codes so references stay stable; gaps are reused only if freed.
 */
export async function getNextVendorShortCode(
  companyId: string,
  db: DbClient = prisma
): Promise<string> {
  const vendors = await db.vendor.findMany({
    where: {
      companyId,
      shortCode: { startsWith: SHORT_CODE_PREFIX },
    },
    select: { shortCode: true },
  });

  const usedSequences = vendors
    .map((vendor) => parseShortCodeSequence(vendor.shortCode))
    .filter((sequence): sequence is number => sequence !== null);

  return formatVendorShortCode(findLowestAvailableSequence(usedSequences));
}
