/**
 * Demo data: CICO + progress reports for Ftl Kebon Sirih — August 2026.
 *
 * Usage: npx tsx scripts/seed-ftl-kebon-sirih-demo.ts
 *
 * Idempotent for this project/month — deletes prior August 2026 demo rows for
 * Ftl Kebon Sirih, then recreates attendance, progress reports, and photos.
 */
import { copyFile, mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  EmploymentStatus,
  EmploymentType,
  EmployeeType,
  Placement,
  PrismaClient,
  ProjectStatus,
} from "@prisma/client";
import { haversineDistanceMeters } from "../lib/geo";
import {
  contractCyclePeriodBounds,
  resolveContractCycleIndex,
  toUtcDateOnly,
} from "../lib/invoice-period";
import { nextSortOrderFromMax } from "../lib/reorder";

const prisma = new PrismaClient();

const DEMO_TAG = "demo-ftl-kebon-sirih-aug2026";
const DEMO_PHOTO_PREFIX = "demo-ftl-kebon-sirih-aug2026";
const YEAR = 2026;
const MONTH = 8;
/** Jakarta calendar days in August 2026 (from estimated start onward). */
const SEED_DAY_NUMBERS = [12, 13, 14, 15, 18, 19, 20, 22];

type NoteTemplate = {
  notes: string;
  caption: string;
  stageLabel: string;
};

const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    notes:
      "Lobby and reception area mopped; glass doors wiped. Kebon Sirih entrance mats shaken and replaced.",
    caption: "Main lobby",
    stageLabel: "Daily Routine",
  },
  {
    notes:
      "Restrooms on floors 2–4 sanitized and restocked. Hand dryers checked; one unit on 3F reset.",
    caption: "Restroom rounds",
    stageLabel: "Sanitation",
  },
  {
    notes:
      "Lift cars vacuumed; control panels disinfected. Landings mopped after morning foot traffic.",
    caption: "Lift bank",
    stageLabel: "Common Areas",
  },
  {
    notes:
      "Pantry and break area degreased; fridge handles wiped. Supplies sufficient through the week.",
    caption: "Pantry service",
    stageLabel: "Pantry",
  },
  {
    notes:
      "Meeting rooms reset after tenant use. Whiteboards cleaned; bins emptied and liners replaced.",
    caption: "Meeting rooms",
    stageLabel: "Tenant Areas",
  },
  {
    notes:
      "Exterior canopy and entrance glass streak-free after rain. Safety cones repositioned near dock.",
    caption: "Main entrance",
    stageLabel: "Entrance",
  },
  {
    notes:
      "Corridor dusting and spot mop on high-traffic paths. Stain near stair B treated and dried.",
    caption: "Corridor pass",
    stageLabel: "Floor Care",
  },
  {
    notes:
      "Loading bay swept; pallet dust cleared. Perimeter walk completed with no hazards reported.",
    caption: "Loading bay",
    stageLabel: "Back of House",
  },
];

type DemoEmployeeSeed = {
  employeeNo: string;
  firstName: string;
  lastName: string;
  employmentType: EmploymentType;
};

const EXTRA_DEMO_STAFF: DemoEmployeeSeed[] = [
  {
    employeeNo: "OPR-003",
    firstName: "Rina",
    lastName: "Wijaya",
    employmentType: EmploymentType.PART_TIME,
  },
  {
    employeeNo: "OPR-004",
    firstName: "Agus",
    lastName: "Pratama",
    employmentType: EmploymentType.FULL_TIME,
  },
];

function jakartaDate(day: number): Date {
  return toUtcDateOnly(new Date(Date.UTC(YEAR, MONTH - 1, day)));
}

function localJakarta(day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(YEAR, MONTH - 1, day, hour - 7, minute, 0));
}

function offsetCoords(
  lat: number,
  lng: number,
  metersNorth: number,
  metersEast: number
) {
  const dLat = metersNorth / 111_320;
  const dLng = metersEast / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

async function ensurePlaceholderImage(
  folder: "cico" | "progress",
  filename: string
): Promise<string> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadDir, { recursive: true });
  const dest = path.join(uploadDir, filename);
  const sourceLogo = path.join(process.cwd(), "public", "brand", "rgs-logo.png");
  try {
    await copyFile(sourceLogo, dest);
  } catch {
    const tinyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    await writeFile(dest, tinyPng);
  }
  return `/uploads/${folder}/${filename}`;
}

