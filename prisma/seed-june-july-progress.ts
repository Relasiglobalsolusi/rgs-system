/**
 * DEMO ONLY — June + July 2026 CICO + Progress Report volume.
 *
 * Product rule stays locked: download months follow the project start date.
 * If a real project starts in August, June–July are out of range. Correct.
 * This script only fakes a June start on Ftl Kebon Sirih so you can review
 * closed-month downloads. When asked to wipe demo data, restore:
 *   - delete June–July attendance / progress on the seeded projects
 *   - restore FTL status + start date
 *   - remove extra staff assigned only by this seed
 *   - delete this file
 *
 * Pay model: 9h = 1×, 18h double = 2×. No overtime.
 *
 * Usage: npx tsx prisma/seed-june-july-progress.ts
 */
import {
  PrismaClient,
  ProgressReportStatus,
  ProjectStatus,
} from "@prisma/client";
import { copyFile, mkdir } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

const PHOTO_SOURCES = [
  "public/brand/rgs-one-logo.png",
  "public/brand/rgs-logo.png",
  "public/brand/rgs-letterhead-logo.png",
] as const;

const STAGES = [
  "Lobby",
  "Pantry",
  "Restrooms",
  "Lift Lobby",
  "Office Floors",
  "Parking Entrance",
  "Glass And Facade",
  "Meeting Rooms",
  "Prayer Room",
  "Loading Dock",
  "Corridor",
  "Reception",
] as const;

const NOTES = [
  "Daily regular clean complete.",
  "Floors mopped and bins emptied.",
  "Glass wiped. Dust on high ledges next week.",
  "Restrooms restocked. One dispenser jammed, reported.",
  "Pantry wiped down after lunch rush.",
  "Lift lobby polished. Tile grout still marked.",
  "Meeting rooms reset. One water stain on the teak table.",
  "Parking entrance swept. Leaves after last night rain.",
  "Corridor vacuumed. Corner cobwebs cleared.",
  "Reception desk and sofa wiped.",
] as const;

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Asia/Jakarta (UTC+7) wall clock → Date. */
function wib(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
) {
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
}

