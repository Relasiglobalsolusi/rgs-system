/**
 * One-off sample data: General Cleaning + Facade Cleaning projects.
 * Does not touch Regular Cleaning projects.
 *
 * Usage: npx tsx scripts/seed-general-facade-projects.ts
 */
import {
  BillingMode,
  InvoicePeriodStatus,
  PrismaClient,
  ProjectStatus,
  ProjectSubCategory,
} from "@prisma/client";

const prisma = new PrismaClient();

const COMPANY_ID = "rgs-company";
const CLIENT_LEBIH_CEPAT = "cmrm5m2bq0003vpnou3sr4x8v";
const CLIENT_TEST = "client-gedung-sejahtera";

type SampleProject = {
  id: string;
  name: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  subCategory: ProjectSubCategory;
  billingMode: BillingMode;
  status: ProjectStatus;
  clientId: string;
  startDate: Date;
  endDate: Date;
  contractPrice: number | null;
  progress: number;
};

const samples: SampleProject[] = [
  // --- General Cleaning ---
  {
    id: "sample-gc-grand-indonesia",
    name: "Grand Indonesia Lobby Deep Clean",
    description:
      "Deep cleaning of main lobby, atrium floors, and restrooms after event season.",
    location:
      "Grand Indonesia, Jl. M.H. Thamrin No.1, Menteng, Jakarta Pusat 10310",
    latitude: -6.1951,
    longitude: 106.8209,
    subCategory: ProjectSubCategory.GENERAL_CLEANING,
    billingMode: BillingMode.MILESTONE,
    status: ProjectStatus.IN_PROGRESS,
    clientId: CLIENT_LEBIH_CEPAT,
    startDate: new Date("2026-06-01"),
    endDate: new Date("2026-08-31"),
    contractPrice: 85_000_000,
    progress: 35,
  },
  {
    id: "sample-gc-pacific-place",
    name: "Pacific Place Post-Renovation Clean",
    description:
      "Post-renovation general cleaning for retail corridors and service corridors.",
    location:
      "Pacific Place, Jl. Jend. Sudirman Kav. 52-53, SCBD, Jakarta Selatan 12190",
    latitude: -6.2257,
    longitude: 106.8096,
    subCategory: ProjectSubCategory.GENERAL_CLEANING,
    billingMode: BillingMode.ON_COMPLETION,
    status: ProjectStatus.IN_PROGRESS,
    clientId: CLIENT_LEBIH_CEPAT,
    startDate: new Date("2026-07-01"),
    endDate: new Date("2026-07-31"),
    contractPrice: 42_000_000,
    progress: 10,
  },
  {
    id: "sample-gc-kemang-village",
    name: "Kemang Village Common Area Clean",
    description:
      "General cleaning of residential tower lobbies, lift landings, and amenity floors.",
    location:
      "Kemang Village, Jl. Pangeran Antasari No.36, Kemang, Jakarta Selatan 12150",
    latitude: -6.2605,
    longitude: 106.8133,
    subCategory: ProjectSubCategory.GENERAL_CLEANING,
    billingMode: BillingMode.MILESTONE,
    status: ProjectStatus.IN_PROGRESS,
    clientId: CLIENT_TEST,
    startDate: new Date("2026-05-15"),
    endDate: new Date("2026-09-15"),
    contractPrice: 68_000_000,
    progress: 45,
  },
  // --- Facade Cleaning ---
  {
    id: "sample-fc-menara-bca",
    name: "Menara BCA Glass Facade Wash",
    description:
      "Exterior glass facade cleaning for podium and mid-level curtain wall panels.",
    location:
      "Menara BCA, Jl. M.H. Thamrin No.1, Menteng, Jakarta Pusat 10310",
    latitude: -6.1975,
    longitude: 106.8228,
    subCategory: ProjectSubCategory.FACADE_CLEANING,
    billingMode: BillingMode.MILESTONE,
    status: ProjectStatus.IN_PROGRESS,
    clientId: CLIENT_LEBIH_CEPAT,
    startDate: new Date("2026-06-15"),
    endDate: new Date("2026-10-15"),
    contractPrice: 120_000_000,
    progress: 25,
  },
  {
    id: "sample-fc-wisma-46",
    name: "Wisma 46 Exterior Facade Clean",
    description:
      "High-rise facade wash for exterior cladding and window modules.",
    location:
      "Wisma 46, Jl. Jend. Sudirman Kav. 1, Tanah Abang, Jakarta Pusat 10220",
    latitude: -6.2035,
    longitude: 106.8219,
    subCategory: ProjectSubCategory.FACADE_CLEANING,
    billingMode: BillingMode.ON_COMPLETION,
    status: ProjectStatus.IN_PROGRESS,
    clientId: CLIENT_LEBIH_CEPAT,
    startDate: new Date("2026-07-05"),
    endDate: new Date("2026-08-20"),
    contractPrice: 55_000_000,
    progress: 5,
  },
  {
    id: "sample-fc-ciputra-world",
    name: "Ciputra World Kuningan Facade Maintenance",
    description:
      "Scheduled facade maintenance and glass cleaning for tower podium levels.",
    location:
      "Ciputra World, Jl. Prof. DR. Satrio Kav. 3-5, Kuningan, Jakarta Selatan 12940",
    latitude: -6.2242,
    longitude: 106.8265,
    subCategory: ProjectSubCategory.FACADE_CLEANING,
    billingMode: BillingMode.MILESTONE,
    status: ProjectStatus.IN_PROGRESS,
    clientId: CLIENT_LEBIH_CEPAT,
    startDate: new Date("2026-04-01"),
    endDate: new Date("2026-09-30"),
    contractPrice: 95_000_000,
    progress: 55,
  },
];

