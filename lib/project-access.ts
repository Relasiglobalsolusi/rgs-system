import type { Prisma, ProjectStatus, ProjectSubCategory } from "@prisma/client";

import {
  canAccess,
  isHoAdminAccount,
  type AccountTypeUser,
  type PermissionUser,
} from "@/lib/permissions";
import {
  isAreaManagerPosition,
  isOperationsManagerPosition,
} from "@/lib/positions";
import { isContractCycleSubCategory } from "@/lib/project-contract";
import {
  PROJECT_IN_PROGRESS_LIST_STATUSES,
  PROJECT_PENDING_APPROVAL_LIST_STATUSES,
  PROJECT_PLANNING_LIST_STATUSES,
} from "@/lib/project-status";

type SessionUser = {
  companyId: string;
  /** When set, restrict to this client's projects only (portal login). */
  clientId?: string | null;
  /** Signed-in user — used to apply Operations Manager service-area scope. */
  userId?: string | null;
  username?: string | null;
};

/** Planning + In Progress + Pending Approval (+ legacy ON_HOLD) — admin-only hard delete. */
export const PROJECT_ADMIN_DELETE_STATUSES = [
  ...PROJECT_PLANNING_LIST_STATUSES,
  ...PROJECT_IN_PROGRESS_LIST_STATUSES,
  ...PROJECT_PENDING_APPROVAL_LIST_STATUSES,
  "ON_HOLD",
] as const satisfies readonly ProjectStatus[];

export function isAdminDeletableProjectStatus(
  status: ProjectStatus | string | null | undefined
): boolean {
  return (
    !!status &&
    (PROJECT_ADMIN_DELETE_STATUSES as readonly string[]).includes(status)
  );
}

type ProjectAdminUser = AccountTypeUser & { clientId?: string | null };

export async function getProjectWhereForUser(
  user: SessionUser
): Promise<Prisma.ProjectWhereInput> {
  const omScope = user.clientId
    ? null
    : await (await import("@/lib/om-approval")).getOmServiceAreaListFilter({
        userId: user.userId,
        username: user.username,
        clientId: user.clientId,
      });

  const base: Prisma.ProjectWhereInput = {
    companyId: user.companyId,
    ...(user.clientId ? { clientId: user.clientId } : {}),
    ...(omScope ?? {}),
  };

  if (!user.clientId) return base;

  const { prisma } = await import("@/lib/prisma");
  const { isMultiProjectAccessActive } = await import(
    "@/lib/multi-project-access"
  );
  const { readMultiProjectUnlock } = await import(
    "@/lib/multi-project-unlock"
  );

  const client = await prisma.client.findUnique({
    where: { id: user.clientId },
    select: { multiProjectAccess: true },
  });
  if (!client) return base;

  const active = await isMultiProjectAccessActive({
    multiProjectAccess: client.multiProjectAccess,
    clientId: user.clientId,
  });
  if (!active) return base;

  const unlock = await readMultiProjectUnlock(user.clientId);
  if (!unlock) {
    // No unlock — hide all projects until Security Code is entered.
    return { ...base, id: { in: [] } };
  }

  // Ungrouped projects stay inaccessible while Multi-Project Access is active.
  if (unlock.scope.kind === "MASTER") {
    return { ...base, groupId: { not: null } };
  }

  return { ...base, groupId: unlock.scope.groupId };
}

/** True when the signed-in user is a client portal account. */
export function isClientPortalUser(user: {
  clientId?: string | null;
}): boolean {
  return Boolean(user.clientId);
}

/** True when the signed-in user is a vendor portal account. */
export function isVendorPortalUser(user: {
  vendorId?: string | null;
}): boolean {
  return Boolean(user.vendorId);
}

/** Office admin account (not employee-linked, not client/vendor portal). */
export function isAdminAccount(user: AccountTypeUser): boolean {
  return isHoAdminAccount(user);
}

export function canManageProjects(
  user: PermissionUser & { clientId?: string | null; vendorId?: string | null }
) {
  // Client/vendor portal users may view scoped data but not create/edit projects.
  if (isClientPortalUser(user) || isVendorPortalUser(user)) return false;
  return canAccess(user, "projects");
}

/** Head Office: create teams and allocate permanent members. */
export function canManageTeams(
  user: PermissionUser & { clientId?: string | null; vendorId?: string | null }
) {
  if (isClientPortalUser(user) || isVendorPortalUser(user)) return false;
  return canAccess(user, "teams");
}

/**
 * Permanent delete of Planning / In Progress projects.
 * Admins only — HO employees and clients cannot delete these stages.
 */
