import { prisma } from "@/lib/prisma";
import {
  addUtcDays,
  formatDateInput,
  parseDateInput,
  toUtcDateOnly,
} from "@/lib/invoice-period";
import { resolveCicoWorkDay } from "@/lib/cico-work-day";
import { formatAppDateInput } from "@/lib/progress-report-compliance";

type ShiftSelect = {
  shiftStart: string | null;
  shiftEnd: string | null;
};

/**
 * Open CICO attendance for the current Asia/Jakarta work day, including
 * overnight shifts whose post-midnight hours still belong to yesterday's key.
 */
export async function findOpenCicoAttendance(
  employeeId: string,
  now: Date = new Date()
) {
  const today = parseDateInput(formatAppDateInput(now));
  const yesterday = addUtcDays(today, -1);

  const records = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: { in: [today, yesterday] },
      checkIn: { not: null },
      checkOut: null,
    },
    include: { project: true },
    orderBy: { date: "desc" },
  });

  for (const record of records) {
    if (!record.projectId) continue;
    const assignment = await prisma.projectAssignment.findFirst({
      where: { employeeId, projectId: record.projectId },
      select: { shiftStart: true, shiftEnd: true },
    });
    const workDay = resolveCicoWorkDay(
      assignment?.shiftStart,
      assignment?.shiftEnd,
      now
    );
    if (toUtcDateOnly(record.date).getTime() === workDay.getTime()) {
      return { record, assignment };
    }
  }

  if (records[0]) {
    const assignment = records[0].projectId
      ? await prisma.projectAssignment.findFirst({
          where: { employeeId, projectId: records[0].projectId },
          select: { shiftStart: true, shiftEnd: true },
        })
      : null;
    return { record: records[0], assignment: assignment as ShiftSelect | null };
  }

  return null;
}

/** Open check-in for this project × work day (checkout / progress gate). */
export async function hasOpenCicoForProjectWorkDay(
  employeeId: string,
  projectId: string,
  workDay: Date,
  now: Date = new Date()
): Promise<boolean> {
  const open = await findOpenCicoAttendance(employeeId, now);
  if (!open?.record?.checkIn || open.record.checkOut) return false;
  if (open.record.projectId !== projectId) return false;
  return toUtcDateOnly(open.record.date).getTime() === toUtcDateOnly(workDay).getTime();
}

/**
 * Today's CICO card attendance: prefer the record whose work-day key matches
 * the assignment shift window (overnight-aware), else open, else calendar today.
 */
export async function getCicoWorkAttendance(
  employeeId: string,
  now: Date = new Date()
) {
  const today = parseDateInput(formatAppDateInput(now));
  const yesterday = addUtcDays(today, -1);

  const records = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: { in: [today, yesterday] },
    },
    include: {
      project: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });

  for (const record of records) {
    if (!record.projectId) continue;
    const assignment = await prisma.projectAssignment.findFirst({
      where: { employeeId, projectId: record.projectId },
      select: { shiftStart: true, shiftEnd: true },
    });
    const workDay = resolveCicoWorkDay(
      assignment?.shiftStart,
      assignment?.shiftEnd,
      now
    );
    if (toUtcDateOnly(record.date).getTime() === workDay.getTime()) {
      return record;
    }
  }

  const open = records.find((r) => r.checkIn && !r.checkOut);
  if (open) return open;
  return (
    records.find(
      (r) => formatDateInput(toUtcDateOnly(r.date)) === formatDateInput(today)
    ) ?? null
  );
}
