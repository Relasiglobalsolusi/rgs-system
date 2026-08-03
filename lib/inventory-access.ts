import type { Prisma } from "@prisma/client";

import {
  hasFullModuleAccess,
  type AccountTypeUser,
  type PermissionUser,
} from "@/lib/permissions";
import {
  canManageInventory,
  isAdminAccount,
} from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import {
  isDirectorPosition,
  isOperationsManagerPosition,
} from "@/lib/positions";

type InventoryActor = PermissionUser &
  AccountTypeUser & {
    username?: string | null;
    clientId?: string | null;
    vendorId?: string | null;
  };

/**
 * Assign stock to a project / void project issues: Operations Manager+,
 * Director, HO admin, or unrestricted full-module HO access.
 * Still requires inventory manage (HO + inventory module; never portal).
 */
export async function canAssignInventoryToProject(
  userId: string,
  user: InventoryActor
): Promise<boolean> {
  if (!canManageInventory(user)) return false;
  if (isAdminAccount(user)) return true;
  if (
    hasFullModuleAccess({
      ...user,
      username: user.username ?? undefined,
    })
  ) {
    return true;
  }

  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: {
      jobPosition: { select: { slug: true, name: true } },
    },
  });
  const position = employee?.jobPosition;
  if (!position) return false;
  return (
    isDirectorPosition(position) || isOperationsManagerPosition(position)
  );
}

/** Row lock for concurrent stock mutations (PostgreSQL). */
export async function lockInventoryItemRow(
  tx: Prisma.TransactionClient,
  itemId: string
): Promise<{
  id: string;
  currentStock: Prisma.Decimal;
  avgUnitCost: Prisma.Decimal | null;
  lastUnitCost: Prisma.Decimal | null;
  unit: string;
  active: boolean;
} | null> {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      currentStock: Prisma.Decimal;
      avgUnitCost: Prisma.Decimal | null;
      lastUnitCost: Prisma.Decimal | null;
      unit: string;
      active: boolean;
    }>
  >`
    SELECT id, "currentStock", "avgUnitCost", "lastUnitCost", unit, active
    FROM "InventoryItem"
    WHERE id = ${itemId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}
