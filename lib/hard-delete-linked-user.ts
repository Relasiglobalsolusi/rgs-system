import type { Prisma } from "@prisma/client";

/**
 * Permanently remove linked login account(s).
 * Nulls optional FKs that would block User delete, then deletes the row(s)
 * (username, password, email — gone forever).
 * Used for forever-delete of employees / clients, and for
 * Permanently Remove Portal Login Access (linked User only) — not soft delete / revoke.
 */
export async function hardDeleteLinkedUserLogins(
  tx: Prisma.TransactionClient,
  userIds: string[]
) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;

  await tx.employee.updateMany({
    where: { userId: { in: ids } },
    data: { userId: null },
  });

  await tx.auditLog.updateMany({
    where: { userId: { in: ids } },
    data: { userId: null },
  });

  await tx.leaveRequest.updateMany({
    where: { reviewedById: { in: ids } },
    data: { reviewedById: null },
  });

  await tx.invoiceCompilation.updateMany({
    where: { createdById: { in: ids } },
    data: { createdById: null },
  });

  await tx.projectInvoicePeriod.updateMany({
    where: { compiledById: { in: ids } },
    data: { compiledById: null },
  });

  await tx.projectInvoicePeriod.updateMany({
    where: { taxInvoiceDoneById: { in: ids } },
    data: { taxInvoiceDoneById: null },
  });

  await tx.projectInvoicePeriod.updateMany({
    where: { paymentVerifiedById: { in: ids } },
    data: { paymentVerifiedById: null },
  });

  await tx.user.deleteMany({ where: { id: { in: ids } } });
}

export async function hardDeleteLinkedUserLogin(
  tx: Prisma.TransactionClient,
  userId: string
) {
  await hardDeleteLinkedUserLogins(tx, [userId]);
}
