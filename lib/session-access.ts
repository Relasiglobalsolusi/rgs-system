import { prisma } from "@/lib/prisma";
import { parseModuleOverrides } from "@/lib/module-overrides";
import { isRosterActiveEmployeeStatus } from "@/lib/user-directory-status";

export type SessionAccessState = {
  allowed: boolean;
  sessionToken: string | null;
  moduleOverrides: Record<string, boolean> | null;
  jobPosition: {
    slug: string;
    name: string;
    defaultModuleAccess?: unknown;
  } | null;
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
    return {
      allowed: false,
      sessionToken: null,
      moduleOverrides: null,
      jobPosition: null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      active: true,
      sessionToken: true,
      moduleOverrides: true,
      client: { select: { active: true } },
      vendor: { select: { active: true } },
      employee: {
        select: {
          status: true,
          archivedFromDirectory: true,
          jobPosition: {
            select: { slug: true, name: true, defaultModuleAccess: true },
          },
        },
      },
    },
  });

  if (!user || !user.active) {
    return {
      allowed: false,
      sessionToken: null,
      moduleOverrides: null,
      jobPosition: null,
    };
  }

  if (user.client && user.client.active === false) {
    return {
      allowed: false,
      sessionToken: null,
      moduleOverrides: null,
      jobPosition: null,
    };
  }

  if (user.vendor && user.vendor.active === false) {
    return {
      allowed: false,
      sessionToken: null,
      moduleOverrides: null,
      jobPosition: null,
    };
  }

  if (
    user.employee &&
    (user.employee.archivedFromDirectory ||
      !isRosterActiveEmployeeStatus(user.employee.status))
  ) {
    return {
      allowed: false,
      sessionToken: null,
      moduleOverrides: null,
      jobPosition: null,
    };
  }

  return {
    allowed: true,
    sessionToken: user.sessionToken ?? null,
    moduleOverrides: parseModuleOverrides(user.moduleOverrides),
    jobPosition: user.employee?.jobPosition ?? null,
  };
}
