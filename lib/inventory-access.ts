import type { Prisma } from "@prisma/client";

import {
  isOwnerAccount,
  type AccountTypeUser,
  type PermissionUser,
} from "@/lib/permissions";
import { canManageInventory } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import {
  isAreaManagerPosition,
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
 * Assign stock to a project: Area Manager+, Director, or owner.
 * Still requires inventory manage (HO + inventory module; never portal).
 */
export async function canAssignInventoryToProject(
  userId: string,
  user: InventoryActor
): Promise<boolean> {
  if (!canManageInventory(user)) return false;
  if (isOwnerAccount({ username: user.username })) return true;

  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: {
      jobPosition: { select: { slug: true, name: true } },
    },
  });
  const position = employee?.jobPosition;
  if (!position) return false;
  return (
    isDirectorPosition(position) ||
    isOperationsManagerPosition(position) ||
    isAreaManagerPosition(position)
  );
}

/** Return To Vendor: Director and above, or owner `vicko`. Not OM / AM. */
export async function canReturnEquipmentToFactory(
  userId: string,
  user: InventoryActor
): Promise<boolean> {
  if (!canManageInventory(user)) return false;
  if (isOwnerAccount({ username: user.username })) return true;

  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: {
      jobPosition: { select: { slug: true, name: true } },
    },
  });
  const position = employee?.jobPosition;
  if (!position) return false;
  return isDirectorPosition(position);
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
