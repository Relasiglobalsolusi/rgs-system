import type { Prisma, PrismaClient } from "@prisma/client";

import { parseTimeToMinutes } from "@/lib/operating-hours";

/** Named-shift jobs keep 1–4 shifts. One-time jobs store 0. */
export const MIN_PROJECT_SHIFTS = 1;
export const MAX_PROJECT_SHIFTS = 4;
export const DEFAULT_NEW_PROJECT_SHIFTS = 2;
/** First named shift starts at 07:00; each shift is 9 hours. */
const FIRST_SHIFT_START_MINUTES = 7 * 60;
const SHIFT_LENGTH_MINUTES = 9 * 60;
const MINUTES_PER_DAY = 24 * 60;

export type ProjectShiftWindow = {
  number: number;
  startTime: string;
  endTime: string;
};

type ShiftDb = PrismaClient | Prisma.TransactionClient;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function minutesToHm(total: number) {
  const normalized = ((total % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${pad2(hours)}:${pad2(minutes)}`;
}

export function defaultShiftWindows(count: number): ProjectShiftWindow[] {
  const n = Math.min(MAX_PROJECT_SHIFTS, Math.max(MIN_PROJECT_SHIFTS, count));
  const windows: ProjectShiftWindow[] = [];
  for (let index = 0; index < n; index += 1) {
    const start = FIRST_SHIFT_START_MINUTES + index * SHIFT_LENGTH_MINUTES;
    windows.push({
      number: index + 1,
      startTime: minutesToHm(start),
      endTime: minutesToHm(start + SHIFT_LENGTH_MINUTES),
    });
  }
  return windows;
}

export function parseShiftCount(
  raw: FormDataEntryValue | null,
  fallback = DEFAULT_NEW_PROJECT_SHIFTS
): number {
  const text = String(raw ?? "").trim();
  const value = text ? Number(text) : fallback;
  if (!Number.isInteger(value) || value < 0 || value > MAX_PROJECT_SHIFTS) {
    throw new Error("Choose how many shifts this project runs (0 to 4).");
  }
  return value;
}

export function parseOptionalNamedShiftCount(
  raw: FormDataEntryValue | null,
  usesNamedShifts: boolean,
  fallback = DEFAULT_NEW_PROJECT_SHIFTS
): number {
  if (!usesNamedShifts) return 0;
  const count = parseShiftCount(raw, fallback);
  if (count < MIN_PROJECT_SHIFTS) {
    throw new Error("Choose how many shifts this project runs (1 to 4).");
  }
  return count;
}

export function parseShiftTime(raw: FormDataEntryValue | string | null): string {
  const text = String(raw ?? "").trim();
  const match = text.match(/^(\d{2}):(\d{2})/);
  if (!match) {
    throw new Error("Shift times must use HH:mm format.");
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error("Shift times must use HH:mm format.");
  }
  return `${match[1]}:${match[2]}`;
}

export function parseShiftWindowsFromForm(
  formData: FormData,
  count: number
): ProjectShiftWindow[] {
  const windows: ProjectShiftWindow[] = [];
  for (let number = 1; number <= count; number += 1) {
    windows.push({
      number,
      startTime: parseShiftTime(formData.get(`shiftStart.${number}`)),
      endTime: parseShiftTime(formData.get(`shiftEnd.${number}`)),
    });
  }
  return windows;
}

export function mergeShiftWindows(
  count: number,
  current: ProjectShiftWindow[] = []
): ProjectShiftWindow[] {
  const defaults = defaultShiftWindows(count);
  return defaults.map((window) => {
    const existing = current.find((row) => row.number === window.number);
    return existing ?? window;
  });
}

export type ProjectShiftClash = {
  a: ProjectShiftWindow;
  b: ProjectShiftWindow;
};

/** Half-open [start, end) segments so 07:00–16:00 and 16:00–01:00 do not clash. */
function shiftTimeSegments(
  startTime: string,
  endTime: string
): Array<[number, number]> {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) return [];
  if (start === end) return [[0, MINUTES_PER_DAY]];
  if (end > start) return [[start, end]];
  return [
    [start, MINUTES_PER_DAY],
    [0, end],
  ];
}

function segmentsOverlap(
  left: [number, number],
  right: [number, number]
): boolean {
  return left[0] < right[1] && right[0] < left[1];
}

export function findProjectShiftClash(
  windows: ProjectShiftWindow[]
): ProjectShiftClash | null {
  for (let i = 0; i < windows.length; i += 1) {
    const a = windows[i]!;
    const aSegments = shiftTimeSegments(a.startTime, a.endTime);
    if (aSegments.length === 0) continue;
    for (let j = i + 1; j < windows.length; j += 1) {
      const b = windows[j]!;
      const bSegments = shiftTimeSegments(b.startTime, b.endTime);
      if (
        bSegments.some((right) =>
          aSegments.some((left) => segmentsOverlap(left, right))
        )
      ) {
        return { a, b };
      }
    }
  }
  return null;
}

export function formatProjectShiftClashMessage(clash: ProjectShiftClash): string {
  return `Shift ${clash.a.number} (${clash.a.startTime}–${clash.a.endTime}) clashes with Shift ${clash.b.number} (${clash.b.startTime}–${clash.b.endTime}). Shifts cannot overlap. Change the hours so one ends before the next starts.`;
}

export function assertProjectShiftsDoNotClash(windows: ProjectShiftWindow[]) {
  const clash = findProjectShiftClash(windows);
  if (clash) {
    throw new Error(formatProjectShiftClashMessage(clash));
  }
}

export function formatProjectShiftLabel(options: {
  number: number;
  startTime?: string | null;
  endTime?: string | null;
}) {
  if (options.startTime && options.endTime) {
    return `Shift ${options.number} · ${options.startTime}–${options.endTime}`;
  }
  return `Shift ${options.number}`;
}

export async function syncProjectShifts(
  db: ShiftDb,
  projectId: string,
  shiftCount: number,
  windows?: ProjectShiftWindow[]
) {
  const count = parseShiftCount(String(shiftCount), shiftCount);
  if (count === 0) {
    const existing = await db.projectShift.findMany({
      where: { projectId },
      select: {
        id: true,
        number: true,
        _count: {
          select: { assignments: true, coveringDoubleShifts: true },
        },
      },
    });
    const blocked = existing.find(
      (row) =>
        row._count.assignments > 0 || row._count.coveringDoubleShifts > 0
    );
    if (blocked) {
      throw new Error(
        `Unassign staff and double shifts from Shift ${blocked.number} before removing shifts.`
      );
    }
    if (existing.length > 0) {
      await db.projectShift.deleteMany({
        where: { id: { in: existing.map((row) => row.id) } },
      });
    }
    await db.project.update({
      where: { id: projectId },
      data: { shiftCount: 0 },
    });
    return;
  }
  const existing = await db.projectShift.findMany({
    where: { projectId },
    select: {
      id: true,
      number: true,
      _count: {
        select: { assignments: true, coveringDoubleShifts: true },
      },
    },
    orderBy: { number: "asc" },
  });

  const extras = existing.filter((row) => row.number > count);
  const blocked = extras.find(
    (row) =>
      row._count.assignments > 0 || row._count.coveringDoubleShifts > 0
  );
  if (blocked) {
    throw new Error(
      `Unassign staff and double shifts from Shift ${blocked.number} before reducing the number of shifts.`
    );
  }

  if (extras.length > 0) {
    await db.projectShift.deleteMany({
      where: { id: { in: extras.map((row) => row.id) } },
    });
  }

  const remainingNumbers = new Set(
    existing.filter((row) => row.number <= count).map((row) => row.number)
  );
  const templates = mergeShiftWindows(count, windows);
  if (windows) {
    assertProjectShiftsDoNotClash(templates);
  }
  const missing = templates.filter(
    (window) => !remainingNumbers.has(window.number)
  );
  if (missing.length > 0) {
    await db.projectShift.createMany({
      data: missing.map((window) => ({
        projectId,
        number: window.number,
        startTime: window.startTime,
        endTime: window.endTime,
      })),
    });
  }

  if (windows) {
    for (const window of templates) {
      await db.projectShift.update({
        where: {
          projectId_number: { projectId, number: window.number },
        },
        data: {
          startTime: window.startTime,
          endTime: window.endTime,
        },
      });
      await db.projectAssignment.updateMany({
        where: { projectId, shift: { number: window.number } },
        data: {
          shiftStart: window.startTime,
          shiftEnd: window.endTime,
        },
      });
    }
  }

  await db.project.update({
    where: { id: projectId },
    data: { shiftCount: count },
  });
}

export async function removeNamedProjectShift(
  db: ShiftDb,
  projectId: string,
  shiftId: string
) {
  const existing = await db.projectShift.findMany({
    where: { projectId },
    select: {
      id: true,
      number: true,
      _count: {
        select: { assignments: true, coveringDoubleShifts: true },
      },
    },
    orderBy: { number: "asc" },
  });
  if (existing.length <= MIN_PROJECT_SHIFTS) {
    throw new Error("This project must keep at least one named shift.");
  }

  const target = existing.find((row) => row.id === shiftId);
  if (!target) throw new Error("Shift not found.");
  if (target._count.assignments > 0 || target._count.coveringDoubleShifts > 0) {
    throw new Error(
      `Unassign staff, backups, and double shifts from Shift ${target.number} before removing it.`
    );
  }

  await db.projectShift.delete({ where: { id: target.id } });

  const remaining = existing.filter((row) => row.id !== target.id);
  for (let index = 0; index < remaining.length; index += 1) {
    await db.projectShift.update({
      where: { id: remaining[index]!.id },
      data: { number: 1000 + index },
    });
  }
  for (let index = 0; index < remaining.length; index += 1) {
    await db.projectShift.update({
      where: { id: remaining[index]!.id },
      data: { number: index + 1 },
    });
  }

  await db.project.update({
    where: { id: projectId },
    data: { shiftCount: remaining.length },
  });
}

export async function addNamedProjectShift(
  db: ShiftDb,
  projectId: string,
  times?: { startTime: string; endTime: string }
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { shiftCount: true },
  });
  if (!project) throw new Error("Project not found.");

  const existing = await db.projectShift.findMany({
    where: { projectId },
    select: { number: true, startTime: true, endTime: true },
    orderBy: { number: "asc" },
  });
  const currentCount = Math.max(project.shiftCount || 0, existing.length);
  if (currentCount >= MAX_PROJECT_SHIFTS) {
    throw new Error("This project already has 4 shifts.");
  }
  if (currentCount <= 0) {
    await syncProjectShifts(
      db,
      projectId,
      1,
      times
        ? [{ number: 1, startTime: times.startTime, endTime: times.endTime }]
        : undefined
    );
    return;
  }
  const nextCount = currentCount + 1;
  const currentWindows =
    existing.length > 0
      ? existing.map((row) => ({
          number: row.number,
          startTime: row.startTime,
          endTime: row.endTime,
        }))
      : defaultShiftWindows(Math.max(currentCount, 1));
  const kept = mergeShiftWindows(
    Math.max(currentCount, currentWindows.length),
    currentWindows
  ).filter((window) => window.number <= Math.max(currentCount, 1));
  const nextDefault = defaultShiftWindows(nextCount).find(
    (window) => window.number === nextCount
  );
  if (!nextDefault) {
    throw new Error("This project already has 4 shifts.");
  }
  const nextWindows = [
    ...kept,
    {
      number: nextCount,
      startTime: times?.startTime ?? nextDefault.startTime,
      endTime: times?.endTime ?? nextDefault.endTime,
    },
  ];
  assertProjectShiftsDoNotClash(nextWindows);
  await syncProjectShifts(db, projectId, nextCount, nextWindows);
}

export async function applyAssignmentToShift(
  db: ShiftDb,
  options: {
    assignmentId: string;
    shiftId: string | null;
  }
) {
  if (!options.shiftId) {
    await db.projectAssignment.update({
      where: { id: options.assignmentId },
      data: { shiftId: null, shiftStart: null, shiftEnd: null },
    });
    return;
  }

  const shift = await db.projectShift.findUnique({
    where: { id: options.shiftId },
    select: { id: true, startTime: true, endTime: true },
  });
  if (!shift) throw new Error("Shift not found.");

  await db.projectAssignment.update({
    where: { id: options.assignmentId },
    data: {
      shiftId: shift.id,
      shiftStart: shift.startTime,
      shiftEnd: shift.endTime,
    },
  });
}

export async function saveProjectShiftTimes(
  db: ShiftDb,
  options: {
    shiftId: string;
    startTime: string;
    endTime: string;
  }
) {
  const current = await db.projectShift.findUnique({
    where: { id: options.shiftId },
    select: { id: true, projectId: true, number: true },
  });
  if (!current) throw new Error("Shift not found.");

  const siblings = await db.projectShift.findMany({
    where: { projectId: current.projectId },
    select: { id: true, number: true, startTime: true, endTime: true },
    orderBy: { number: "asc" },
  });
  assertProjectShiftsDoNotClash(
    siblings.map((row) =>
      row.id === current.id
        ? {
            number: row.number,
            startTime: options.startTime,
            endTime: options.endTime,
          }
        : {
            number: row.number,
            startTime: row.startTime,
            endTime: row.endTime,
          }
    )
  );

  await db.projectShift.update({
    where: { id: options.shiftId },
    data: {
      startTime: options.startTime,
      endTime: options.endTime,
    },
  });
  await db.projectAssignment.updateMany({
    where: { shiftId: options.shiftId },
    data: {
      shiftStart: options.startTime,
      shiftEnd: options.endTime,
    },
  });
}
