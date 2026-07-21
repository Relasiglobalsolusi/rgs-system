/**
 * Demo data: progress reports dated 17 July 2026 across in-progress cleaning projects.
 *
 * Usage: npx tsx prisma/seed-demo-july17.ts
 *
 * Idempotent for that calendar day — deletes prior 2026-07-17 demo reports for the
 * target projects, then recreates a varied sample (notes + placeholder photos).
 */
import { PrismaClient, ProjectStatus } from "@prisma/client";
import { copyFile, mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  contractCyclePeriodBounds,
  resolveContractCycleIndex,
  toUtcDateOnly,
} from "../lib/invoice-period";
import { isCleaningProjectSubCategory } from "../lib/project-subcategory";
import { nextSortOrderFromMax } from "../lib/reorder";

const prisma = new PrismaClient();

const REPORT_DATE = toUtcDateOnly(new Date(Date.UTC(2026, 6, 17))); // 17 July 2026
const DEMO_PHOTO_PREFIX = "demo-july17-2026";

type NoteTemplate = {
  notes: string;
  caption: string;
  stageLabel?: string;
};

const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    notes:
      "Morning lobby sweep and glass wipe completed. Reception mats flipped; no spills reported.",
    caption: "Lobby — morning",
    stageLabel: "Daily routine",
  },
  {
    notes:
      "Restrooms on floors 3–8 restocked and sanitized. Soap dispenser on 5F refilled.",
    caption: "Restroom rounds",
    stageLabel: "Sanitation",
  },
  {
    notes:
      "Lift cars vacuumed; fingerprints removed from panels. Landings mopped after rain traffic.",
    caption: "Lift bank",
    stageLabel: "Common areas",
  },
  {
    notes:
      "Food court tables wiped between rushes. Spill near stall 12 treated; floor dry before peak.",
    caption: "Food court",
    stageLabel: "High-traffic clean",
  },
  {
    notes:
      "Meeting rooms reset after tenant workshop. Whiteboards cleaned; bins emptied.",
    caption: "Meeting rooms",
    stageLabel: "Event follow-up",
  },
  {
    notes:
      "Warehouse aisles swept; dust from pallet move cleared near dock 2. Safety cones left in place.",
    caption: "Warehouse aisle",
    stageLabel: "Floor care",
  },
  {
    notes:
      "Pantry areas degreased; fridge handles disinfected. Supplies sufficient through weekend.",
    caption: "Pantry service",
    stageLabel: "Pantry",
  },
  {
    notes:
      "Exterior entrance mats shaken; canopy glass streaked after rain — second pass done.",
    caption: "Main entrance",
    stageLabel: "Entrance",
  },
];

async function ensureDemoPhotos(count: number): Promise<string[]> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "progress");
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
    urls.push(`/uploads/progress/${filename}`);
  }

  return urls;
}

async function ensureOngoingPeriod(projectId: string, startDate: Date | null) {
  if (!startDate) return null;

  const contractStart = toUtcDateOnly(startDate);
  const cycleIndex = resolveContractCycleIndex(contractStart, REPORT_DATE);
  const { periodStart, periodEnd, label } = contractCyclePeriodBounds(
    contractStart,
    cycleIndex
  );

  const existing = await prisma.projectInvoicePeriod.findUnique({
    where: {
      projectId_periodStart_periodEnd: {
        projectId,
        periodStart,
        periodEnd,
      },
    },
  });

  if (existing) return existing;

  return prisma.projectInvoicePeriod.create({
    data: {
      projectId,
      periodStart,
      periodEnd,
      label,
      status: "ONGOING",
    },
  });
}

function isUsableEmployee(employee: {
  employeeNo: string;
  status: string;
  archivedFromDirectory: boolean;
}) {
  return (
    employee.status === "ACTIVE" &&
    !employee.archivedFromDirectory &&
    !employee.employeeNo.includes("~deleted~")
  );
}

