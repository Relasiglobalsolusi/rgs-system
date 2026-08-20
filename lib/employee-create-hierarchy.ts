import type { UserRole } from "@prisma/client";

import {
  isHoAdminAccount,
  type AccountTypeUser,
  type PermissionUser,
} from "@/lib/permissions";
import {
  isAreaManagerPosition,
  isDirectorPosition,
  isOperationsManagerPosition,
} from "@/lib/positions";
import { prisma } from "@/lib/prisma";

/**
 * Who is creating/editing employees.
 * HO admin (owner / Admin accounts) can assign any position including Director.
 * Director can assign OM, Area Manager, and below — not Director.
 * OM can assign Area Manager and below (not OM, not Director).
 * Area Manager can assign only below Area Manager.
 */
export type EmployeeCreateActorTier =
  | "HO_ADMIN"
  | "DIRECTOR"
  | "OPERATIONS_MANAGER"
  | "AREA_MANAGER"
  | "OTHER";

export type PositionRankRef = {
  slug?: string | null;
  name?: string | null;
};

export function getEmployeeCreateActorTier(
  user: AccountTypeUser &
    PermissionUser & {
      employee?: {
        jobPosition?: PositionRankRef | null;
      } | null;
    }
): EmployeeCreateActorTier {
  if (isHoAdminAccount(user)) return "HO_ADMIN";
  const position = user.employee?.jobPosition;
  if (position && isDirectorPosition(position)) return "DIRECTOR";
  if (position && isOperationsManagerPosition(position)) {
    return "OPERATIONS_MANAGER";
  }
  if (position && isAreaManagerPosition(position)) {
    return "AREA_MANAGER";
  }
  return "OTHER";
}

/** True when this actor may create/assign the given job position. */
export function canAssignEmployeePosition(
  actorTier: EmployeeCreateActorTier,
  targetPosition: PositionRankRef | null | undefined
): boolean {
  if (!targetPosition) return false;
  if (actorTier === "HO_ADMIN") return true;

  const targetIsDirector = isDirectorPosition(targetPosition);
  const targetIsOm = isOperationsManagerPosition(targetPosition);
  const targetIsAm = isAreaManagerPosition(targetPosition);

  if (actorTier === "DIRECTOR") {
    return !targetIsDirector;
  }
  if (actorTier === "OPERATIONS_MANAGER") {
    return !targetIsDirector && !targetIsOm;
  }
  if (actorTier === "AREA_MANAGER") {
    return !targetIsDirector && !targetIsOm && !targetIsAm;
  }
  // Other HO staff with employees module: below OM only (may add Area Manager).
  return !targetIsDirector && !targetIsOm;
}

export function filterPositionsForEmployeeCreateActor<T extends PositionRankRef>(
  actorTier: EmployeeCreateActorTier,
  positions: T[]
): T[] {
  return positions.filter((position) =>
    canAssignEmployeePosition(actorTier, position)
  );
}

export function employeeCreateHierarchyError(
  actorTier: EmployeeCreateActorTier,
  targetPosition: PositionRankRef
): string {
  if (isDirectorPosition(targetPosition)) {
    return "Only the account owner can add a Director.";
  }
  if (isOperationsManagerPosition(targetPosition)) {
    if (
      actorTier === "OPERATIONS_MANAGER" ||
      actorTier === "AREA_MANAGER" ||
      actorTier === "OTHER"
    ) {
      return "Operations Managers can only add employees below Operations Manager.";
    }
    return "You cannot assign this position.";
  }
  if (isAreaManagerPosition(targetPosition)) {
    if (actorTier === "AREA_MANAGER") {
      return "Area Managers can only add employees below Area Manager.";
    }
    return "You cannot assign this position.";
  }
  return "You cannot assign this position.";
}

type SessionLike = {
  user: {
    id: string;
    username?: string | null;
    role?: string | null;
    clientId?: string | null;
    vendorId?: string | null;
    employeeType?: string | null;
    employee?: {
      employeeType?: string | null;
      employeeNo?: string | null;
    } | null;
    moduleOverrides?: Record<string, boolean> | null;
  };
};

/** Load actor tier from the signed-in session (includes linked employee position). */
export async function resolveEmployeeCreateActorTier(
  session: SessionLike
): Promise<EmployeeCreateActorTier> {
  const user = session.user;
  const permissionUser: AccountTypeUser & PermissionUser = {
    role: (user.role ?? "USER") as UserRole,
    username: user.username ?? undefined,
    clientId: user.clientId ?? null,
    vendorId: user.vendorId ?? null,
    employeeType: (user.employeeType ??
      user.employee?.employeeType ??
      null) as AccountTypeUser["employeeType"],
    employee: user.employee
      ? {
          employeeNo: user.employee.employeeNo ?? "",
          employeeType: user.employee.employeeType as AccountTypeUser["employeeType"],
        }
      : null,
    moduleOverrides: user.moduleOverrides ?? null,
  };

  // Owner / Admin accounts (e.g. vicko) can assign any position.
  if (isHoAdminAccount(permissionUser)) {
    return "HO_ADMIN";
  }

  const employee = await prisma.employee.findFirst({
    where: { userId: user.id },
    select: {
      employeeNo: true,
      employeeType: true,
      jobPosition: { select: { slug: true, name: true } },
    },
  });

  return getEmployeeCreateActorTier({
    ...permissionUser,
    employee: employee
      ? {
          employeeNo: employee.employeeNo,
          employeeType: employee.employeeType,
          jobPosition: employee.jobPosition,
        }
      : null,
  });
}

export async function assertCanAssignEmployeePosition(
  session: SessionLike,
  targetPosition: PositionRankRef | null | undefined
) {
  const actorTier = await resolveEmployeeCreateActorTier(session);
  if (!targetPosition || !canAssignEmployeePosition(actorTier, targetPosition)) {
    throw new Error(
      targetPosition
        ? employeeCreateHierarchyError(actorTier, targetPosition)
        : "Position is required."
    );
  }
  return actorTier;
}

/** For editing: actor must be allowed to manage the employee's current rank too. */
export async function assertCanManageEmployeeRecord(
  session: SessionLike,
  currentPosition: PositionRankRef | null | undefined
) {
  const actorTier = await resolveEmployeeCreateActorTier(session);
  if (
    currentPosition &&
    !canAssignEmployeePosition(actorTier, currentPosition)
  ) {
    throw new Error(
      "You can only manage employees below your level."
    );
  }
  return actorTier;
}
