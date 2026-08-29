/**
 * Demo rows for Completed Projects:
 * - Closed one-time jobs (project status COMPLETED)
 * - Paid periods on still-running Regular / monthly contracts
 *
 * Idempotent. Does not flip live Payment Due rows or owner login `vicko`.
 *
 * Usage: npx tsx prisma/seed-demo-completed-projects.ts
 */
import {
  BillingMode,
  CommercialTaxKind,
  InvoicePeriodStatus,
  Prisma,
  PrismaClient,
  ProjectStatus,
  ProjectSubCategory,
  ServiceArea,
} from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { invoicingDayFromContractStart } from "../lib/invoice-period";
import { isContractCycleSubCategory } from "../lib/project-contract";
import { SYSTEM_AREA_SEEDS } from "../lib/project-service-catalog";

const DEMO_PDF = Buffer.from(
  "%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf8"
);

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

async function writeUpload(folder: string, filename: string) {
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), DEMO_PDF);
  return `/uploads/${folder}/${filename}`;
}

async function ensureCatalog(prisma: PrismaClient, companyId: string) {
  for (const area of SYSTEM_AREA_SEEDS) {
    const areaRow = await prisma.projectServiceAreaCatalog.upsert({
      where: { companyId_slug: { companyId, slug: area.slug } },
      update: {},
      create: {
        companyId,
        slug: area.slug,
        nameEn: area.nameEn,
        nameId: area.nameId,
        sortOrder: area.sortOrder,
        isSystem: true,
        systemArea: area.systemArea,
        allowsOneTime: area.allowsOneTime,
      },
    });
    for (const sub of area.subcategories) {
      await prisma.projectSubcategoryCatalog.upsert({
        where: { areaId_slug: { areaId: areaRow.id, slug: sub.slug } },
        update: {},
        create: {
          areaId: areaRow.id,
          slug: sub.slug,
          nameEn: sub.nameEn,
          nameId: sub.nameId,
          sortOrder: sub.sortOrder,
          isSystem: true,
          systemSubCategory: sub.systemSubCategory,
          billingKind: sub.billingKind,
        },
      });
    }
  }
}

async function catalogPair(
  prisma: PrismaClient,
  companyId: string,
  areaSlug: string,
  subSlug: string | null
) {
  const area = await prisma.projectServiceAreaCatalog.findUnique({
    where: { companyId_slug: { companyId, slug: areaSlug } },
    include: { subcategories: true },
  });
  if (!area) throw new Error(`Missing catalog area ${areaSlug}`);
  const sub = subSlug
    ? area.subcategories.find((row) => row.slug === subSlug) ?? null
    : null;
  return { area, sub };
}

async function ensurePaidPeriod(
  prisma: PrismaClient,
  opts: {
    projectId: string;
    periodStart: Date;
    periodEnd: Date;
    label: string;
    amount: number;
    paidAt: Date;
    compiledById: string | null;
    taxInvoiceRequired: boolean;
  }
) {
  const invoicePdf = await writeUpload(
    "invoices",
    `${opts.projectId}-${opts.label.replace(/\s+/g, "-")}.pdf`
  );
  const taxPdf = opts.taxInvoiceRequired
    ? await writeUpload(
        "tax-invoices",
        `${opts.projectId}-${opts.label.replace(/\s+/g, "-")}-faktur.pdf`
      )
    : null;
  return prisma.projectInvoicePeriod.upsert({
    where: {
      projectId_periodStart_periodEnd: {
        projectId: opts.projectId,
        periodStart: opts.periodStart,
        periodEnd: opts.periodEnd,
      },
    },
    update: {
      label: opts.label,
      status: InvoicePeriodStatus.PAID,
      amount: new Prisma.Decimal(opts.amount),
      paidAt: opts.paidAt,
      submittedAt: opts.paidAt,
      compiledById: opts.compiledById,
      invoicePdfPath: invoicePdf,
      taxInvoiceRequired: opts.taxInvoiceRequired,
      taxInvoiceDoneAt: opts.taxInvoiceRequired ? opts.paidAt : null,
      taxInvoiceDocumentPath: taxPdf,
      reportCount: 2,
    },
    create: {
      projectId: opts.projectId,
      periodStart: opts.periodStart,
      periodEnd: opts.periodEnd,
      label: opts.label,
      status: InvoicePeriodStatus.PAID,
      amount: new Prisma.Decimal(opts.amount),
      paidAt: opts.paidAt,
      submittedAt: opts.paidAt,
      compiledById: opts.compiledById,
      invoicePdfPath: invoicePdf,
      taxInvoiceRequired: opts.taxInvoiceRequired,
      taxInvoiceDoneAt: opts.taxInvoiceRequired ? opts.paidAt : null,
      taxInvoiceDocumentPath: taxPdf,
      reportCount: 2,
    },
  });
}

