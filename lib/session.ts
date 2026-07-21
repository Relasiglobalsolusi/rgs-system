import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { fetchUserModuleOverrides } from "@/lib/module-overrides";
import {
  canAccess,
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
  };
}): PermissionUser & {
  username?: string;
  clientId?: string | null;
  vendorId?: string | null;
} {
  return {
    role: session.user.role as UserRole,
    username: session.user.username,
    employeeType: session.user.employeeType ?? null,
    moduleOverrides: session.user.moduleOverrides ?? null,
    clientId: session.user.clientId ?? null,
    vendorId: session.user.vendorId ?? null,
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

export async function requireRole(allowed: UserRole[]) {
  const session = await requireSession();
  const role = session.user.role as UserRole;

  if (!allowed.includes(role)) {
    redirect("/dashboard");
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

export async function getEmployeeForUser(userId: string) {
  if (!userId) return null;

  const { prisma } = await import("@/lib/prisma");

  // userId is @unique — always resolve the signed-in user's linked employee only.
  return prisma.employee.findUnique({
    where: { userId },
  });
}
