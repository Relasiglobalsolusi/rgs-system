import type { Prisma } from "@prisma/client";

import { hardDeleteLinkedUserLogin } from "@/lib/hard-delete-linked-user";

type Tx = Prisma.TransactionClient;

export function isTombstoneEmployeeNo(employeeNo: string): boolean {
  return employeeNo.includes("~deleted~");
}

export function toArchivedEmployeeNo(
  employeeNo: string,
  employeeId: string
): string {
  if (isTombstoneEmployeeNo(employeeNo)) {
    return employeeNo;
  }
  return `${employeeNo}~deleted~${employeeId}`;
}

/**
 * Completes forever-delete for an employee row:
 * tombstone employeeNo (frees number), unlink userId, hard-delete login.
 * Safe to re-run on incomplete archives (leftover login / untombstoned number).
 */
export async function completeEmployeeDirectoryArchive(
  tx: Tx,
  employee: {
    id: string;
    employeeNo: string;
    userId: string | null;
  }
) {
  const userId = employee.userId;

  await tx.employee.update({
    where: { id: employee.id },
    data: {
      archivedFromDirectory: true,
      employeeNo: toArchivedEmployeeNo(employee.employeeNo, employee.id),
      ...(userId ? { userId: null } : {}),
    },
  });

  if (userId) {
    await hardDeleteLinkedUserLogin(tx, userId);
  }
}

export function isIncompleteEmployeeDirectoryArchive(employee: {
  archivedFromDirectory: boolean;
  employeeNo: string;
  userId: string | null;
}): boolean {
  if (!employee.archivedFromDirectory) {
    return false;
  }
  return (
    employee.userId != null || !isTombstoneEmployeeNo(employee.employeeNo)
  );
}