export async function seedDemoCompletedProjects(prisma: PrismaClient) {
  const company = await prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!company) {
    throw new Error("No company found. Run the main seed first.");
  }

  await ensureCatalog(prisma, company.id);

  const clients = await prisma.client.findMany({
    where: { companyId: company.id, active: true },
    orderBy: { createdAt: "asc" },
  });
  const gedung =
    clients.find((row) => row.id === "client-gedung-sejahtera") ?? clients[0];
  const nusantara =
    clients.find((row) => row.id === "client-demo-nusantara-properti") ??
    clients[1] ??
    clients[0];
  const mandiri =
    clients.find((row) => row.id === "client-demo-mandiri-facility") ??
    clients[2] ??
    clients[0];
  if (!gedung) {
    throw new Error("No clients found. Run the main seed first.");
  }

  const compiler = await prisma.user.findFirst({
    where: { companyId: company.id, username: { in: ["vicko", "manager"] } },
    select: { id: true },
  });

  const cleaningReg = await catalogPair(
    prisma,
    company.id,
    "CLEANING",
    "REGULAR_CLEANING"
  );
  const cleaningArea = cleaningReg.area;
  const facadeArea = await catalogPair(
    prisma,
    company.id,
    "CLEANING",
    "CONTRACT_FACADE_CLEANING"
  );
  const landOt = await catalogPair(
    prisma,
    company.id,
    "LANDSCAPING",
    "ONE_TIME_LANDSCAPING"
  );

  const contractUrl = await writeUpload("contracts", "demo-completed-contract.pdf");

  const closedJobs = [
    {
      id: "project-demo-completed-gc",
      clientId: gedung.id,
      name: "Demo — Lobby Deep Clean (Closed)",
      description: "One-time general clean — finished and paid.",
      location: "Menara Sejahtera Lobby, Jakarta Pusat",
      latitude: -6.1945,
      longitude: 106.8232,
      subCategory: ProjectSubCategory.GENERAL_CLEANING,
      serviceArea: ServiceArea.CLEANING,
      areaCatalogId: cleaningArea.id,
      subcategoryCatalogId: null,
      contractPrice: 9_800_000,
      startDate: utcDate(2026, 5, 4),
      endDate: utcDate(2026, 5, 12),
      paidAt: utcDate(2026, 5, 18),
      label: "Completion invoice",
      requiresTaxInvoice: true,
    },
    {
      id: "project-demo-completed-facade",
      clientId: (nusantara ?? gedung).id,
      name: "Demo — Podium Glass Wash (Closed)",
      description: "One-time facade wash — finished and paid.",
      location: "Menara Nusantara podium, Jakarta Selatan",
      latitude: -6.2296,
      longitude: 106.8294,
      subCategory: ProjectSubCategory.FACADE_CLEANING,
      serviceArea: ServiceArea.CLEANING,
      areaCatalogId: facadeArea.area.id,
      subcategoryCatalogId: null,
      contractPrice: 21_500_000,
      startDate: utcDate(2026, 6, 2),
      endDate: utcDate(2026, 6, 9),
      paidAt: utcDate(2026, 6, 16),
      label: "Completion invoice",
      requiresTaxInvoice: true,
    },
    {
      id: "project-demo-completed-land",
      clientId: (mandiri ?? gedung).id,
      name: "Demo — Courtyard Replant (Closed)",
      description: "One-time landscaping — finished and paid.",
      location: "Kawasan Industri Rungkut, Surabaya",
      latitude: -7.2582,
      longitude: 112.7528,
      subCategory: ProjectSubCategory.ONE_TIME_LANDSCAPING,
      serviceArea: ServiceArea.LANDSCAPING,
      areaCatalogId: landOt.area.id,
      subcategoryCatalogId: landOt.sub?.id ?? null,
      contractPrice: 16_200_000,
      startDate: utcDate(2026, 7, 6),
      endDate: utcDate(2026, 7, 11),
      paidAt: utcDate(2026, 7, 20),
      label: "Completion invoice",
      requiresTaxInvoice: false,
    },
  ] as const;

  for (const job of closedJobs) {
    const data = {
      name: job.name,
      description: job.description,
      location: job.location,
      latitude: job.latitude,
      longitude: job.longitude,
      locationRadiusMeters: 50,
      clientId: job.clientId,
      status: ProjectStatus.COMPLETED,
      subCategory: job.subCategory,
      serviceArea: job.serviceArea,
      areaCatalogId: job.areaCatalogId,
      subcategoryCatalogId: job.subcategoryCatalogId,
      billingMode: BillingMode.ON_COMPLETION,
      contractPrice: new Prisma.Decimal(job.contractPrice),
      requiresTaxInvoice: job.requiresTaxInvoice,
      chargedTaxKind: job.requiresTaxInvoice ? CommercialTaxKind.PPN : null,
      estimatedStartDate: job.startDate,
      startDate: job.startDate,
      endDate: job.endDate,
      invoicingDay: invoicingDayFromContractStart(job.startDate),
      paymentTermsDays: 14,
      shiftCount: 0,
      progress: 100,
      contractDocumentUrl: contractUrl,
    };
    await prisma.project.upsert({
      where: { id: job.id },
      update: data,
      create: { id: job.id, companyId: company.id, ...data },
    });
    await ensurePaidPeriod(prisma, {
      projectId: job.id,
      periodStart: job.startDate,
      periodEnd: job.endDate,
      label: job.label,
      amount: job.contractPrice,
      paidAt: job.paidAt,
      compiledById: compiler?.id ?? null,
      taxInvoiceRequired: job.requiresTaxInvoice,
    });
  }

  const liveRegular = await prisma.project.findMany({
    where: {
      companyId: company.id,
      status: { in: ["IN_PROGRESS", "WAITING_FOR_APPROVAL", "OFF_SITE"] },
      subCategory: {
        in: [
          "REGULAR_CLEANING",
          "REGULAR_LANDSCAPING",
          "CONTRACT_GENERAL_CLEANING",
          "CONTRACT_FACADE_CLEANING",
          "SECURITY",
        ],
      },
    },
    select: {
      id: true,
      name: true,
      subCategory: true,
      contractPrice: true,
      requiresTaxInvoice: true,
    },
    orderBy: { createdAt: "asc" },
    take: 4,
  });

  const regularTargets = liveRegular.filter((row) =>
    isContractCycleSubCategory(row.subCategory)
  );

  let regularPeriodCount = 0;
  for (const [index, project] of regularTargets.entries()) {
    const amount = Number(project.contractPrice ?? 28_000_000);
    const month = 2 + (index % 2);
    await ensurePaidPeriod(prisma, {
      projectId: project.id,
      periodStart: utcDate(2026, month, 1),
      periodEnd: utcDate(2026, month, month === 2 ? 28 : 31),
      label: month === 2 ? "February 2026" : "March 2026",
      amount,
      paidAt: utcDate(2026, month + 1, 8),
      compiledById: compiler?.id ?? null,
      taxInvoiceRequired: project.requiresTaxInvoice,
    });
    regularPeriodCount += 1;
  }

  if (regularTargets.length === 0) {
    const start = utcDate(2026, 1, 15);
    const regularId = "project-demo-completed-regular-live";
    const data = {
      name: "Demo — Sudirman Daily Clean (Ongoing)",
      description: "Regular contract still In Progress — February is paid.",
      location: "Jl. Sudirman Kav. 12, Jakarta",
      latitude: -6.2146,
      longitude: 106.8227,
      locationRadiusMeters: 50,
      clientId: gedung.id,
      status: ProjectStatus.IN_PROGRESS,
      subCategory: ProjectSubCategory.REGULAR_CLEANING,
      serviceArea: ServiceArea.CLEANING,
      areaCatalogId: cleaningReg.area.id,
      subcategoryCatalogId: cleaningReg.sub?.id ?? null,
      billingMode: BillingMode.MONTHLY,
      contractPrice: new Prisma.Decimal(32_000_000),
      requiresTaxInvoice: true,
      chargedTaxKind: CommercialTaxKind.PPN,
      estimatedStartDate: start,
      startDate: start,
      endDate: utcDate(2026, 12, 14),
      invoicingDay: invoicingDayFromContractStart(start),
      paymentTermsDays: 14,
      shiftCount: 2,
      progress: 40,
      contractDocumentUrl: contractUrl,
    };
    await prisma.project.upsert({
      where: { id: regularId },
      update: data,
      create: { id: regularId, companyId: company.id, ...data },
    });
    await ensurePaidPeriod(prisma, {
      projectId: regularId,
      periodStart: utcDate(2026, 2, 1),
      periodEnd: utcDate(2026, 2, 28),
      label: "February 2026",
      amount: 32_000_000,
      paidAt: utcDate(2026, 3, 8),
      compiledById: compiler?.id ?? null,
      taxInvoiceRequired: true,
    });
    regularPeriodCount += 1;
  }

  console.log("✅ Demo completed-projects seed complete");
  console.log(`  • Closed projects: ${closedJobs.length}`);
  console.log(`  • Paid regular periods: ${regularPeriodCount}`);
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1]
    .replace(/\\/g, "/")
    .endsWith("prisma/seed-demo-completed-projects.ts");

if (isDirectRun) {
  const prisma = new PrismaClient();
  seedDemoCompletedProjects(prisma)
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