export function canDeleteActiveStageProjects(user: ProjectAdminUser): boolean {
  return canManageProjects(user) && isAdminAccount(user);
}

/**
 * In Progress Regular / General / Facade Cleaning projects cannot be
 * hard-deleted via Delete. Regular contracts use End Contract instead
 * (marks COMPLETED and issues invoices — removes from In Progress).
 */
export function isInProgressCleaningProjectDeleteBlocked(opts: {
  status: ProjectStatus | string | null | undefined;
  subCategory: ProjectSubCategory | string | null | undefined;
}): boolean {
  // Internal HO/Warehouse sites may be deleted (system can recreate empty shells).
  if (opts.subCategory === "INTERNAL") return false;
  return (
    opts.status === "IN_PROGRESS" ||
    opts.status === "WAITING_FOR_APPROVAL" ||
    opts.status === "OFF_SITE"
  );
}

/** User-facing reason when {@link isInProgressCleaningProjectDeleteBlocked}. */
export function getInProgressCleaningProjectDeleteBlockReason(opts: {
  status: ProjectStatus | string | null | undefined;
  subCategory: ProjectSubCategory | string | null | undefined;
}): string | null {
  if (!isInProgressCleaningProjectDeleteBlocked(opts)) return null;

  // Regular contracts also show End Contract on the detail page.
  if (isContractCycleSubCategory(opts.subCategory)) {
    return "Live jobs cannot be deleted. Use End Contract to close this project.";
  }
  return "Live jobs cannot be deleted.";
}

/**
 * Client directory create/edit/delete.
 * Admin accounts and staff with the clients module (not client portal / field site).
 * `isAdminAccount` (incl. username `vicko`) always may manage when they have module access.
 */
export function canManageClients(
  user: PermissionUser &
    AccountTypeUser & { clientId?: string | null; vendorId?: string | null }
) {
  if (isClientPortalUser(user) || isVendorPortalUser(user)) return false;
  return canAccess(user, "clients");
}

/**
 * Vendor directory create/edit/delete.
 * Head-office admin / HO staff with the vendors module only.
 * Vendor portal accounts must never edit vendor/company details — even if a
 * mistaken module override grants `vendors`.
 */
export function canManageVendors(
  user: PermissionUser &
    AccountTypeUser & { clientId?: string | null; vendorId?: string | null }
) {
  if (isClientPortalUser(user) || isVendorPortalUser(user)) return false;
  return canAccess(user, "vendors");
}

/**
 * Inventory catalog / purchases / project issues.
 * Head-office admin / HO staff with the inventory module.
 * Client and vendor portals never manage inventory.
 */
export function canManageInventory(
  user: PermissionUser &
    AccountTypeUser & { clientId?: string | null; vendorId?: string | null }
) {
  if (isClientPortalUser(user) || isVendorPortalUser(user)) return false;
  return canAccess(user, "inventory");
}

export function canManageItemCatalog(
  user: PermissionUser &
    AccountTypeUser & { clientId?: string | null; vendorId?: string | null }
) {
  if (isClientPortalUser(user) || isVendorPortalUser(user)) return false;
  return canAccess(user, "itemCatalog");
}

/**
 * Finance → Financial Report (client / project P&L).
 * Anyone with Financial Report module access — never client or vendor portals.
 */
export function canViewFinancialReport(
  user: PermissionUser &
    AccountTypeUser & { clientId?: string | null; vendorId?: string | null }
) {
  if (isClientPortalUser(user) || isVendorPortalUser(user)) return false;
  return canAccess(user, "financialReport");
}

/**
 * Employee directory create/edit/delete.
 * Admin accounts and HEAD_OFFICE staff with the employees module.
 * Field / project-site staff cannot manage even with a mistaken override.
 * `isAdminAccount` (incl. username `vicko`) always may manage when they have module access.
 */
export function canManageEmployees(
  user: PermissionUser &
    AccountTypeUser & { clientId?: string | null; vendorId?: string | null }
) {
  if (isClientPortalUser(user) || isVendorPortalUser(user)) return false;
  return canAccess(user, "employees");
}

/** Head Office only. Operations Manager cannot resign people. */
export function canResignEmployees(
  user: PermissionUser &
    AccountTypeUser & {
      clientId?: string | null;
      vendorId?: string | null;
      employee?: {
        jobPosition?: { slug?: string | null; name?: string | null } | null;
      } | null;
    }
) {
  if (!canManageEmployees(user)) return false;
  const jobPosition = user.employee?.jobPosition;
  if (jobPosition && isOperationsManagerPosition(jobPosition)) return false;
  if (jobPosition && isAreaManagerPosition(jobPosition)) return false;
  return true;
}
