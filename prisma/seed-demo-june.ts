/**
 * Demo data: June 2026 progress reports + compiled billing for Regular Cleaning.
 *
 * Usage: npx tsx prisma/seed-demo-june.ts
 */
import {
  InvoicePeriodStatus,
  PrismaClient,
  ProjectStatus,
} from "@prisma/client";
import { copyFile, mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  computeInvoiceDueAt,
  contractCyclePeriodBounds,
  formatInvoicePeriodDateRange,
  invoicingDayFromContractStart,
  monthPeriodBounds,
  toUtcDateOnly,
} from "../lib/invoice-period";
import { generateInvoicePeriodPdf } from "../lib/progress-report-pdf";
import {
  decimalToNumber,
  formatContractPrice,
} from "../lib/project-billing";

const prisma = new PrismaClient();

const PROJECT_ID = "project-gedung-a";
/** June 1 start → cycle 1 covers 1 Jun – 1 Jul (all June report dates). */
const CONTRACT_START = toUtcDateOnly(new Date(Date.UTC(2026, 5, 1)));
const JUNE_YEAR = 2026;
const JUNE_MONTH = 6; // 1-based calendar month
const DEMO_PHOTO_PREFIX = "demo-june-2026";

type NoteTemplate = {
  notes: string;
  caption: string;
};

const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    notes:
      "Lobby and reception vacuumed and mopped. Glass doors wiped; no issues.",
    caption: "Lobby — morning shift",
  },
  {
    notes:
      "Lift cars and landings cleaned. Minor sticker residue removed from L3.",
    caption: "Lift bank",
  },
  {
    notes:
      "Restrooms restocked and sanitized. One tap on 12F reported loose — logged for maintenance.",
    caption: "Restroom rounds",
  },
  {
    notes:
      "Parking B1 swept; oil spot treated near pillar C4. Signage dusted.",
    caption: "Basement parking",
  },
  {
    notes:
      "Meeting rooms 8A–8D reset after tenant event. Chairs aligned, bins emptied.",
    caption: "Meeting rooms",
  },
  {
    notes:
      "Pantry areas wiped; coffee machine area degreased. Supplies adequate.",
    caption: "Pantry service",
  },
  {
    notes:
      "Exterior entrance mats shaken and replaced. Rain tracked in — extra mop pass done.",
    caption: "Main entrance",
  },
  {
    notes:
      "Stairwells swept; handrails disinfected. Lighting OK on all floors.",
    caption: "Stairwell",
  },
  {
    notes:
      "Loading dock hosed down. Cardboard cleared; no pest signs observed.",
    caption: "Loading dock",
  },
  {
    notes:
      "Executive floor touch-up completed before client walkthrough. All clear.",
    caption: "Executive floor",
  },
];

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function isWeekday(date: Date) {
  const dow = date.getUTCDay();
  return dow >= 1 && dow <= 5;
}

function juneWeekdays(year: number) {
  const days: Date[] = [];
  for (let day = 1; day <= 30; day += 1) {
    const d = utcDate(year, JUNE_MONTH, day);
    if (isWeekday(d)) days.push(d);
  }
  return days;
}

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
      // Fallback: tiny valid PNG if brand asset missing
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