async function ensureDemoPhotos(count: number): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const filename = `${DEMO_PHOTO_PREFIX}-${String(i + 1).padStart(2, "0")}.png`;
    urls.push(await ensurePlaceholderImage("progress", filename));
  }
  return urls;
}

async function ensureDemoCicoPhotos(count: number): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const filename = `${DEMO_PHOTO_PREFIX}-cico-${String(i + 1).padStart(2, "0")}.png`;
    urls.push(await ensurePlaceholderImage("cico", filename));
  }
  return urls;
}

function isFieldStaff(employee: {
  employeeNo: string;
  status: EmploymentStatus;
  archivedFromDirectory: boolean;
  employeeType: EmployeeType;
  placement: Placement;
}) {
  return (
    employee.status === EmploymentStatus.ACTIVE &&
    !employee.archivedFromDirectory &&
    !employee.employeeNo.includes("~deleted~") &&
    employee.employeeType !== EmployeeType.HEAD_OFFICE &&
    employee.placement !== Placement.HEAD_OFFICE
  );
}

async function findProject() {
  const project = await prisma.project.findFirst({
    where: {
      OR: [
        { name: { contains: "Kebon Sirih", mode: "insensitive" } },
        { name: { contains: "Ftl Kebon", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      companyId: true,
      status: true,
      billingMode: true,
      latitude: true,
      longitude: true,
      startDate: true,
      estimatedStartDate: true,
      client: { select: { id: true, name: true } },
    },
  });

  if (!project?.clientId || !project.client) {
    throw new Error(
      "Project Ftl Kebon Sirih not found. Import or create the project first."
    );
  }

  if (project.latitude == null || project.longitude == null) {
    throw new Error(
      `${project.name} is missing latitude/longitude — required for CICO distance fields.`
    );
  }

  return project;
}

async function ensureStaffPool(companyId: string) {
  const existing = await prisma.employee.findMany({
    where: {
      companyId,
      status: EmploymentStatus.ACTIVE,
      archivedFromDirectory: false,
      NOT: {
        OR: [
          { employeeType: EmployeeType.HEAD_OFFICE },
          { placement: Placement.HEAD_OFFICE },
          { employeeNo: { contains: "~deleted~" } },
        ],
      },
    },
    orderBy: { employeeNo: "asc" },
  });

  const anchor = existing[0];
  if (!anchor) {
    throw new Error("No active field staff found. Run npm run db:seed first.");
  }

  const staff = [...existing];

  for (const seed of EXTRA_DEMO_STAFF) {
    const found = staff.find((row) => row.employeeNo === seed.employeeNo);
    if (found) continue;

    const created = await prisma.employee.upsert({
      where: { employeeNo: seed.employeeNo },
      update: {
        firstName: seed.firstName,
        lastName: seed.lastName,
        status: EmploymentStatus.ACTIVE,
        archivedFromDirectory: false,
        employeeType: EmployeeType.PROJECT_SITE,
        employmentType: seed.employmentType,
        placement: Placement.AVAILABLE,
        companyId,
        categoryId: anchor.categoryId,
        positionId: anchor.positionId,
        position: anchor.position ?? "Cleaning Staff",
      },
      create: {
        employeeNo: seed.employeeNo,
        firstName: seed.firstName,
        lastName: seed.lastName,
        status: EmploymentStatus.ACTIVE,
        archivedFromDirectory: false,
        employeeType: EmployeeType.PROJECT_SITE,
        employmentType: seed.employmentType,
        placement: Placement.AVAILABLE,
        companyId,
        categoryId: anchor.categoryId,
        positionId: anchor.positionId,
        position: anchor.position ?? "Cleaning Staff",
      },
    });
    staff.push(created);
    console.log(`Ensured demo staff ${created.employeeNo} — ${created.firstName} ${created.lastName}`);
  }

  const selected = staff.filter(isFieldStaff).slice(0, 4);
  if (selected.length < 2) {
    throw new Error("Need at least 2 cleaning-eligible employees.");
  }

  return selected;
}

async function ensureProjectAssignments(
  projectId: string,
  employeeIds: string[]
) {
  for (const employeeId of employeeIds) {
    await prisma.projectAssignment.upsert({
      where: {
        projectId_employeeId: { projectId, employeeId },
      },
      update: {
        shiftStart: "08:00",
        shiftEnd: "17:00",
      },
      create: {
        projectId,
        employeeId,
        shiftStart: "08:00",
        shiftEnd: "17:00",
      },
    });
  }

  await prisma.employee.updateMany({
    where: { id: { in: employeeIds } },
    data: { placement: Placement.ON_PROJECT },
  });
}

async function ensureProjectReady(project: Awaited<ReturnType<typeof findProject>>) {
  const workStart =
    project.startDate ??
    project.estimatedStartDate ??
    jakartaDate(SEED_DAY_NUMBERS[0]!);

  const updates: {
    startDate?: Date;
    status?: ProjectStatus;
  } = {};

  if (!project.startDate && project.estimatedStartDate) {
    updates.startDate = toUtcDateOnly(project.estimatedStartDate);
  } else if (!project.startDate) {
    updates.startDate = workStart;
  }

  if (project.status === ProjectStatus.PLANNED) {
    updates.status = ProjectStatus.IN_PROGRESS;
  }

  if (Object.keys(updates).length > 0) {
    await prisma.project.update({
      where: { id: project.id },
      data: updates,
    });
    console.log(`Updated project for demo preview: ${JSON.stringify(updates)}`);
  }

  return {
    ...project,
    startDate: updates.startDate ?? project.startDate ?? workStart,
    status: updates.status ?? project.status,
  };
}

async function ensureOngoingPeriod(projectId: string, contractStart: Date, reportDate: Date) {
  const cycleIndex = resolveContractCycleIndex(contractStart, reportDate);
  const { periodStart, periodEnd, label } = contractCyclePeriodBounds(
    contractStart,
    cycleIndex
  );

  return prisma.projectInvoicePeriod.upsert({
    where: {
      projectId_periodStart_periodEnd: {
        projectId,
        periodStart,
        periodEnd,
      },
    },
    update: {
      label,
      status: "ONGOING",
    },
    create: {
      projectId,
      periodStart,
      periodEnd,
      label,
      status: "ONGOING",
    },
  });
}

async function clearAugustDemo(projectId: string, employeeIds: string[]) {
  const seedDates = SEED_DAY_NUMBERS.map((day) => jakartaDate(day));
  const rangeStart = seedDates[0]!;
  const rangeEnd = seedDates[seedDates.length - 1]!;

  await prisma.progressReportPhoto.deleteMany({
    where: {
      progressReport: {
        projectId,
        reportDate: { gte: rangeStart, lte: rangeEnd },
        notes: { contains: DEMO_TAG },
      },
    },
  });

  const deletedReports = await prisma.progressReport.deleteMany({
    where: {
      projectId,
      reportDate: { gte: rangeStart, lte: rangeEnd },
      notes: { contains: DEMO_TAG },
    },
  });

  const deletedAttendance = await prisma.attendance.deleteMany({
    where: {
      projectId,
      employeeId: { in: employeeIds },
      date: { in: seedDates },
    },
  });

  if (deletedReports.count > 0 || deletedAttendance.count > 0) {
    console.log(
      `Cleared ${deletedReports.count} progress report(s) and ${deletedAttendance.count} attendance row(s) from prior demo run.`
    );
  }
}

function buildAttendancePlan(
  employeeIndex: number,
  dayIndex: number
): {
  checkInHour: number;
  checkInMinute: number;
  checkOutHour: number | null;
  checkOutMinute: number | null;
  withCheckOutPhoto: boolean;
  inOffset: [number, number];
  outOffset: [number, number] | null;
} {
  const variants = [
    {
      checkInHour: 7,
      checkInMinute: 48,
      checkOutHour: 17,
      checkOutMinute: 5,
      withCheckOutPhoto: true,
      inOffset: [8, -5] as [number, number],
      outOffset: [-6, 10] as [number, number],
    },
    {
      checkInHour: 8,
      checkInMinute: 12,
      checkOutHour: 17,
      checkOutMinute: 8,
      withCheckOutPhoto: false,
      inOffset: [12, 4] as [number, number],
      outOffset: [3, -8] as [number, number],
    },
    {
      checkInHour: 7,
      checkInMinute: 55,
      checkOutHour: null,
      checkOutMinute: null,
      withCheckOutPhoto: false,
      inOffset: [-4, 9] as [number, number],
      outOffset: null,
    },
    {
      checkInHour: 7,
      checkInMinute: 40,
      checkOutHour: 16,
      checkOutMinute: 45,
      withCheckOutPhoto: true,
      inOffset: [5, 5] as [number, number],
      outOffset: [-10, -3] as [number, number],
    },
  ];

  return variants[(employeeIndex + dayIndex) % variants.length]!;
}

async function main() {
  console.log(`Seeding ${DEMO_TAG}…`);

  const project = await ensureProjectReady(await findProject());
  const employees = await ensureStaffPool(project.companyId);
  const employeeIds = employees.map((e) => e.id);

  await ensureProjectAssignments(project.id, employeeIds);
  await clearAugustDemo(project.id, employeeIds);

  const progressPhotoUrls = await ensureDemoPhotos(
    Math.max(SEED_DAY_NUMBERS.length * employees.length, 8)
  );
  const cicoPhotoUrls = await ensureDemoCicoPhotos(
    Math.max(SEED_DAY_NUMBERS.length * employees.length * 2, 12)
  );

  const contractStart = toUtcDateOnly(project.startDate!);
  let photoCursor = 0;
  let cicoPhotoCursor = 0;

  const topSort = await prisma.progressReport.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let nextSort = nextSortOrderFromMax(topSort?.sortOrder);

  let attendanceCount = 0;
  let progressReportCount = 0;
  const seededDays = new Set<string>();

  for (let dayIndex = 0; dayIndex < SEED_DAY_NUMBERS.length; dayIndex += 1) {
    const day = SEED_DAY_NUMBERS[dayIndex]!;
    const reportDate = jakartaDate(day);
    seededDays.add(`${YEAR}-${String(MONTH).padStart(2, "0")}-${String(day).padStart(2, "0")}`);

    let invoicePeriodId: string | null = null;
    if (project.billingMode === "MONTHLY") {
      const period = await ensureOngoingPeriod(
        project.id,
        contractStart,
        reportDate
      );
      invoicePeriodId = period.id;
    }

    for (let employeeIndex = 0; employeeIndex < employees.length; employeeIndex += 1) {
      const employee = employees[employeeIndex]!;
      const attendancePlan = buildAttendancePlan(employeeIndex, dayIndex);

      // Skip some PT slots on alternate days for realism.
      if (
        employee.employmentType === EmploymentType.PART_TIME &&
        dayIndex % 3 === 2
      ) {
        continue;
      }

      const inCoords = offsetCoords(
        project.latitude!,
        project.longitude!,
        attendancePlan.inOffset[0],
        attendancePlan.inOffset[1]
      );
      const outCoords = attendancePlan.outOffset
        ? offsetCoords(
            project.latitude!,
            project.longitude!,
            attendancePlan.outOffset[0],
            attendancePlan.outOffset[1]
          )
        : null;

      const checkIn = localJakarta(
        day,
        attendancePlan.checkInHour,
        attendancePlan.checkInMinute
      );
      const checkOut =
        attendancePlan.checkOutHour != null &&
        attendancePlan.checkOutMinute != null
          ? localJakarta(
              day,
              attendancePlan.checkOutHour,
              attendancePlan.checkOutMinute
            )
          : null;

      const checkInPhotoUrl = cicoPhotoUrls[cicoPhotoCursor % cicoPhotoUrls.length]!;
      cicoPhotoCursor += 1;
      const checkOutPhotoUrl =
        checkOut && attendancePlan.withCheckOutPhoto
          ? cicoPhotoUrls[cicoPhotoCursor % cicoPhotoUrls.length]!
          : null;
      if (checkOutPhotoUrl) cicoPhotoCursor += 1;

      await prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: reportDate,
          },
        },
        update: {
          projectId: project.id,
          checkIn,
          checkOut,
          note: `${DEMO_TAG} attendance`,
          checkInLat: inCoords.lat,
          checkInLng: inCoords.lng,
          checkInDistanceMeters: haversineDistanceMeters(
            inCoords.lat,
            inCoords.lng,
            project.latitude!,
            project.longitude!
          ),
          checkOutLat: outCoords?.lat ?? null,
          checkOutLng: outCoords?.lng ?? null,
          checkOutDistanceMeters: outCoords
            ? haversineDistanceMeters(
                outCoords.lat,
                outCoords.lng,
                project.latitude!,
                project.longitude!
              )
            : null,
          checkInPhotoUrl,
          checkOutPhotoUrl,
        },
        create: {
          employeeId: employee.id,
          projectId: project.id,
          date: reportDate,
          checkIn,
          checkOut,
          note: `${DEMO_TAG} attendance`,
          checkInLat: inCoords.lat,
          checkInLng: inCoords.lng,
          checkInDistanceMeters: haversineDistanceMeters(
            inCoords.lat,
            inCoords.lng,
            project.latitude!,
            project.longitude!
          ),
          checkOutLat: outCoords?.lat ?? null,
          checkOutLng: outCoords?.lng ?? null,
          checkOutDistanceMeters: outCoords
            ? haversineDistanceMeters(
                outCoords.lat,
                outCoords.lng,
                project.latitude!,
                project.longitude!
              )
            : null,
          checkInPhotoUrl,
          checkOutPhotoUrl,
        },
      });
      attendanceCount += 1;

      // Progress report on most working days; both employees often post same day.
      const shouldReport =
        employeeIndex % 2 === dayIndex % 2 || dayIndex % 2 === 0;
      if (!shouldReport) continue;

      const template =
        NOTE_TEMPLATES[
          (dayIndex * employees.length + employeeIndex) % NOTE_TEMPLATES.length
        ]!;

      const photoA = progressPhotoUrls[photoCursor % progressPhotoUrls.length]!;
      photoCursor += 1;
      const photoB = progressPhotoUrls[photoCursor % progressPhotoUrls.length]!;
      photoCursor += 1;

      await prisma.progressReport.create({
        data: {
          projectId: project.id,
          employeeId: employee.id,
          reportDate,
          stageLabel: template.stageLabel,
          notes: `${DEMO_TAG} — ${template.notes}`,
          status: "SUBMITTED",
          sortOrder: nextSort,
          invoicePeriodId,
          createdAt: localJakarta(day, 9 + employeeIndex, 20 + dayIndex * 3),
          photos: {
            create: [
              { url: photoA, caption: template.caption },
              { url: photoB, caption: "After cleaning" },
            ],
          },
        },
      });
      nextSort += 1;
      progressReportCount += 1;

      // Budi (OPR-001) posts multiple progress reports on Aug 12 for demo.
      if (employee.employeeNo === "OPR-001" && day === 12) {
        const extraTemplates = NOTE_TEMPLATES.slice(1, 3);
        for (let extraIndex = 0; extraIndex < extraTemplates.length; extraIndex += 1) {
          const extra = extraTemplates[extraIndex]!;
          const extraPhotoA =
            progressPhotoUrls[photoCursor % progressPhotoUrls.length]!;
          photoCursor += 1;
          const extraPhotoB =
            progressPhotoUrls[photoCursor % progressPhotoUrls.length]!;
          photoCursor += 1;

          await prisma.progressReport.create({
            data: {
              projectId: project.id,
              employeeId: employee.id,
              reportDate,
              stageLabel: extra.stageLabel,
              notes: `${DEMO_TAG} — ${extra.notes}`,
              status: "SUBMITTED",
              sortOrder: nextSort,
              invoicePeriodId,
              createdAt: localJakarta(day, 11 + extraIndex, 15 + extraIndex * 20),
              photos: {
                create: [
                  { url: extraPhotoA, caption: extra.caption },
                  { url: extraPhotoB, caption: "After cleaning" },
                ],
              },
            },
          });
          nextSort += 1;
          progressReportCount += 1;
        }
      }
    }
  }

  const employeeLabels = employees.map(
    (e) => `${e.firstName} ${e.lastName} (${e.employeeNo})`
  );

  const monthlyUrl = `/reports/${project.clientId}/${project.id}?year=${YEAR}&month=${MONTH}`;
  const cicoUrl = `/cico?projectId=${project.id}`;
  const progressUrl = `/progress?projectId=${project.id}`;

  console.log("\n--- Demo seed complete ---");
  console.log(`Project: ${project.name}`);
  console.log(`Client:  ${project.client!.name}`);
  console.log(`Employees (${employees.length}):`);
  for (const label of employeeLabels) {
    console.log(`  • ${label}`);
  }
  console.log(`Days seeded (${seededDays.size}): ${[...seededDays].sort().join(", ")}`);
  console.log(`Attendance rows: ${attendanceCount}`);
  console.log(`Progress reports: ${progressReportCount}`);

  const budi = employees.find((e) => e.employeeNo === "OPR-001");
  if (budi) {
    const budiAug12 = jakartaDate(12);
    const budiAug12Count = await prisma.progressReport.count({
      where: {
        projectId: project.id,
        employeeId: budi.id,
        reportDate: budiAug12,
      },
    });
    console.log(`Budi (OPR-001) PRs on 2026-08-12: ${budiAug12Count}`);
    if (budiAug12Count < 3) {
      throw new Error(
        `Expected at least 3 progress reports for Budi on 2026-08-12, got ${budiAug12Count}.`
      );
    }
  }

  console.log("\nOpen in app (login required):");
  console.log(`  Monthly report: ${monthlyUrl}`);
  console.log(`  CICO history:   ${cicoUrl}`);
  console.log(`  Progress feed:  ${progressUrl}`);
  console.log("\nRe-run: npx tsx scripts/seed-ftl-kebon-sirih-demo.ts");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
