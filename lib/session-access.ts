import { prisma } from "@/lib/prisma";
import { parseModuleOverrides } from "@/lib/module-overrides";
import { isRosterActiveEmployeeStatus } from "@/lib/user-directory-status";

export type SessionAccessState = {
  allowed: boolean;
  moduleOverrides: Record<string, boolean> | null;
};

/**
 * Live access check for JWT/proxy — kick sessions when portal access is revoked,
 * the linked client/vendor is soft-deleted, or the employee leaves the roster.
 * Matches authorize() gates in lib/auth.ts so already-logged-in users do not
 * wait for the 8h JWT maxAge.
 */
export async function fetchSessionAccessState(
  userId: string
): Promise<SessionAccessState> {
  if (!userId) {
    return { allowed: false, moduleOverrides: null };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      active: true,
      moduleOverrides: true,
      client: { select: { active: true } },
      vendor: { select: { active: true } },
      employee: {
        select: { status: true, archivedFromDirectory: true },
      },
    },
  });

  if (!user || !user.active) {
    return { allowed: false, moduleOverrides: null };
  }

  if (user.client && user.client.active === false) {
    return { allowed: false, moduleOverrides: null };
  }

  if (user.vendor && user.vendor.active === false) {
    return { allowed: false, moduleOverrides: null };
  }

  if (
    user.employee &&
    (user.employee.archivedFromDirectory ||
      !isRosterActiveEmployeeStatus(user.employee.status))
  ) {
    return { allowed: false, moduleOverrides: null };
  }

  return {
    allowed: true,
    moduleOverrides: parseModuleOverrides(user.moduleOverrides),
  };
}