async function main() {
  console.log("🌱 Seeding June 2026 demo progress + billing…");

  const project = await prisma.project.findUnique({
    where: { id: PROJECT_ID },
    include: {
      client: true,
      company: {
        select: { name: true, email: true, phone: true, address: true },
      },
    },
  });

  if (!project) {
    throw new Error(
      `Project ${PROJECT_ID} not found. Run npm run db:seed first.`
    );
  }

  const staff = await prisma.employee.findMany({
    where: {
      employeeNo: { in: ["OPR-001", "OPR-002"] },
    },
    select: { id: true, employeeNo: true, firstName: true, lastName: true },
  });

  if (staff.length < 2) {
    throw new Error("Demo staff OPR-001 / OPR-002 not found. Run db:seed first.");
  }

  const staffByNo = new Map(staff.map((s) => [s.employeeNo, s]));
  const budi = staffByNo.get("OPR-001")!;
  const siti = staffByNo.get("OPR-002")!;

  const vicko = await prisma.user.findFirst({
    where: { email: "vicko@rgs.co.id" },
    select: { id: true },
  });

  const juneBounds = monthPeriodBounds(utcDate(JUNE_YEAR, JUNE_MONTH, 15));
  const cycle1 = contractCyclePeriodBounds(CONTRACT_START, 1);
  const cycle2 = contractCyclePeriodBounds(CONTRACT_START, 2);

  console.log(`Project: ${project.name} (${project.client?.name})`);
  console.log(`Contract start: ${CONTRACT_START.toISOString().slice(0, 10)}`);
  console.log(`Billing cycle 1: ${cycle1.label}`);
  console.log(`Calendar June label: ${juneBounds.label}`);

  // Align project for June anniversary billing
  await prisma.project.update({
    where: { id: PROJECT_ID },
    data: {
      status: ProjectStatus.IN_PROGRESS,
      startDate: CONTRACT_START,
      estimatedStartDate: CONTRACT_START,
      invoicingDay: invoicingDayFromContractStart(CONTRACT_START),
    },
  });

  // Remove prior demo rows for this project (idempotent re-run)
  await prisma.progressReportPhoto.deleteMany({
    where: {
      progressReport: {
        projectId: PROJECT_ID,
        reportDate: {
          gte: utcDate(JUNE_YEAR, JUNE_MONTH, 1),
          lte: utcDate(JUNE_YEAR, JUNE_MONTH, 30),
        },
      },
    },
  });

  await prisma.progressReport.deleteMany({
    where: {
      projectId: PROJECT_ID,
      reportDate: {
        gte: utcDate(JUNE_YEAR, JUNE_MONTH, 1),
        lte: utcDate(JUNE_YEAR, JUNE_MONTH, 30),
      },
    },
  });

  await prisma.projectInvoicePeriod.deleteMany({
    where: { projectId: PROJECT_ID },
  });

  const weekdays = juneWeekdays(JUNE_YEAR);
  const photoUrls = await ensureDemoPhotos(weekdays.length);

  const junePeriod = await prisma.projectInvoicePeriod.create({
    data: {
      projectId: PROJECT_ID,
      periodStart: cycle1.periodStart,
      periodEnd: cycle1.periodEnd,
      label: formatInvoicePeriodDateRange(
        utcDate(JUNE_YEAR, JUNE_MONTH, 1),
        utcDate(JUNE_YEAR, JUNE_MONTH, 30)
      ),
      status: InvoicePeriodStatus.ONGOING,
      amount: decimalToNumber(project.contractPrice) ?? 45_000_000,
      taxInvoiceRequired: project.requiresTaxInvoice,
    },
  });

  let created = 0;
  for (let i = 0; i < weekdays.length; i += 1) {
    const reportDate = weekdays[i]!;
    const employee = i % 2 === 0 ? budi : siti;
    const template = NOTE_TEMPLATES[i % NOTE_TEMPLATES.length]!;

    await prisma.progressReport.create({
      data: {
        projectId: PROJECT_ID,
        employeeId: employee.id,
        reportDate,
        notes: template.notes,
        status: "SUBMITTED",
        invoicePeriodId: junePeriod.id,
        photos: {
          create: [
            { url: photoUrls[i]!, caption: template.caption },
            {
              url: photoUrls[(i + 3) % photoUrls.length]!,
              caption: "After cleaning",
            },
          ],
        },
      },
    });
    created += 1;
  }

  console.log(`Created ${created} progress reports for June 2026 weekdays.`);

  // Compile June invoice (same logic as compileInvoicePeriod, without auth)
  const reports = await prisma.progressReport.findMany({
    where: {
      projectId: PROJECT_ID,
      reportDate: {
        gte: junePeriod.periodStart,
        lte: junePeriod.periodEnd,
      },
    },
    include: {
      employee: {
        select: { firstName: true, lastName: true, employeeNo: true },
      },
      photos: { select: { url: true, caption: true } },
    },
    orderBy: [{ reportDate: "asc" }, { createdAt: "asc" }],
  });

  const submittedAt = new Date();
  const dueAt = computeInvoiceDueAt(submittedAt);
  const invoiceAmount =
    decimalToNumber(junePeriod.amount) ??
    decimalToNumber(project.contractPrice);
  const amountLabel =
    invoiceAmount != null ? formatContractPrice(invoiceAmount) : null;
  const invoiceNumber = `INV-${junePeriod.periodStart.getUTCFullYear()}${String(
    junePeriod.periodStart.getUTCMonth() + 1
  ).padStart(2, "0")}-JUNE26`;

  const invoicePdfPath = await generateInvoicePeriodPdf({
    projectName: project.name,
    clientName: project.client?.name ?? null,
    clientAddress: project.client?.address ?? null,
    clientEmail:
      project.client?.contactPersonEmail?.trim() ||
      project.client?.email ||
      null,
    clientPhone:
      project.client?.contactPersonPhone?.trim() ||
      project.client?.phone ||
      null,
    clientNpwp: project.client?.npwp ?? null,
    location: project.location,
    periodLabel: junePeriod.label ?? "June 2026",
    periodStart: junePeriod.periodStart,
    periodEnd: junePeriod.periodEnd,
    reports,
    amountLabel,
    dueAt,
    invoiceNumber,
    company: project.company,
    title: "Monthly Progress Invoice",
  });

  await prisma.$transaction([
    prisma.progressReport.updateMany({
      where: {
        projectId: PROJECT_ID,
        reportDate: {
          gte: junePeriod.periodStart,
          lte: junePeriod.periodEnd,
        },
      },
      data: { invoicePeriodId: junePeriod.id },
    }),
    prisma.projectInvoicePeriod.update({
      where: { id: junePeriod.id },
      data: {
        status: InvoicePeriodStatus.AWAITING_PAYMENT,
        invoicePdfPath,
        reportCount: reports.length,
        submittedAt,
        dueAt,
        compiledById: vicko?.id ?? null,
        compileNote: `Demo seed — compiled ${reports.length} June 2026 progress report(s). Combined invoice + proof PDF generated.`,
        ...(invoiceAmount != null ? { amount: invoiceAmount } : {}),
        ...(project.requiresTaxInvoice ? { taxInvoiceRequired: true } : {}),
      },
    }),
  ]);

  // Next anniversary cycle (July) stays open for ongoing contract
  await prisma.projectInvoicePeriod.upsert({
    where: {
      projectId_periodStart_periodEnd: {
        projectId: PROJECT_ID,
        periodStart: cycle2.periodStart,
        periodEnd: cycle2.periodEnd,
      },
    },
    update: {
      label: cycle2.label,
      status: InvoicePeriodStatus.ONGOING,
      amount: decimalToNumber(project.contractPrice) ?? 45_000_000,
    },
    create: {
      projectId: PROJECT_ID,
      periodStart: cycle2.periodStart,
      periodEnd: cycle2.periodEnd,
      label: cycle2.label,
      status: InvoicePeriodStatus.ONGOING,
      amount: decimalToNumber(project.contractPrice) ?? 45_000_000,
    },
  });

  console.log("\n✅ June demo seed complete.");
  console.log(`   Project: ${project.name}`);
  console.log(`   Client:  ${project.client?.name}`);
  console.log(`   Reports: ${reports.length} (weekdays in June 2026)`);
  console.log(`   Period:  ${junePeriod.label} [${junePeriod.status} → AWAITING_PAYMENT]`);
  console.log(`   Invoice: ${invoicePdfPath}`);
  console.log(`   Amount:  ${amountLabel ?? "—"}`);
  console.log("\nNavigation:");
  console.log(`   Project:  /projects/${PROJECT_ID}`);
  console.log(`   Billing:  /billing/${project.clientId}/${PROJECT_ID}`);
  console.log(`   Progress: /progress?projectId=${PROJECT_ID}&date=2026-06-02`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
