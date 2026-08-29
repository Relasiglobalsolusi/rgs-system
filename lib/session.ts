import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { fetchUserModuleOverrides } from "@/lib/module-overrides";
import {
  canAccess,
  getAdvanceCashAccess,
  isFinanceModuleKey,
  type ModuleKey,
  type PermissionUser,
} from "@/lib/permissions";
import type { EmployeeType, UserRole } from "@prisma/client";

export function toPermissionUser(session: {
  user: {
    role: string;
    username?: string;
    employeeType?: EmployeeType | null;
    moduleOverrides?: Record<string, boolean> | null;
    clientId?: string | null;
    vendorId?: string | null;
    employee?: {
      employeeNo: string;
      employeeType?: EmployeeType | null;
      jobPosition?: {
        slug?: string | null;
        name?: string | null;
        defaultModuleAccess?: unknown;
      } | null;
    } | null;
  };
}): PermissionUser & {
  username?: string;
  clientId?: string | null;
  vendorId?: string | null;
  employee?: {
    employeeNo: string;
    employeeType?: EmployeeType | null;
    jobPosition?: {
      slug?: string | null;
      name?: string | null;
      defaultModuleAccess?: unknown;
    } | null;
  } | null;
} {
  return {
    role: session.user.role as UserRole,
    username: session.user.username,
    employeeType: session.user.employeeType ?? null,
    moduleOverrides: session.user.moduleOverrides ?? null,
    clientId: session.user.clientId ?? null,
    vendorId: session.user.vendorId ?? null,
    employee: session.user.employee ?? null,
  };
}

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.mustSetPassword) {
    redirect("/set-password");
  }

  if (session.user.mustSetRecoveryEmail) {
    redirect("/set-recovery-email");
  }

  // Prefer DB overrides so Approvals (etc.) grants apply without waiting on JWT.
  const freshOverrides = await fetchUserModuleOverrides(session.user.id);
  session.user.moduleOverrides = freshOverrides;

  // Client Multi-Project Access: require Security Code unlock (idle 30 min).
  // Unlock page uses requireMultiProjectUnlockSession so it does not loop.
  if (session.user.clientId) {
    const { isMultiProjectAccessActive } = await import(
      "@/lib/multi-project-access"
    );
    const { readMultiProjectUnlock } = await import(
      "@/lib/multi-project-unlock"
    );
    const { prisma } = await import("@/lib/prisma");

    const client = await prisma.client.findUnique({
      where: { id: session.user.clientId },
      select: { multiProjectAccess: true },
    });
    if (client) {
      const active = await isMultiProjectAccessActive({
        multiProjectAccess: client.multiProjectAccess,
        clientId: session.user.clientId,
      });
      if (active) {
        const unlock = await readMultiProjectUnlock(session.user.clientId);
        if (!unlock) {
          redirect("/multi-project-unlock");
        }
      }
    }
  }

  return session;
}

/** Session for the Multi-Project unlock page (skips unlock redirect). */
export async function requireMultiProjectUnlockSession() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.mustSetPassword) {
    redirect("/set-password");
  }

  if (session.user.mustSetRecoveryEmail) {
    redirect("/set-recovery-email");
  }

  if (!session.user.clientId) {
    redirect("/dashboard");
  }

  const freshOverrides = await fetchUserModuleOverrides(session.user.id);
  session.user.moduleOverrides = freshOverrides;

  return session;
}

export async function requirePasswordChangeSession() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

export async function requireModule(module: ModuleKey) {
  const session = await requireSession();
  const user = toPermissionUser(session);

  if (!canAccess(user, module)) {
    redirect("/dashboard");
  }

  return session;
}

/** Gates one Finance page. Each page is its own module. */
export async function requireFinanceChild(navKey: string) {
  if (!isFinanceModuleKey(navKey)) {
    redirect("/dashboard");
  }
  return requireModule(navKey);
}

/** Operations page: field float. Own module — not implied by Projects or Finance. */
export async function requirePettyCashAccess() {
  return requireModule("pettyCash");
}

export async function requireAdvanceCashPettyAccess() {
  const session = await requirePettyCashAccess();
  const access = getAdvanceCashAccess(toPermissionUser(session));
  if (!access.petty) {
    redirect(access.prepaid ? "/billing/petty-cash?tab=prepaid" : "/dashboard");
  }
  return session;
}

export async function requireAdvanceCashPrepaidAccess() {
  const session = await requirePettyCashAccess();
  const access = getAdvanceCashAccess(toPermissionUser(session));
  if (!access.prepaid) {
    redirect(access.petty ? "/billing/petty-cash" : "/dashboard");
  }
  return session;
}

export async function getEmployeeForUser(userId: string) {
  if (!userId) return null;

  const { prisma } = await import("@/lib/prisma");

  // userId is @unique — always resolve the signed-in user's linked employee only.
  return prisma.employee.findUnique({
    where: { userId },
    include: {
      jobPosition: { select: { name: true, slug: true } },
    },
  });
}
