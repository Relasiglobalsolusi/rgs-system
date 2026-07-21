import type { MultiProjectSecurityMode, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Project statuses that count toward Multi-Project Access readiness. */
const COUNTABLE_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
] as const;

export async function countCountableClientProjects(
  clientId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  return tx.project.count({
    where: {
      clientId,
      status: { in: [...COUNTABLE_STATUSES] },
    },
  });
}

/**
 * Feature is "active" when the opt-in flag is on and the client has ≥2 countable projects.
 * Flag can be armed with 0 projects; unlock gating only applies when active.
 */
export async function isMultiProjectAccessActive(options: {
  multiProjectAccess: boolean;
  clientId: string;
  tx?: Prisma.TransactionClient | typeof prisma;
}): Promise<boolean> {
  if (!options.multiProjectAccess) return false;
  const count = await countCountableClientProjects(
    options.clientId,
    options.tx ?? prisma
  );
  return count >= 2;
}

/**
 * Cheap chrome check: load client flag + countable projects.
 * Returns false when clientId is missing or Multi-Project is not effectively on.
 */
export async function resolveMultiProjectAccessActive(
  clientId: string | null | undefined,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<boolean> {
  if (!clientId) return false;
  const client = await tx.client.findUnique({
    where: { id: clientId },
    select: { multiProjectAccess: true },
  });
  if (!client) return false;
  return isMultiProjectAccessActive({
    multiProjectAccess: client.multiProjectAccess,
    clientId,
    tx,
  });
}

export function defaultSecurityMode(
  enabled: boolean
): MultiProjectSecurityMode | null {
  return enabled ? "MASTER_AND_GROUP" : null;
}
