import { prisma } from "@/lib/prisma";
import { formatDisplayDate } from "@/lib/format-date";

/** Only surface approvals reviewed within this window (avoids flooding on first deploy). */
const RECENT_APPROVAL_DAYS = 30;

export type LeaveApprovedNotificationItem = {
  id: string;
  type: "PERMISSION" | "SICK";
  startDateLabel: string;
  endDateLabel: string;
  dateRangeLabel: string;
  reviewedAtLabel: string;
};

/**
 * Approved leave requests for this employee that the signed-in user has not
 * dismissed on the staff dashboard.
 */
export async function getUnackedApprovedLeavesForEmployee(
  employeeId: string,
  userId: string
): Promise<LeaveApprovedNotificationItem[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - RECENT_APPROVAL_DAYS);

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      status: "APPROVED",
      reviewedAt: { gte: since },
    },
    orderBy: { reviewedAt: "desc" },
    take: 10,
    select: {
      id: true,
      type: true,
      startDate: true,
      endDate: true,
      reviewedAt: true,
    },
  });

  if (leaves.length === 0) return [];

  const acks = await prisma.leaveApprovalAck.findMany({
    where: {
      userId,
      leaveRequestId: { in: leaves.map((leave) => leave.id) },
    },
    select: { leaveRequestId: true },
  });
  const ackedIds = new Set(acks.map((ack) => ack.leaveRequestId));

  return leaves
    .filter((leave) => !ackedIds.has(leave.id))
    .map((leave) => {
      const startDateLabel = formatDisplayDate(leave.startDate);
      const endDateLabel = formatDisplayDate(leave.endDate);
      const sameDay = startDateLabel === endDateLabel;

      return {
        id: leave.id,
        type: leave.type,
        startDateLabel,
        endDateLabel,
        dateRangeLabel: sameDay
          ? startDateLabel
          : `${startDateLabel} – ${endDateLabel}`,
        reviewedAtLabel: leave.reviewedAt
          ? formatDisplayDate(leave.reviewedAt)
          : "",
      };
    });
}
