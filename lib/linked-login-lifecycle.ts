import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** Soft-deactivate a linked employee login; keeps credentials and Employee.userId. */
export async function softDeactivateEmployeeLogin(
  tx: Tx,
  userId: string | null | undefined
) {
  if (!userId) return;
  await tx.user.update({
    where: { id: userId },
    data: { active: false },
  });
}

/** Soft-deactivate all portal logins for a client; keeps clientId links. */
export async function softDeactivateClientLogins(tx: Tx, clientId: string) {
  await tx.user.updateMany({
    where: { clientId },
    data: { active: false },
  });
}

/** Soft-deactivate all portal logins for a vendor; keeps vendorId links. */
export async function softDeactivateVendorLogins(tx: Tx, vendorId: string) {
  await tx.user.updateMany({
    where: { vendorId },
    data: { active: false },
  });
}

/**
 * Parent restore must NOT re-enable portal login. Defensive: keep linked
 * User.active = false so the login lands in Revoked Access.
 */
export async function ensureEmployeeLoginStaysInactive(
  tx: Tx,
  userId: string | null | undefined
) {
  if (!userId) return;
  await tx.user.update({
    where: { id: userId },
    data: { active: false },
  });
}

export async function ensureClientLoginsStayInactive(
  tx: Tx,
  clientId: string
) {
  await tx.user.updateMany({
    where: { clientId },
    data: { active: false },
  });
}

export async function ensureVendorLoginsStayInactive(
  tx: Tx,
  vendorId: string
) {
  await tx.user.updateMany({
    where: { vendorId },
    data: { active: false },
  });
}
