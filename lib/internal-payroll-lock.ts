import type { Prisma } from "@prisma/client";

import { isHoAdminAccount, type PermissionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type InternalPayrollLockState = {
  locked: boolean;
  lockedAt: string | null;
  lockedByName: string | null;
  unlockedAt: string | null;
  unlockedByName: string | null;
  unlockReason: string | null;
};

export type InternalPayrollActor = {
  id: string;
  name: string;
};

function emptyLockState(): InternalPayrollLockState {
  return {
    locked: false,
    lockedAt: null,
    lockedByName: null,
    unlockedAt: null,
    unlockedByName: null,
    unlockReason: null,
  };
}

function toLockState(row: {
  locked: boolean;
  lockedAt: Date | null;
  lockedByName: string | null;
  unlockedAt: Date | null;
  unlockedByName: string | null;
  unlockReason: string | null;
}): InternalPayrollLockState {
  return {
    locked: row.locked,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    lockedByName: row.lockedByName,
    unlockedAt: row.unlockedAt?.toISOString() ?? null,
    unlockedByName: row.unlockedByName,
    unlockReason: row.unlockReason,
  };
}

export function isInternalPayrollSnapshot(
  value: Prisma.JsonValue | null | undefined
): value is Prisma.JsonArray {
  return Array.isArray(value);
}

export function snapshotToPayrollRows<T>(
  value: Prisma.JsonValue | null | undefined
): T[] | null {
  if (!isInternalPayrollSnapshot(value)) return null;
  return value as unknown as T[];
}

/** Head Office admin or Head Office employee — not client/vendor/field. */
export function canUnlockInternalPayroll(user: PermissionUser): boolean {
  if (isHoAdminAccount(user)) return true;
  return user.employeeType === "HEAD_OFFICE";
}

export async function getInternalPayrollLockState(
  companyId: string,
  year: number,
  month: number
): Promise<InternalPayrollLockState> {
  const row = await prisma.internalPayrollLock.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
    select: {
      locked: true,
      lockedAt: true,
      lockedByName: true,
      unlockedAt: true,
      unlockedByName: true,
      unlockReason: true,
    },
  });
  return row ? toLockState(row) : emptyLockState();
}

export async function getInternalPayrollLockRecord(
  companyId: string,
  year: number,
  month: number
) {
  return prisma.internalPayrollLock.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
    select: {
      id: true,
      locked: true,
      lockedAt: true,
      lockedByName: true,
      unlockedAt: true,
      unlockedByName: true,
      unlockReason: true,
      snapshot: true,
    },
  });
}

export async function assertInternalPayrollPeriodUnlocked(
  companyId: string,
  year: number,
  month: number,
  lockedMessage: string
) {
  const row = await prisma.internalPayrollLock.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
    select: { locked: true },
  });
  if (row?.locked) {
    throw new Error(lockedMessage);
  }
}

export async function lockInternalPayrollPeriod(options: {
  companyId: string;
  year: number;
  month: number;
  actor: InternalPayrollActor;
  snapshot: unknown[];
}): Promise<InternalPayrollLockState> {
  const now = new Date();
  const row = await prisma.internalPayrollLock.upsert({
    where: {
      companyId_year_month: {
        companyId: options.companyId,
        year: options.year,
        month: options.month,
      },
    },
    update: {
      locked: true,
      lockedAt: now,
      lockedById: options.actor.id,
      lockedByName: options.actor.name,
      snapshot: options.snapshot as unknown as Prisma.InputJsonValue,
    },
    create: {
      companyId: options.companyId,
      year: options.year,
      month: options.month,
      locked: true,
      lockedAt: now,
      lockedById: options.actor.id,
      lockedByName: options.actor.name,
      snapshot: options.snapshot as unknown as Prisma.InputJsonValue,
    },
  });
  return toLockState(row);
}

export async function unlockInternalPayrollPeriod(options: {
  companyId: string;
  year: number;
  month: number;
  actor: InternalPayrollActor;
  reason: string;
}): Promise<InternalPayrollLockState> {
  const now = new Date();
  const row = await prisma.internalPayrollLock.upsert({
    where: {
      companyId_year_month: {
        companyId: options.companyId,
        year: options.year,
        month: options.month,
      },
    },
    update: {
      locked: false,
      unlockedAt: now,
      unlockedById: options.actor.id,
      unlockedByName: options.actor.name,
      unlockReason: options.reason,
    },
    create: {
      companyId: options.companyId,
      year: options.year,
      month: options.month,
      locked: false,
      unlockedAt: now,
      unlockedById: options.actor.id,
      unlockedByName: options.actor.name,
      unlockReason: options.reason,
    },
  });
  return toLockState(row);
}