async function main() {
  console.log("Seeding 17 July 2026 demo progress reports…");

  const activeStaff = await prisma.employee.findMany({
    where: {
      status: "ACTIVE",
      archivedFromDirectory: false,
      NOT: { employeeNo: { contains: "~deleted~" } },
    },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
      status: true,
      archivedFromDirectory: true,
    },
    orderBy: { employeeNo: "asc" },
    take: 12,
  });

  if (activeStaff.length === 0) {
    throw new Error(
      "No active employees found. Run npm run db:seed first."
    );
  }

  const projects = await prisma.project.findMany({
    where: {
      status: ProjectStatus.IN_PROGRESS,
      subCategory: {
        in: ["REGULAR_CLEANING", "GENERAL_CLEANING", "FACADE_CLEANING"],
      },
    },
    include: {
      assignments: {
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
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

  // Ensure each in-progress cleaning project has at least one active assignee
  // so reports can appear in the Progress UI (local demo only).
  let staffCursor = 0;
  for (const project of projects) {
    if (!isCleaningProjectSubCategory(project.subCategory)) continue;
    const usable = project.assignments.filter((a) =>
      isUsableEmployee(a.employee)
    );
    if (usable.length > 0) continue;

    const employee = activeStaff[staffCursor % activeStaff.length]!;
    staffCursor += 1;
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

  const refreshed = await prisma.project.findMany({
    where: {
      status: ProjectStatus.IN_PROGRESS,
      subCategory: {
        in: ["REGULAR_CLEANING", "GENERAL_CLEANING", "FACADE_CLEANING"],
      },
    },
    include: {
      assignments: {
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
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

  const eligible = refreshed
    .filter((p) => isCleaningProjectSubCategory(p.subCategory))
    .map((p) => ({
      ...p,
      assignments: p.assignments.filter((a) => isUsableEmployee(a.employee)),
    }))
    .filter((p) => p.assignments.length > 0);

  if (eligible.length === 0) {
    throw new Error(
      "No in-progress cleaning projects with active staff assignments found. Run npm run db:seed first."
    );
  }

  // Build report plan: one report per project first (max variety), then a second
  // report on projects that have multiple assignees — capped at 8.
  type ReportPlan = {
    projectId: string;
    projectName: string;
    employeeId: string;
    employeeLabel: string;
    billingMode: string;
    startDate: Date | null;
    template: NoteTemplate;
  };

  const plans: ReportPlan[] = [];

  const pushPlan = (
    project: (typeof eligible)[number],
    employee: (typeof eligible)[number]["assignments"][number]["employee"]
  ) => {
    if (plans.length >= 8) return;
    if (
      plans.some(
        (p) =>
          p.projectId === project.id && p.employeeId === employee.id
      )
    ) {
      return;
    }
    plans.push({
      projectId: project.id,
      projectName: project.name,
      employeeId: employee.id,
      employeeLabel: `${employee.firstName} ${employee.lastName} (${employee.employeeNo})`,
      billingMode: project.billingMode,
      startDate: project.startDate,
      template: NOTE_TEMPLATES[plans.length % NOTE_TEMPLATES.length]!,
    });
  };

  for (const project of eligible) {
    pushPlan(project, project.assignments[0]!.employee);
  }
  for (const project of eligible) {
    if (plans.length >= 8) break;
    if (project.assignments.length > 1) {
      pushPlan(project, project.assignments[1]!.employee);
    }
  }

  const projectIds = [...new Set(plans.map((p) => p.projectId))];

  // Idempotent: remove prior reports for this demo date on these projects
  await prisma.progressReportPhoto.deleteMany({
    where: {
      progressReport: {
        projectId: { in: projectIds },
        reportDate: REPORT_DATE,
      },
    },
  });
  const deleted = await prisma.progressReport.deleteMany({
    where: {
      projectId: { in: projectIds },
      reportDate: REPORT_DATE,
    },
  });
  if (deleted.count > 0) {
    console.log(`Removed ${deleted.count} existing report(s) for 2026-07-17.`);
  }

  const photoUrls = await ensureDemoPhotos(Math.max(plans.length * 2, 4));

  const topSort = await prisma.progressReport.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let nextSort = nextSortOrderFromMax(topSort?.sortOrder);

  const created: Array<{
    id: string;
    project: string;
    employee: string;
    notes: string;
  }> = [];

  for (let i = 0; i < plans.length; i += 1) {
    const plan = plans[i]!;
    let invoicePeriodId: string | null = null;

    if (plan.billingMode === "MONTHLY" && plan.startDate) {
      const period = await ensureOngoingPeriod(plan.projectId, plan.startDate);
      if (
        period &&
        (period.status === "ONGOING" || period.status === "COMPILING")
      ) {
        invoicePeriodId = period.id;
      }
    }

    const report = await prisma.progressReport.create({
      data: {
        projectId: plan.projectId,
        employeeId: plan.employeeId,
        reportDate: REPORT_DATE,
        notes: plan.template.notes,
        stageLabel: plan.template.stageLabel ?? null,
        status: "SUBMITTED",
        sortOrder: nextSort,
        invoicePeriodId,
        createdAt: new Date(Date.UTC(2026, 6, 17, 8 + i, 15, 0)),
        photos: {
          create: [
            {
              url: photoUrls[i % photoUrls.length]!,
              caption: plan.template.caption,
            },
            {
              url: photoUrls[(i + 1) % photoUrls.length]!,
              caption: "After cleaning",
            },
          ],
        },
      },
    });

    nextSort += 1;
    created.push({
      id: report.id,
      project: plan.projectName,
      employee: plan.employeeLabel,
      notes: plan.template.notes.slice(0, 60) + "…",
    });
  }

  console.log(`\nCreated ${created.length} progress report(s) for 17 July 2026:\n`);
  for (const row of created) {
    console.log(`  • ${row.project}`);
    console.log(`    ${row.employee}`);
    console.log(`    ${row.notes}`);
  }

  console.log("\nView in app (login required):");
  console.log("  /progress?date=2026-07-17");
  console.log("  Admin:   username vicko / admin123");
  console.log("  Manager: username manager / manager123");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