function ymd(year: number, month: number, day: number) {
  return `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

function jitter(random: () => number, span: number) {
  return Math.floor(random() * (span + 1));
}

function workdays(year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days: number[] = [];
  for (let day = 1; day <= last; day += 1) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday !== 0) days.push(day);
  }
  return days;
}

function parseHHmm(value: string | null | undefined): {
  hour: number;
  minute: number;
} {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value?.trim() ?? "");
  if (!match) return { hour: 7, minute: 0 };
  return {
    hour: Math.min(23, Number(match[1])),
    minute: Math.min(59, Number(match[2])),
  };
}

function addHours(hour: number, minute: number, hours: number) {
  const total = hour * 60 + minute + hours * 60;
  return { hour: Math.floor(total / 60) % 24, minute: total % 60 };
}

async function ensurePhotos(): Promise<string[]> {
  const destDir = path.join(process.cwd(), "public", "uploads", "progress-demo");
  await mkdir(destDir, { recursive: true });
  const urls: string[] = [];
  for (const source of PHOTO_SOURCES) {
    const filename = path.basename(source);
    await copyFile(path.join(process.cwd(), source), path.join(destDir, filename));
    urls.push(`/uploads/progress-demo/${filename}`);
  }
  return urls;
}

async function main() {
  const photos = await ensurePhotos();
  const june1 = utcDate(2026, 6, 1);
  const july31 = utcDate(2026, 7, 31);

  const ftl = await prisma.project.findFirst({
    where: { name: { contains: "Ftl", mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      status: true,
      clientId: true,
      startDate: true,
    },
  });

  if (ftl) {
    await prisma.project.update({
      where: { id: ftl.id },
      data: {
        status: ProjectStatus.IN_PROGRESS,
        // Demo exception only — real projects keep their true start date.
        startDate: june1,
      },
    });
    console.log(
      `DEMO: ${ftl.name} In Progress with start 1 June 2026 so closed-month downloads work. Restore the real start date when demo data is deleted.`
    );
  }

  const projects = await prisma.project.findMany({
    where: {
      status: { in: [ProjectStatus.IN_PROGRESS, ProjectStatus.WAITING_FOR_APPROVAL] },
      subCategory: {
        in: [
          "REGULAR_CLEANING",
          "GENERAL_CLEANING",
          "FACADE_CLEANING",
          "CONTRACT_GENERAL_CLEANING",
          "CONTRACT_FACADE_CLEANING",
          "REGULAR_LANDSCAPING",
          "ONE_TIME_LANDSCAPING",
          "SECURITY",
          "ONE_TIME_SECURITY",
        ],
      },
    },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      assignments: {
        where: { isBackup: false },
        select: {
          employeeId: true,
          shiftStart: true,
          shiftEnd: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              status: true,
              archivedFromDirectory: true,
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  if (projects.length === 0) {
    throw new Error("No In Progress progress-eligible projects found.");
  }

  const extraStaff = await prisma.employee.findMany({
    where: {
      status: "ACTIVE",
      archivedFromDirectory: false,
      firstName: { not: "Vicko" },
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 40,
  });

  const months: Array<{ year: number; month: number }> = [
    { year: 2026, month: 6 },
    { year: 2026, month: 7 },
  ];

  let attendanceCount = 0;
  let reportCount = 0;
  let photoCount = 0;

  for (const project of projects) {
    let staff = project.assignments
      .filter(
        (row) =>
          row.employee.status === "ACTIVE" && !row.employee.archivedFromDirectory
      )
      .map((row) => ({
        employeeId: row.employeeId,
        firstName: row.employee.firstName,
        lastName: row.employee.lastName,
        shiftStart: row.shiftStart,
        shiftEnd: row.shiftEnd,
      }));

    if (staff.length === 0) {
      const have = new Set(staff.map((row) => row.employeeId));
      for (const employee of extraStaff) {
        if (have.has(employee.id)) continue;
        await prisma.projectAssignment.upsert({
          where: {
            projectId_employeeId: {
              projectId: project.id,
              employeeId: employee.id,
            },
          },
          update: {},
          create: {
            projectId: project.id,
            employeeId: employee.id,
            shiftStart: "07:00",
            shiftEnd: "16:00",
          },
        });
        staff.push({
          employeeId: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          shiftStart: "07:00",
          shiftEnd: "16:00",
        });
        have.add(employee.id);
        if (staff.length >= 5) break;
      }
    }

    if (staff.length === 0) {
      console.log(`Skip ${project.name}: no staff`);
      continue;
    }

    await prisma.progressReport.deleteMany({
      where: {
        projectId: project.id,
        reportDate: { gte: june1, lte: july31 },
      },
    });
    await prisma.attendance.deleteMany({
      where: {
        projectId: project.id,
        date: { gte: june1, lte: july31 },
      },
    });

    const lat = project.latitude ?? -6.2088;
    const lng = project.longitude ?? 106.8456;
    const attendanceRows = [];
    const reportRows = [];
    const photoRows: Array<{
      progressReportId: string;
      url: string;
      caption: string;
      createdAt: Date;
    }> = [];

    for (const { year, month } of months) {
      for (const day of workdays(year, month)) {
        for (const person of staff) {
          const key = `${project.id}:${person.employeeId}:${ymd(year, month, day)}`;
          const random = rng(key);
          const roll = random();

          if (roll < 0.08) continue;

          const start = parseHHmm(person.shiftStart);
          const isDouble = roll > 0.94;
          const isLate = !isDouble && roll > 0.78;
          const isEarly = !isDouble && !isLate && roll > 0.62;
          const forgotOut = !isDouble && roll > 0.96;

          const inMinute = isLate
            ? start.minute + 20 + jitter(random, 40)
            : start.minute - 8 + jitter(random, 12);
          const checkIn = wib(year, month, day, start.hour, inMinute);

          let checkOut: Date | null = null;
          if (!forgotOut) {
            if (isDouble) {
              checkOut = wib(year, month, day, 23, jitter(random, 10));
            } else if (isEarly) {
              const early = addHours(start.hour, start.minute, 6);
              checkOut = wib(
                year,
                month,
                day,
                early.hour,
                early.minute + jitter(random, 20)
              );
            } else {
              const end = addHours(start.hour, start.minute, 9);
              checkOut = wib(
                year,
                month,
                day,
                end.hour,
                end.minute - 5 + jitter(random, 15)
              );
            }
          }

          attendanceRows.push({
            employeeId: person.employeeId,
            projectId: project.id,
            date: utcDate(year, month, day),
            checkIn,
            checkOut,
            note: isDouble
              ? "Double shift — 18 hours = 2× daily rate"
              : isEarly
                ? "Left before shift end"
                : null,
            checkInLat: lat + (random() - 0.5) * 0.001,
            checkInLng: lng + (random() - 0.5) * 0.001,
            checkOutLat: checkOut ? lat + (random() - 0.5) * 0.001 : null,
            checkOutLng: checkOut ? lng + (random() - 0.5) * 0.001 : null,
            checkInDistanceMeters: 8 + jitter(random, 24),
            checkOutDistanceMeters: checkOut ? 10 + jitter(random, 20) : null,
            checkInPhotoUrl: pick(random, photos),
            checkOutPhotoUrl: checkOut ? pick(random, photos) : null,
            lateCheckIn: isLate,
            earlyCheckOut: isEarly,
            createdAt: checkIn,
            updatedAt: checkOut ?? checkIn,
          });

          const reportTotal = isDouble ? 3 : 1 + (random() > 0.55 ? 1 : 0);
          for (let index = 0; index < reportTotal; index += 1) {
            const reportId = `demo-jj-${project.id.slice(-8)}-${person.employeeId.slice(-8)}-${ymd(year, month, day)}-${index + 1}`;
            const createdAt = wib(
              year,
              month,
              day,
              10 + index * 3,
              jitter(random, 40)
            );
            reportRows.push({
              id: reportId,
              projectId: project.id,
              employeeId: person.employeeId,
              reportDate: utcDate(year, month, day),
              stageLabel: pick(random, STAGES),
              notes: pick(random, NOTES),
              status: ProgressReportStatus.SUBMITTED,
              createdAt,
              updatedAt: createdAt,
            });

            const photoTotal = 1 + jitter(random, 2);
            for (let photoIndex = 0; photoIndex < photoTotal; photoIndex += 1) {
              photoRows.push({
                progressReportId: reportId,
                url: pick(random, photos),
                caption: pick(random, STAGES),
                createdAt,
              });
            }
          }
        }
      }
    }

    const chunk = 400;
    for (let i = 0; i < attendanceRows.length; i += chunk) {
      await prisma.attendance.createMany({
        data: attendanceRows.slice(i, i + chunk),
      });
    }
    for (let i = 0; i < reportRows.length; i += chunk) {
      await prisma.progressReport.createMany({
        data: reportRows.slice(i, i + chunk),
      });
    }
    for (let i = 0; i < photoRows.length; i += chunk) {
      await prisma.progressReportPhoto.createMany({
        data: photoRows.slice(i, i + chunk),
      });
    }

    attendanceCount += attendanceRows.length;
    reportCount += reportRows.length;
    photoCount += photoRows.length;
    console.log(
      `${project.name}: ${staff.length} staff, ${attendanceRows.length} CICO, ${reportRows.length} reports`
    );
  }

  console.log(
    `Done. ${attendanceCount} attendance, ${reportCount} progress reports, ${photoCount} photos across June–July 2026.`
  );
  console.log(
    "DEMO ONLY. Open Progress Report → a client → a project, then pick a June or July date."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
