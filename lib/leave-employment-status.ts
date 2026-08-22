import type { Prisma } from "@prisma/client";

import { findOpenCicoAttendance } from "@/lib/cico-attendance";
import { parseDateInput } from "@/lib/invoice-period";
import { formatAppDateInput } from "@/lib/progress-report-compliance";
import { prisma } from "@/lib/prisma";

export type LeaveEmploymentDb = Pick<
  Prisma.TransactionClient,
  "employee" | "leaveRequest" | "projectAssignment"
>;

const LEAVE_DRIVEN_STATUSES = new Set(["ACTIVE", "ON_LEAVE", "LEAVE_PENDING"]);

/** Calendar today in Asia/Jakarta as UTC date-only (matches leave date storage). */
export function jakartaTodayAsUtcDateOnly(referenceDate: Date = new Date()): Date {
  return parseDateInput(formatAppDateInput(referenceDate));
}

/** Approved leave whose period includes today (inclusive start/end, Asia/Jakarta). */
async function hasActiveApprovedLeavePeriod(
  db: LeaveEmploymentDb,
  employeeId: string,
  referenceDate: Date = new Date()
): Promise<boolean> {
  const today = jakartaTodayAsUtcDateOnly(referenceDate);
  const count = await db.leaveRequest.count({
    where: {
      employeeId,
      status: "APPROVED",
      startDate: { lte: today },
      endDate: { gte: today },
    },
  });
  return count > 0;
}

/**
 * Leave-driven employment status (Asia/Jakarta day boundary):
 * 1. Approved leave covers today AND no open CICO → ON_LEAVE.
 *    Assignments and team membership stay. Cover is backup / double shift.
 * 2. Approved leave covers today BUT open CICO (mid-shift / overnight) → stay ACTIVE
 *    until check-out; leave takes effect only after the open attendance closes.
 * 3. Else roster staff (ACTIVE / ON_LEAVE / legacy LEAVE_PENDING) → ACTIVE.
 *    Placement is unchanged (still On Project / Head Office).
 * Pending leave requests do not change employment status or block ops.
 * On Leave is not set manually in Employee Edit.
 */
export async function syncEmployeeLeaveEmploymentStatus(
  db: LeaveEmploymentDb,
  employeeId: string,
  referenceDate: Date = new Date()
) {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { status: true, placement: true },
  });
  if (!employee) return;

  if (!LEAVE_DRIVEN_STATUSES.has(employee.status)) return;

  const onLeaveForPeriod = await hasActiveApprovedLeavePeriod(
    db,
    employeeId,
    referenceDate
  );

  let targetStatus: "ON_LEAVE" | "ACTIVE" = onLeaveForPeriod
    ? "ON_LEAVE"
    : "ACTIVE";

  // Defer ON_LEAVE while still checked in (overnight-aware open attendance).
  if (targetStatus === "ON_LEAVE") {
    const open = await findOpenCicoAttendance(employeeId, referenceDate);
    if (open?.record?.checkIn && !open.record.checkOut) {
      targetStatus = "ACTIVE";
    }
  }

  if (employee.status !== targetStatus) {
    await db.employee.update({
      where: { id: employeeId },
      data: { status: targetStatus },
    });
  }
}

/** Sync leave-driven status for many employees (assignment / admin paths). */
export async function syncEmployeesLeaveEmploymentStatus(
  db: LeaveEmploymentDb,
  employeeIds: string[],
  referenceDate: Date = new Date()
) {
  const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
  for (const employeeId of uniqueIds) {
    await syncEmployeeLeaveEmploymentStatus(db, employeeId, referenceDate);
  }
}

/** Self-service ops (CICO, progress, leave requests) require ACTIVE — not ON_LEAVE. Legacy LEAVE_PENDING is treated as ACTIVE. */
export function isEmployeeActiveForOperations(status: string): boolean {
  return status === "ACTIVE" || status === "LEAVE_PENDING";
}

export function getOperationsBlockedErrorKey(
  status: string
): "onLeaveBlocked" | "activeOnly" {
  if (status === "ON_LEAVE") return "onLeaveBlocked";
  return "activeOnly";
}

/** Sync leave-driven status for a linked employee; returns refreshed row or null. */
export async function ensureLeaveEmploymentSyncedForUser(userId: string) {
  if (!userId) return null;

  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!employee) return null;
  if (!LEAVE_DRIVEN_STATUSES.has(employee.status)) {
    return prisma.employee.findUnique({ where: { userId } });
  }

  await syncEmployeeLeaveEmploymentStatus(prisma, employee.id);
  return prisma.employee.findUnique({ where: { userId } });
}

/** Sync employment status from approved leave periods (page-load hook). */
export async function refreshLeaveEmploymentForUser(userId: string) {
  await ensureLeaveEmploymentSyncedForUser(userId);
}