async function main() {
  const clientIds = [...new Set(samples.map((s) => s.clientId))];
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, name: true },
  });
  if (clients.length !== clientIds.length) {
    const found = new Set(clients.map((c) => c.id));
    const missing = clientIds.filter((id) => !found.has(id));
    throw new Error(`Missing clients: ${missing.join(", ")}`);
  }

  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company) throw new Error(`Company ${COMPANY_ID} not found`);

  const created: Array<{
    name: string;
    subCategory: string;
    client: string;
    billingMode: string;
  }> = [];

  for (const s of samples) {
    const clientName = clients.find((c) => c.id === s.clientId)!.name;
    await prisma.project.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        description: s.description,
        location: s.location,
        latitude: s.latitude,
        longitude: s.longitude,
        locationRadiusMeters: 50,
        startDate: s.startDate,
        endDate: s.endDate,
        progress: s.progress,
        status: s.status,
        subCategory: s.subCategory,
        billingMode: s.billingMode,
        contractPrice: s.contractPrice,
        companyId: COMPANY_ID,
        clientId: s.clientId,
      },
      create: {
        id: s.id,
        name: s.name,
        description: s.description,
        location: s.location,
        latitude: s.latitude,
        longitude: s.longitude,
        locationRadiusMeters: 50,
        startDate: s.startDate,
        endDate: s.endDate,
        progress: s.progress,
        status: s.status,
        subCategory: s.subCategory,
        billingMode: s.billingMode,
        contractPrice: s.contractPrice,
        companyId: COMPANY_ID,
        clientId: s.clientId,
      },
    });
    created.push({
      name: s.name,
      subCategory: s.subCategory,
      client: clientName,
      billingMode: s.billingMode,
    });

    // Demo schedule: 25 / 50 / 75 / 100 — first awaiting payment, rest ready to invoice.
    if (s.billingMode === BillingMode.MILESTONE && s.contractPrice != null) {
      const cumulatives = [25, 50, 75, 100];
      let prev = 0;
      for (let i = 0; i < cumulatives.length; i++) {
        const cumulative = cumulatives[i]!;
        const slice = cumulative - prev;
        const periodStart = new Date(s.startDate);
        periodStart.setUTCDate(periodStart.getUTCDate() + i);
        const periodEnd = new Date(periodStart);
        const amount = Math.round(s.contractPrice * (slice / 100));
        const isFirst = i === 0;
        const dueAt = new Date();
        dueAt.setUTCDate(dueAt.getUTCDate() + 7);

        await prisma.projectInvoicePeriod.upsert({
          where: {
            projectId_periodStart_periodEnd: {
              projectId: s.id,
              periodStart,
              periodEnd,
            },
          },
          update: {
            label: `Milestone ${cumulative}%`,
            status: isFirst
              ? InvoicePeriodStatus.AWAITING_PAYMENT
              : InvoicePeriodStatus.ONGOING,
            amount,
            milestonePercent: cumulative,
            ...(isFirst
              ? { submittedAt: new Date(), dueAt }
              : { submittedAt: null, dueAt: null }),
          },
          create: {
            projectId: s.id,
            periodStart,
            periodEnd,
            label: `Milestone ${cumulative}%`,
            status: isFirst
              ? InvoicePeriodStatus.AWAITING_PAYMENT
              : InvoicePeriodStatus.ONGOING,
            amount,
            milestonePercent: cumulative,
            ...(isFirst
              ? {
                  submittedAt: new Date(),
                  dueAt,
                  taxInvoiceRequired: true,
                }
              : {}),
          },
        });
        prev = cumulative;
      }
    }
  }

  // Verify Regular Cleaning untouched and filters would work
  const regular = await prisma.project.findMany({
    where: { subCategory: ProjectSubCategory.REGULAR_CLEANING },
    select: { id: true, name: true },
  });
  const general = await prisma.project.findMany({
    where: { subCategory: ProjectSubCategory.GENERAL_CLEANING },
    select: { id: true, name: true, status: true },
  });
  const facade = await prisma.project.findMany({
    where: { subCategory: ProjectSubCategory.FACADE_CLEANING },
    select: { id: true, name: true, status: true },
  });

  console.log(JSON.stringify({ created, regular, general, facade }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
