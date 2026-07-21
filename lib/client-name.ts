import type { Prisma } from "@prisma/client";

import { normalizeClientName } from "@/lib/client-login-id";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | typeof prisma;

/**
 * Company + individual client names must be unique among all non-permanently
 * deleted rows (active and soft-deleted), using {@link normalizeClientName}
 * (trim, collapse spaces, casefold, strip diacritics).
 *
 * Full individual name only — not first-name alone. Soft-deleted names stay
 * reserved until permanent delete (matches import / legal-name SOP).
 */
export async function assertClientNameAvailable(
  options: {
    companyId: string;
    name: string;
    excludeId?: string;
  },
  db: Tx = prisma
): Promise<string> {
  const nameNormalized = normalizeClientName(options.name);
  if (!nameNormalized) {
    throw new Error("Client name is required.");
  }

  const existing = await db.client.findFirst({
    where: {
      companyId: options.companyId,
      nameNormalized,
      ...(options.excludeId ? { id: { not: options.excludeId } } : {}),
    },
    select: { id: true, name: true, active: true },
  });

  if (existing) {
    if (existing.active) {
      throw new Error(`A client named "${existing.name}" already exists.`);
    }
    throw new Error(
      `A client named "${existing.name}" already exists in Deleted clients. Restore it or permanently delete it before reusing the name.`
    );
  }

  return nameNormalized;
}
