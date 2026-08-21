import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function writeRecordChange(options: {
  companyId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  description?: string | null;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  db?: Pick<Prisma.TransactionClient, "auditLog"> | typeof prisma;
}) {
  const db = options.db ?? prisma;
  await db.auditLog.create({
    data: {
      companyId: options.companyId,
      userId: options.userId ?? null,
      action: options.action,
      entity: options.entity,
      entityId: options.entityId ?? null,
      description: options.description ?? null,
      oldValue: options.oldValue ?? undefined,
      newValue: options.newValue ?? undefined,
    },
  });
}
