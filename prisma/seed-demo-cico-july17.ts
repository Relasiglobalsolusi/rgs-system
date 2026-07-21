/**
 * Demo data: CICO / attendance check-in records for 17 July 2026.
 *
 * Usage: npx tsx prisma/seed-demo-cico-july17.ts
 *
 * Idempotent for that calendar day — deletes prior 2026-07-17 attendance for
 * the seeded employees, then recreates a varied sample (checked in, checked out,
 * late, different sites / distances, check-in photos).
 */
import { copyFile, mkdir, writeFile } from "fs/promises";
import path from "path";
import { PrismaClient, ProjectStatus } from "@prisma/client";
import { haversineDistanceMeters } from "../lib/geo";
import { toUtcDateOnly } from "../lib/invoice-period";

const prisma = new PrismaClient();

const ATTENDANCE_DATE = toUtcDateOnly(new Date(Date.UTC(2026, 6, 17))); // 17 July 2026
const DEMO_PHOTO_PREFIX = "demo-cico-2026-07-17";

async function ensureDemoCheckInPhotos(count: number): Promise<string[]> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "cico");
  await mkdir(uploadDir, { recursive: true });

  const sourceLogo = path.join(process.cwd(), "public", "brand", "rgs-logo.png");
  const urls: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const filename = `${DEMO_PHOTO_PREFIX}-${String(i + 1).padStart(2, "0")}.png`;
    const dest = path.join(uploadDir, filename);
    try {
      await copyFile(sourceLogo, dest);
    } catch {
      const tinyPng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      );
      await writeFile(dest, tinyPng);
    }
    urls.push(`/uploads/cico/${filename}`);
  }

  return urls;
}

type Scenario =
  | "on_time_complete"
  | "late_complete"
  | "checked_in_only"
  | "early_complete"
  | "near_edge_complete";

type Plan = {
  employeeId: string;
  employeeLabel: string;
  projectId: string;
  projectName: string;
  latitude: number;
  longitude: number;
  scenario: Scenario;
};

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

function localJakarta(hour: number, minute: number) {
  // Asia/Jakarta = UTC+7 — store absolute instants matching field clock times.
  return new Date(Date.UTC(2026, 6, 17, hour - 7, minute, 0));
}

function buildTimes(scenario: Scenario): {
  checkIn: Date;
  checkOut: Date | null;
  note: string | null;
  inOffset: [number, number];
  outOffset: [number, number] | null;
} {
  switch (scenario) {
    case "on_time_complete":
      return {
        checkIn: localJakarta(7, 48),
        checkOut: localJakarta(17, 5),
        note: null,
        inOffset: [8, -5],
        outOffset: [-6, 10],
      };
    case "late_complete":
      return {
        checkIn: localJakarta(8, 22),
        checkOut: localJakarta(17, 12),
        note: "Late check-in (expected before 08:00).",
        inOffset: [12, 4],
        outOffset: [3, -8],
      };
    case "checked_in_only":
      return {
        checkIn: localJakarta(7, 55),
        checkOut: null,
        note: null,
        inOffset: [-4, 9],
        outOffset: null,
      };
    case "early_complete":
      return {
        checkIn: localJakarta(7, 35),
        checkOut: localJakarta(16, 40),
        note: null,
        inOffset: [5, 5],
        outOffset: [-10, -3],
      };
    case "near_edge_complete":
      return {
        checkIn: localJakarta(8, 5),
        checkOut: localJakarta(17, 18),
        note: null,
        inOffset: [28, 18],
        outOffset: [22, -20],
      };
  }
}

const SCENARIO_ORDER: Scenario[] = [
  "on_time_complete",
  "late_complete",
  "checked_in_only",
  "early_complete",
  "near_edge_complete",
  "on_time_complete",
  "checked_in_only",
  "late_complete",
];

async function main() {
  console.log("Seeding 17 July 2026 demo CICO / attendance records…");

  const fieldStaffFilter = {
    status: "ACTIVE" as const,
    archivedFromDirectory: false,
    NOT: {
      OR: [
        { employeeType: "HEAD_OFFICE" as const },
        { placement: "HEAD_OFFICE" as const },
        { employeeNo: { contains: "~deleted~" } },
      ],
    },
  };

  const assignments = await prisma.projectAssignment.findMany({
    where: {
      employee: fieldStaffFilter,
      project: {
        status: ProjectStatus.IN_PROGRESS,
        latitude: { not: null },
        longitude: { not: null },
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeNo: true,
          firstName: true,
          lastName: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          location: true,
        },
      },
    },
    orderBy: [{ employee: { employeeNo: "asc" } }, { project: { name: "asc" } }],
  });

  // One attendance row per employee per day — pick first assigned geo site.
  const byEmployee = new Map<string, (typeof assignments)[number]>();
  for (const row of assignments) {
    if (!byEmployee.has(row.employeeId)) {
      byEmployee.set(row.employeeId, row);
    }
  }

  let selected = [...byEmployee.values()].slice(0, 8);

  if (selected.length === 0) {
    // Fallback: assign active field staff onto in-progress geo projects.
    const staff = await prisma.employee.findMany({
      where: fieldStaffFilter,
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
      },
      orderBy: { employeeNo: "asc" },
      take: 8,
    });

    const projects = await prisma.project.findMany({
      where: {
        status: ProjectStatus.IN_PROGRESS,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        location: true,
      },
      orderBy: { name: "asc" },
      take: 8,
    });

    if (staff.length === 0 || projects.length === 0) {
      throw new Error(
        "No field staff or in-progress geo projects found. Run npm run db:seed first."
      );
    }

    for (let i = 0; i < Math.min(staff.length, projects.length, 8); i += 1) {
      const employee = staff[i]!;
      const project = projects[i % projects.length]!;
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
          shiftStart: "08:00",
          shiftEnd: "17:00",
        },
      });
      console.log(
        `Assigned ${employee.employeeNo} → ${project.name} (demo fixture)`
      );
    }

    const refreshed = await prisma.projectAssignment.findMany({
      where: {
        employeeId: { in: staff.map((s) => s.id) },
        project: {
          status: ProjectStatus.IN_PROGRESS,
          latitude: { not: null },
          longitude: { not: null },
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeNo: true,
            firstName: true,
            lastName: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            location: true,
          },
        },
      },
      orderBy: { employee: { employeeNo: "asc" } },
    });

    const map = new Map<string, (typeof refreshed)[number]>();
    for (const row of refreshed) {
      if (!map.has(row.employeeId)) map.set(row.employeeId, row);
    }
    selected = [...map.values()].slice(0, 8);
  }

  if (selected.length === 0) {
    throw new Error(
      "Could not build demo CICO plans. Run npm run db:seed first."
    );
  }

  const plans: Plan[] = selected.map((row, index) => ({
    employeeId: row.employee.id,
    employeeLabel: `${row.employee.firstName} ${row.employee.lastName} (${row.employee.employeeNo})`,
    projectId: row.project.id,
    projectName: row.project.name,
    latitude: row.project.latitude!,
    longitude: row.project.longitude!,
    scenario: SCENARIO_ORDER[index % SCENARIO_ORDER.length]!,
  }));

  const employeeIds = plans.map((p) => p.employeeId);

  const deleted = await prisma.attendance.deleteMany({
    where: {
      employeeId: { in: employeeIds },
      date: ATTENDANCE_DATE,
    },
  });
  if (deleted.count > 0) {
    console.log(
      `Removed ${deleted.count} existing attendance row(s) for 2026-07-17.`
    );
  }

  const photoUrls = await ensureDemoCheckInPhotos(plans.length);

  const created: Array<{
    employee: string;
    project: string;
    scenario: Scenario;
    checkIn: string;
    checkOut: string;
    inDistance: number;
  }> = [];

  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index]!;
    const times = buildTimes(plan.scenario);
    const inCoords = offsetCoords(
      plan.latitude,
      plan.longitude,
      times.inOffset[0],
      times.inOffset[1]
    );
    const outCoords = times.outOffset
      ? offsetCoords(
          plan.latitude,
          plan.longitude,
          times.outOffset[0],
          times.outOffset[1]
        )
      : null;

    const checkInDistanceMeters = haversineDistanceMeters(
      inCoords.lat,
      inCoords.lng,
      plan.latitude,
      plan.longitude
    );
    const checkOutDistanceMeters = outCoords
      ? haversineDistanceMeters(
          outCoords.lat,
          outCoords.lng,
          plan.latitude,
          plan.longitude
        )
      : null;

    await prisma.attendance.create({
      data: {
        employeeId: plan.employeeId,
        projectId: plan.projectId,
        date: ATTENDANCE_DATE,
        checkIn: times.checkIn,
        checkOut: times.checkOut,
        note: times.note,
        checkInLat: inCoords.lat,
        checkInLng: inCoords.lng,
        checkInDistanceMeters,
        checkInPhotoUrl: photoUrls[index] ?? null,
        checkOutLat: outCoords?.lat ?? null,
        checkOutLng: outCoords?.lng ?? null,
        checkOutDistanceMeters,
      },
    });

    created.push({
      employee: plan.employeeLabel,
      project: plan.projectName,
      scenario: plan.scenario,
      checkIn: times.checkIn.toISOString(),
      checkOut: times.checkOut ? times.checkOut.toISOString() : "(still on site)",
      inDistance: Math.round(checkInDistanceMeters),
    });
  }

  console.log(`\nCreated ${created.length} attendance record(s) for 17 July 2026:\n`);
  for (const row of created) {
    console.log(`  • ${row.employee}`);
    console.log(`    ${row.project} · ${row.scenario}`);
    console.log(
      `    in ${row.checkIn} · out ${row.checkOut} · ~${row.inDistance} m from site`
    );
  }

  console.log("\nView in app (login required):");
  console.log("  /attendance?date=2026-07-17");
  console.log("  /dashboard  (today's attendance widget, if calendar day matches)");
  console.log("  /cico       (field staff: recent history / today if date matches)");
  console.log("  Admin:   username vicko / admin123");
  console.log("\nRe-run: npx tsx prisma/seed-demo-cico-july17.ts");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
