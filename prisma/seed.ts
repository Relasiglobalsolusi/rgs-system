import {
  PrismaClient,
  Prisma,
  UserRole,
  EmployeeType,
  EmploymentType,
  Placement,
  ProjectStatus,
  ProjectSubCategory,
  EmploymentStatus,
  BillingMode,
  InvoicePeriodStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  defaultWebsiteContent,
  toWebsiteContentJson,
} from "../lib/website-content";
import {
  getClientModuleOverrides,
  getEmployeeModuleOverrides,
} from "../lib/permissions";
import {
  ensureDefaultPositions,
  normalizePositionTitleCase,
  retireFinanceDepartments,
} from "../lib/positions";
import {
  contractCyclePeriodBounds,
  invoicingDayFromContractStart,
} from "../lib/invoice-period";
import { buildBillingDocumentFileBase } from "../lib/upload";
import {
  SAMPLE_VENDORS,
  seedSampleVendors,
} from "./seed-vendors";

const prisma = new PrismaClient();

/** Minimal valid PDF for demo purchase-invoice attachments. */
const DEMO_PDF = Buffer.from(
  "%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf8"
);

/** Stable UTC calendar date for seed invoice periods. */
function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

async function ensureDemoPurchaseInvoiceFile(filename: string): Promise<string> {
  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "purchase-invoices"
  );
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), DEMO_PDF);
  return `/uploads/purchase-invoices/${filename}`;
}

async function main() {
  console.log("🌱 Seeding database...");

  const company = await prisma.company.upsert({
    where: { id: "rgs-company" },
    update: {},
    create: {
      id: "rgs-company",
      name: "Relasi Global Solusi",
      email: "vicko@rgs.co.id",
      phone: "+62 21 0000000",
      address: "Jakarta, Indonesia",
    },
  });

  const department = await prisma.department.upsert({
    where: { code: "CLN" },
    update: {},
    create: {
      name: "Cleaning Service",
      code: "CLN",
      description: "Staff operations",
      companyId: company.id,
    },
  });

  // Workforce departments only — Corporate / Operations (finance roles are Corporate positions)
  const defaultCategories = [
    { slug: "corporate", name: "Corporate", prefix: "COR", sortOrder: 10 },
    { slug: "operations", name: "Operations", prefix: "OPR", sortOrder: 20 },
  ] as const;

  // Retire legacy department categories if still present
  const retired = await prisma.employeeCategory.findMany({
    where: {
      companyId: company.id,
      OR: [
        { prefix: { in: ["UNA", "CS", "GCS", "GON", "HO"] } },
        {
          slug: {
            in: [
              "unassign",
              "cleaning-staff",
              "general-cleaning-staff",
              "gondola",
              "head-office",
            ],
          },
        },
      ],
    },
    select: { id: true, slug: true, prefix: true },
  });
  for (const row of retired) {
    if (row.slug === "head-office" || row.prefix === "HO") {
      await prisma.employeeCategory.update({
        where: { id: row.id },
        data: {
          name: "Corporate",
          slug: "corporate",
          prefix: "COR",
          sortOrder: 10,
          active: true,
        },
      });
      continue;
    }
    await prisma.employee.updateMany({
      where: { categoryId: row.id },
      data: { categoryId: null },
    });
    await prisma.employeeCategory.delete({ where: { id: row.id } }).catch(() => {
      /* may already be gone */
    });
  }

  const categories: Record<string, { id: string }> = {};

  for (const item of defaultCategories) {
    const category = await prisma.employeeCategory.upsert({
      where: {
        companyId_slug: {
          companyId: company.id,
          slug: item.slug,
        },
      },
      update: {
        name: item.name,
        prefix: item.prefix,
        sortOrder: item.sortOrder,
        active: true,
      },
      create: {
        name: item.name,
        slug: item.slug,
        prefix: item.prefix,
        sortOrder: item.sortOrder,
        companyId: company.id,
        active: true,
      },
    });
    categories[item.slug] = category;
  }

  await retireFinanceDepartments(prisma);
  await ensureDefaultPositions(prisma, company.id);
  await normalizePositionTitleCase(prisma, company.id);

  const cleaningPosition = await prisma.position.findFirst({
    where: {
      companyId: company.id,
      categoryId: categories.operations.id,
      slug: "cleaning-staff",
    },
  });
  const gcPosition = await prisma.position.findFirst({
    where: {
      companyId: company.id,
      categoryId: categories.operations.id,
      slug: "gc-staff",
    },
  });
  const directorPosition = await prisma.position.findFirst({
    where: {
      companyId: company.id,
      categoryId: categories.corporate.id,
      slug: "director",
    },
  });

  // --- Demo ERP clients (upsert by stable ids; safe to re-run) ---
  const demoClient = await prisma.client.upsert({
    where: { id: "client-gedung-sejahtera" },
    update: {
      name: "PT Gedung Sejahtera",
      email: "contact@gedungsejahtera.co.id",
      phone: "+62 21 5551234",
      address: "Jl. Thamrin No. 88, Jakarta Pusat",
      npwp: "012345678901000",
      contactPersonFirstName: "Budi",
      contactPersonLastName: "Santoso",
      contactPersonPosition: "Procurement Manager",
      contactPersonEmail: "budi.santoso@gedungsejahtera.co.id",
      contactPersonPhone: "+62 812 3456 7890",
      active: true,
    },
    create: {
      id: "client-gedung-sejahtera",
      name: "PT Gedung Sejahtera",
      shortCode: "C001",
      email: "contact@gedungsejahtera.co.id",
      phone: "+62 21 5551234",
      address: "Jl. Thamrin No. 88, Jakarta Pusat",
      npwp: "012345678901000",
      contactPersonFirstName: "Budi",
      contactPersonLastName: "Santoso",
      contactPersonPosition: "Procurement Manager",
      contactPersonEmail: "budi.santoso@gedungsejahtera.co.id",
      contactPersonPhone: "+62 812 3456 7890",
      companyId: company.id,
    },
  });

  const demoClientNusantara = await prisma.client.upsert({
    where: { id: "client-demo-nusantara-properti" },
    update: {
      name: "Demo — PT Nusantara Properti",
      email: "procurement@nusantaraproperti.co.id",
      phone: "+62 21 2928 4500",
      address: "Jl. Gatot Subroto Kav. 18, Jakarta Selatan",
      npwp: "109876543210000",
      contactPersonFirstName: "Dewi",
      contactPersonLastName: "Lestari",
      contactPersonPosition: "Facility Manager",
      contactPersonEmail: "dewi.lestari@nusantaraproperti.co.id",
      contactPersonPhone: "+62 811 2233 4455",
      active: true,
    },
    create: {
      id: "client-demo-nusantara-properti",
      name: "Demo — PT Nusantara Properti",
      shortCode: "C002",
      email: "procurement@nusantaraproperti.co.id",
      phone: "+62 21 2928 4500",
      address: "Jl. Gatot Subroto Kav. 18, Jakarta Selatan",
      npwp: "109876543210000",
      contactPersonFirstName: "Dewi",
      contactPersonLastName: "Lestari",
      contactPersonPosition: "Facility Manager",
      contactPersonEmail: "dewi.lestari@nusantaraproperti.co.id",
      contactPersonPhone: "+62 811 2233 4455",
      companyId: company.id,
    },
  });

  const demoClientMandiri = await prisma.client.upsert({
    where: { id: "client-demo-mandiri-facility" },
    update: {
      name: "Demo — CV Mandiri Facility",
      email: "ops@mandirifacility.id",
      phone: "+62 31 5482 1100",
      address: "Jl. Basuki Rahmat No. 45, Surabaya",
      npwp: null,
      contactPersonFirstName: "Andi",
      contactPersonLastName: "Prasetyo",
      contactPersonPosition: "Operations Lead",
      contactPersonEmail: "andi.prasetyo@mandirifacility.id",
      contactPersonPhone: "+62 813 7788 9900",
      active: true,
    },
    create: {
      id: "client-demo-mandiri-facility",
      name: "Demo — CV Mandiri Facility",
      shortCode: "C003",
      email: "ops@mandirifacility.id",
      phone: "+62 31 5482 1100",
      address: "Jl. Basuki Rahmat No. 45, Surabaya",
      contactPersonFirstName: "Andi",
      contactPersonLastName: "Prasetyo",
      contactPersonPosition: "Operations Lead",
      contactPersonEmail: "andi.prasetyo@mandirifacility.id",
      contactPersonPhone: "+62 813 7788 9900",
      companyId: company.id,
    },
  });

  const passwordHash = await bcrypt.hash("admin123", 12);
  const managerHash = await bcrypt.hash("manager123", 12);
  const staffHash = await bcrypt.hash("staff123", 12);
  const clientHash = await bcrypt.hash("client123", 12);

  const employeeModuleOverrides = getEmployeeModuleOverrides({
    placement: "ON_PROJECT",
    employeeType: "PROJECT_SITE",
  });
  const clientModuleOverrides = getClientModuleOverrides();

  const vickoUser = await prisma.user.upsert({
    where: { username: "vicko" },
    update: {
      passwordHash,
      mustSetPassword: false,
      role: UserRole.ADMIN,
      email: "vicko@rgs.co.id",
      name: "Vicko Liem",
      moduleOverrides: Prisma.DbNull,
    },
    create: {
      name: "Vicko Liem",
      username: "vicko",
      email: "vicko@rgs.co.id",
      passwordHash,
      mustSetPassword: false,
      role: UserRole.ADMIN,
      companyId: company.id,
    },
  });

  await prisma.user.upsert({
    where: { username: "manager" },
    update: {
      passwordHash: managerHash,
      mustSetPassword: false,
      role: UserRole.ADMIN,
      email: "manager@rgs.co.id",
      name: "Manager RGS",
    },
    create: {
      name: "Manager RGS",
      username: "manager",
      email: "manager@rgs.co.id",
      passwordHash: managerHash,
      mustSetPassword: false,
      role: UserRole.ADMIN,
      companyId: company.id,
    },
  });

  const staffUser = await prisma.user.upsert({
    where: { username: "site" },
    update: {
      passwordHash: staffHash,
      mustSetPassword: false,
      role: UserRole.ADMIN,
      email: "site@rgs.co.id",
      name: "Budi Santoso",
      active: true,
      moduleOverrides: employeeModuleOverrides,
    },
    create: {
      name: "Budi Santoso",
      username: "site",
      email: "site@rgs.co.id",
      passwordHash: staffHash,
      mustSetPassword: false,
      role: UserRole.ADMIN,
      companyId: company.id,
      active: true,
      moduleOverrides: employeeModuleOverrides,
    },
  });

  const staff2User = await prisma.user.upsert({
    where: { username: "site2" },
    update: {
      passwordHash: staffHash,
      mustSetPassword: false,
      role: UserRole.ADMIN,
      email: "site2@rgs.co.id",
      name: "Siti Aminah",
      active: true,
      moduleOverrides: employeeModuleOverrides,
    },
    create: {
      name: "Siti Aminah",
      username: "site2",
      email: "site2@rgs.co.id",
      passwordHash: staffHash,
      mustSetPassword: false,
      role: UserRole.ADMIN,
      companyId: company.id,
      active: true,
      moduleOverrides: employeeModuleOverrides,
    },
  });

  await prisma.user.upsert({
    where: { username: "office" },
    update: {
      passwordHash: staffHash,
      mustSetPassword: false,
      role: UserRole.ADMIN,
      email: "office@rgs.co.id",
      name: "Rina Wijaya",
    },
    create: {
      name: "Rina Wijaya",
      username: "office",
      email: "office@rgs.co.id",
      passwordHash: staffHash,
      mustSetPassword: false,
      role: UserRole.ADMIN,
      companyId: company.id,
    },
  });

  await prisma.user.upsert({
    where: { username: "client" },
    update: {
      passwordHash: clientHash,
      mustSetPassword: false,
      role: UserRole.ADMIN,
      clientId: demoClient.id,
      email: "client@rgs.co.id",
      name: "Portal PT Gedung Sejahtera",
      moduleOverrides: clientModuleOverrides,
    },
    create: {
      name: "Portal PT Gedung Sejahtera",
      username: "client",
      email: "client@rgs.co.id",
      passwordHash: clientHash,
      mustSetPassword: false,
      role: UserRole.ADMIN,
      companyId: company.id,
      clientId: demoClient.id,
      moduleOverrides: clientModuleOverrides,
    },
  });

  // Demo staff must be fully restored on reseed. Never re-link logins onto
  // forever-archived tombstones while leaving archivedFromDirectory=true
  // (that produced Active Users with no Employee Directory row).
  const staff1 = await prisma.employee.upsert({
    where: { employeeNo: "OPR-001" },
    update: {
      userId: staffUser.id,
      firstName: "Budi",
      lastName: "Santoso",
      email: "site@rgs.co.id",
      status: EmploymentStatus.ACTIVE,
      archivedFromDirectory: false,
      employeeType: EmployeeType.PROJECT_SITE,
      employmentType: EmploymentType.FULL_TIME,
      placement: Placement.ON_PROJECT,
      portalAccessRequested: true,
      categoryId: categories.operations.id,
      positionId: cleaningPosition?.id ?? null,
      position: cleaningPosition?.name ?? "Cleaning staff",
    },
    create: {
      employeeNo: "OPR-001",
      firstName: "Budi",
      lastName: "Santoso",
      email: "site@rgs.co.id",
      phone: "+62 812 0000 0001",
      employeeType: EmployeeType.PROJECT_SITE,
      employmentType: EmploymentType.FULL_TIME,
      placement: Placement.ON_PROJECT,
      portalAccessRequested: true,
      categoryId: categories.operations.id,
      positionId: cleaningPosition?.id ?? null,
      position: cleaningPosition?.name ?? "Cleaning staff",
      status: EmploymentStatus.ACTIVE,
      archivedFromDirectory: false,
      companyId: company.id,
      departmentId: department.id,
      userId: staffUser.id,
      hiredAt: new Date("2024-01-15"),
    },
  });

  const staff2 = await prisma.employee.upsert({
    where: { employeeNo: "OPR-002" },
    update: {
      userId: staff2User.id,
      firstName: "Siti",
      lastName: "Aminah",
      email: "site2@rgs.co.id",
      status: EmploymentStatus.ACTIVE,
      archivedFromDirectory: false,
      employeeType: EmployeeType.PROJECT_SITE,
      employmentType: EmploymentType.FULL_TIME,
      placement: Placement.ON_PROJECT,
      portalAccessRequested: true,
      categoryId: categories.operations.id,
      positionId: gcPosition?.id ?? null,
      position: gcPosition?.name ?? "GC staff",
    },
    create: {
      employeeNo: "OPR-002",
      firstName: "Siti",
      lastName: "Aminah",
      email: "site2@rgs.co.id",
      phone: "+62 812 0000 0002",
      employeeType: EmployeeType.PROJECT_SITE,
      employmentType: EmploymentType.FULL_TIME,
      placement: Placement.ON_PROJECT,
      portalAccessRequested: true,
      categoryId: categories.operations.id,
      positionId: gcPosition?.id ?? null,
      position: gcPosition?.name ?? "GC staff",
      status: EmploymentStatus.ACTIVE,
      archivedFromDirectory: false,
      companyId: company.id,
      departmentId: department.id,
      userId: staff2User.id,
      hiredAt: new Date("2024-03-01"),
    },
  });

  await prisma.employee.upsert({
    where: { employeeNo: "COR-001" },
    update: {
      userId: vickoUser.id,
      firstName: "Vicko",
      lastName: "Liem",
      email: "vicko@rgs.co.id",
      employeeType: EmployeeType.HEAD_OFFICE,
      employmentType: EmploymentType.FULL_TIME,
      placement: Placement.HEAD_OFFICE,
      portalAccessRequested: true,
      categoryId: categories.corporate.id,
      positionId: directorPosition?.id ?? null,
      position: directorPosition?.name ?? "Director",
    },
    create: {
      employeeNo: "COR-001",
      firstName: "Vicko",
      lastName: "Liem",
      email: "vicko@rgs.co.id",
      phone: "+62 812 0000 0003",
      employeeType: EmployeeType.HEAD_OFFICE,
      employmentType: EmploymentType.FULL_TIME,
      placement: Placement.HEAD_OFFICE,
      portalAccessRequested: true,
      categoryId: categories.corporate.id,
      positionId: directorPosition?.id ?? null,
      position: directorPosition?.name ?? "Director",
      status: EmploymentStatus.ACTIVE,
      companyId: company.id,
      departmentId: department.id,
      userId: vickoUser.id,
      hiredAt: new Date("2024-02-01"),
    },
  });

  // --- Demo ERP projects across clients (billing / tax variety) ---
  // Demo Regular Cleaning start: 15 May 2026 → anniversary cycles / invoice on 16th.
  const project1Start = utcDate(2026, 5, 15);
  const project1 = await prisma.project.upsert({
    where: { id: "project-gedung-a" },
    update: {
      name: "Cleaning Gedung A",
      clientId: demoClient.id,
      latitude: -6.2088,
      longitude: 106.8456,
      locationRadiusMeters: 50,
      startDate: project1Start,
      estimatedStartDate: project1Start,
      subCategory: ProjectSubCategory.REGULAR_CLEANING,
      billingMode: BillingMode.MONTHLY,
      contractPrice: 45_000_000,
      invoicingDay: invoicingDayFromContractStart(project1Start),
      requiresTaxInvoice: true,
      status: ProjectStatus.IN_PROGRESS,
    },
    create: {
      id: "project-gedung-a",
      name: "Cleaning Gedung A",
      description: "Daily cleaning service for Office Tower A",
      location: "Jl. Sudirman No. 10, Jakarta",
      latitude: -6.2088,
      longitude: 106.8456,
      locationRadiusMeters: 50,
      startDate: project1Start,
      estimatedStartDate: project1Start,
      endDate: new Date("2026-12-31"),
      progress: 35,
      status: ProjectStatus.IN_PROGRESS,
      subCategory: ProjectSubCategory.REGULAR_CLEANING,
      billingMode: BillingMode.MONTHLY,
      contractPrice: 45_000_000,
      invoicingDay: invoicingDayFromContractStart(project1Start),
      requiresTaxInvoice: true,
      companyId: company.id,
      clientId: demoClient.id,
    },
  });

  const project2 = await prisma.project.upsert({
    where: { id: "project-mall-b" },
    update: {
      name: "Cleaning Mall B",
      clientId: demoClient.id,
      latitude: -6.1574,
      longitude: 106.9073,
      locationRadiusMeters: 50,
      subCategory: ProjectSubCategory.GENERAL_CLEANING,
      billingMode: BillingMode.MILESTONE,
      contractPrice: 75_000_000,
      requiresTaxInvoice: true,
      status: ProjectStatus.IN_PROGRESS,
    },
    create: {
      id: "project-mall-b",
      name: "Cleaning Mall B",
      description: "Mall common area cleaning",
      location: "Mall Kelapa Gading, Jakarta Utara",
      latitude: -6.1574,
      longitude: 106.9073,
      locationRadiusMeters: 50,
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-09-30"),
      progress: 60,
      status: ProjectStatus.IN_PROGRESS,
      subCategory: ProjectSubCategory.GENERAL_CLEANING,
      billingMode: BillingMode.MILESTONE,
      contractPrice: 75_000_000,
      requiresTaxInvoice: true,
      companyId: company.id,
      clientId: demoClient.id,
    },
  });

  const project3 = await prisma.project.upsert({
    where: { id: "project-demo-menara-nusantara" },
    update: {
      name: "Demo — Menara Nusantara Daily Clean",
      clientId: demoClientNusantara.id,
      latitude: -6.2297,
      longitude: 106.8295,
      locationRadiusMeters: 60,
      subCategory: ProjectSubCategory.REGULAR_CLEANING,
      billingMode: BillingMode.MONTHLY,
      contractPrice: 28_000_000,
      invoicingDay: 1,
      requiresTaxInvoice: true,
      status: ProjectStatus.IN_PROGRESS,
    },
    create: {
      id: "project-demo-menara-nusantara",
      name: "Demo — Menara Nusantara Daily Clean",
      description: "Regular cleaning for lobby, lift, and office floors",
      location: "Menara Nusantara, Jl. Gatot Subroto Kav. 18, Jakarta Selatan",
      latitude: -6.2297,
      longitude: 106.8295,
      locationRadiusMeters: 60,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2027-06-30"),
      progress: 15,
      status: ProjectStatus.IN_PROGRESS,
      subCategory: ProjectSubCategory.REGULAR_CLEANING,
      billingMode: BillingMode.MONTHLY,
      contractPrice: 28_000_000,
      invoicingDay: 1,
      requiresTaxInvoice: true,
      companyId: company.id,
      clientId: demoClientNusantara.id,
    },
  });

  const project4 = await prisma.project.upsert({
    where: { id: "project-demo-nusantara-lobby" },
    update: {
      name: "Demo — Nusantara Lobby Deep Clean",
      clientId: demoClientNusantara.id,
      latitude: -6.2298,
      longitude: 106.8297,
      locationRadiusMeters: 50,
      subCategory: ProjectSubCategory.GENERAL_CLEANING,
      billingMode: BillingMode.MILESTONE,
      contractPrice: 95_000_000,
      requiresTaxInvoice: true,
      status: ProjectStatus.IN_PROGRESS,
    },
    create: {
      id: "project-demo-nusantara-lobby",
      name: "Demo — Nusantara Lobby Deep Clean",
      description: "Post-event deep clean of main lobby and atrium",
      location: "Menara Nusantara Lobby, Jakarta Selatan",
      latitude: -6.2298,
      longitude: 106.8297,
      locationRadiusMeters: 50,
      startDate: new Date("2026-06-15"),
      endDate: new Date("2026-09-15"),
      progress: 30,
      status: ProjectStatus.IN_PROGRESS,
      subCategory: ProjectSubCategory.GENERAL_CLEANING,
      billingMode: BillingMode.MILESTONE,
      contractPrice: 95_000_000,
      requiresTaxInvoice: true,
      companyId: company.id,
      clientId: demoClientNusantara.id,
    },
  });

  const project5 = await prisma.project.upsert({
    where: { id: "project-demo-mandiri-warehouse" },
    update: {
      name: "Demo — Warehouse Floor Polish",
      clientId: demoClientMandiri.id,
      latitude: -7.2575,
      longitude: 112.7521,
      locationRadiusMeters: 80,
      subCategory: ProjectSubCategory.GENERAL_CLEANING,
      billingMode: BillingMode.ON_COMPLETION,
      contractPrice: 35_000_000,
      requiresTaxInvoice: false,
      status: ProjectStatus.IN_PROGRESS,
    },
    create: {
      id: "project-demo-mandiri-warehouse",
      name: "Demo — Warehouse Floor Polish",
      description: "One-shot floor polishing and general clean for warehouse A",
      location: "Kawasan Industri Rungkut, Surabaya",
      latitude: -7.2575,
      longitude: 112.7521,
      locationRadiusMeters: 80,
      startDate: new Date("2026-07-05"),
      endDate: new Date("2026-07-31"),
      progress: 20,
      status: ProjectStatus.IN_PROGRESS,
      subCategory: ProjectSubCategory.GENERAL_CLEANING,
      billingMode: BillingMode.ON_COMPLETION,
      contractPrice: 35_000_000,
      requiresTaxInvoice: false,
      companyId: company.id,
      clientId: demoClientMandiri.id,
    },
  });

  await prisma.project.upsert({
    where: { id: "project-demo-mandiri-facade" },
    update: {
      name: "Demo — Facade Trial Site",
      clientId: demoClientMandiri.id,
      latitude: -7.265,
      longitude: 112.748,
      locationRadiusMeters: 50,
      subCategory: ProjectSubCategory.FACADE_CLEANING,
      billingMode: BillingMode.ON_COMPLETION,
      contractPrice: 48_000_000,
      requiresTaxInvoice: false,
      status: ProjectStatus.PLANNED,
      estimatedStartDate: new Date("2026-08-01"),
      startDate: null,
      endDate: null,
    },
    create: {
      id: "project-demo-mandiri-facade",
      name: "Demo — Facade Trial Site",
      description: "Planned exterior glass wash for mid-rise office (no tax)",
      location: "Jl. Embong Malang No. 12, Surabaya",
      latitude: -7.265,
      longitude: 112.748,
      locationRadiusMeters: 50,
      estimatedStartDate: new Date("2026-08-01"),
      startDate: null,
      endDate: null,
      progress: 0,
      status: ProjectStatus.PLANNED,
      subCategory: ProjectSubCategory.FACADE_CLEANING,
      billingMode: BillingMode.ON_COMPLETION,
      contractPrice: 48_000_000,
      requiresTaxInvoice: false,
      companyId: company.id,
      clientId: demoClientMandiri.id,
    },
  });

  // Second Planning example — agreed Regular Cleaning awaiting work order (no invoice periods).
  await prisma.project.upsert({
    where: { id: "project-demo-nusantara-standby" },
    update: {
      name: "Demo — Lobby Standby (Awaiting WO)",
      clientId: demoClientNusantara.id,
      latitude: -6.1944,
      longitude: 106.8229,
      locationRadiusMeters: 60,
      subCategory: ProjectSubCategory.REGULAR_CLEANING,
      billingMode: BillingMode.MONTHLY,
      contractPrice: 28_000_000,
      invoicingDay: 1,
      requiresTaxInvoice: true,
      status: ProjectStatus.PLANNED,
      estimatedStartDate: new Date("2026-09-01"),
      startDate: null,
      endDate: new Date("2027-08-31"),
    },
    create: {
      id: "project-demo-nusantara-standby",
      name: "Demo — Lobby Standby (Awaiting WO)",
      description:
        "Agreed lobby/common-area standby — lobbying done, waiting for work order",
      location: "Plaza Indonesia, Jakarta",
      latitude: -6.1944,
      longitude: 106.8229,
      locationRadiusMeters: 60,
      estimatedStartDate: new Date("2026-09-01"),
      startDate: null,
      endDate: new Date("2027-08-31"),
      progress: 0,
      status: ProjectStatus.PLANNED,
      subCategory: ProjectSubCategory.REGULAR_CLEANING,
      billingMode: BillingMode.MONTHLY,
      contractPrice: 28_000_000,
      invoicingDay: 1,
      requiresTaxInvoice: true,
      companyId: company.id,
      clientId: demoClientNusantara.id,
    },
  });

  const assignments = [
    {
      projectId: project1.id,
      employeeId: staff1.id,
      shiftStart: "06:30",
      shiftEnd: "14:30",
    },
    {
      projectId: project1.id,
      employeeId: staff2.id,
      shiftStart: "13:30",
      shiftEnd: "21:30",
    },
    {
      projectId: project2.id,
      employeeId: staff2.id,
      shiftStart: "22:00",
      shiftEnd: "06:00",
    },
    {
      projectId: project3.id,
      employeeId: staff1.id,
      shiftStart: "07:00",
      shiftEnd: "15:00",
    },
    {
      projectId: project4.id,
      employeeId: staff2.id,
      shiftStart: "08:00",
      shiftEnd: "16:00",
    },
    {
      projectId: project5.id,
      employeeId: staff1.id,
      shiftStart: "08:00",
      shiftEnd: "17:00",
    },
  ] as const;

  for (const a of assignments) {
    await prisma.projectAssignment.upsert({
      where: {
        projectId_employeeId: {
          projectId: a.projectId,
          employeeId: a.employeeId,
        },
      },
      update: { shiftStart: a.shiftStart, shiftEnd: a.shiftEnd },
      create: {
        projectId: a.projectId,
        employeeId: a.employeeId,
        shiftStart: a.shiftStart,
        shiftEnd: a.shiftEnd,
      },
    });
  }

  // Anniversary cycles from 15 May 2026 (period 1 paid, period 2 ongoing).
  const project1Cycle1 = contractCyclePeriodBounds(project1Start, 1);
  const project1Cycle2 = contractCyclePeriodBounds(project1Start, 2);
  const julyStart = utcDate(2026, 7, 1);
  const julyEnd = utcDate(2026, 7, 31);
  const paidAt = new Date("2026-07-10T03:00:00.000Z");
  const submittedAt = new Date("2026-07-02T04:00:00.000Z");
  const dueSoon = new Date();
  dueSoon.setUTCDate(dueSoon.getUTCDate() + 7);

  // Drop legacy calendar-month seed rows for this Regular project.
  await prisma.projectInvoicePeriod.deleteMany({
    where: {
      projectId: project1.id,
      status: InvoicePeriodStatus.ONGOING,
      invoicePdfPath: null,
      milestonePercent: null,
    },
  });

  await prisma.projectInvoicePeriod.upsert({
    where: {
      projectId_periodStart_periodEnd: {
        projectId: project1.id,
        periodStart: project1Cycle1.periodStart,
        periodEnd: project1Cycle1.periodEnd,
      },
    },
    update: {
      label: project1Cycle1.label,
      status: InvoicePeriodStatus.PAID,
      amount: 45_000_000,
      reportCount: 2,
      submittedAt: project1Cycle1.invoiceDueOn,
      dueAt: new Date("2026-06-30T04:00:00.000Z"),
      paidAt,
      taxInvoiceRequired: true,
      taxInvoiceDoneAt: paidAt,
      compiledById: vickoUser.id,
      compileNote: "Demo seed — first anniversary cycle paid.",
    },
    create: {
      projectId: project1.id,
      periodStart: project1Cycle1.periodStart,
      periodEnd: project1Cycle1.periodEnd,
      label: project1Cycle1.label,
      status: InvoicePeriodStatus.PAID,
      amount: 45_000_000,
      reportCount: 2,
      submittedAt: project1Cycle1.invoiceDueOn,
      dueAt: new Date("2026-06-30T04:00:00.000Z"),
      paidAt,
      taxInvoiceRequired: true,
      taxInvoiceDoneAt: paidAt,
      compiledById: vickoUser.id,
      compileNote: "Demo seed — first anniversary cycle paid.",
    },
  });

  await prisma.projectInvoicePeriod.upsert({
    where: {
      projectId_periodStart_periodEnd: {
        projectId: project1.id,
        periodStart: project1Cycle2.periodStart,
        periodEnd: project1Cycle2.periodEnd,
      },
    },
    update: {
      label: project1Cycle2.label,
      status: InvoicePeriodStatus.ONGOING,
      amount: 45_000_000,
      taxInvoiceRequired: false,
    },
    create: {
      projectId: project1.id,
      periodStart: project1Cycle2.periodStart,
      periodEnd: project1Cycle2.periodEnd,
      label: project1Cycle2.label,
      status: InvoicePeriodStatus.ONGOING,
      amount: 45_000_000,
    },
  });

  // Payment schedule 25/50/75/100 — first awaiting, rest ready to invoice.
  {
    const cumulatives = [25, 50, 75, 100] as const;
    let prev = 0;
    for (let i = 0; i < cumulatives.length; i++) {
      const cumulative = cumulatives[i]!;
      const slice = cumulative - prev;
      const periodStart = utcDate(2026, 6, 1 + i);
      const periodEnd = periodStart;
      const amount = Math.round(75_000_000 * (slice / 100));
      const isFirst = i === 0;
      await prisma.projectInvoicePeriod.upsert({
        where: {
          projectId_periodStart_periodEnd: {
            projectId: project2.id,
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
            ? {
                submittedAt,
                dueAt: dueSoon,
                taxInvoiceRequired: true,
                compiledById: vickoUser.id,
                compileNote: "Demo seed — first milestone awaiting payment.",
              }
            : {
                submittedAt: null,
                dueAt: null,
                invoicePdfPath: null,
                compiledById: null,
                compileNote: null,
              }),
        },
        create: {
          projectId: project2.id,
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
                submittedAt,
                dueAt: dueSoon,
                taxInvoiceRequired: true,
                compiledById: vickoUser.id,
                compileNote: "Demo seed — first milestone awaiting payment.",
              }
            : {}),
        },
      });
      prev = cumulative;
    }
  }

  await prisma.projectInvoicePeriod.upsert({
    where: {
      projectId_periodStart_periodEnd: {
        projectId: project3.id,
        periodStart: julyStart,
        periodEnd: julyEnd,
      },
    },
    update: {
      label: "July 2026",
      status: InvoicePeriodStatus.ONGOING,
      amount: 28_000_000,
    },
    create: {
      projectId: project3.id,
      periodStart: julyStart,
      periodEnd: julyEnd,
      label: "July 2026",
      status: InvoicePeriodStatus.ONGOING,
      amount: 28_000_000,
    },
  });

  // Facade milestone schedule 25/50/75/100
  {
    const cumulatives = [25, 50, 75, 100] as const;
    let prev = 0;
    for (let i = 0; i < cumulatives.length; i++) {
      const cumulative = cumulatives[i]!;
      const slice = cumulative - prev;
      const periodStart = utcDate(2026, 6, 15 + i);
      const periodEnd = periodStart;
      const amount = Math.round(95_000_000 * (slice / 100));
      const isFirst = i === 0;
      await prisma.projectInvoicePeriod.upsert({
        where: {
          projectId_periodStart_periodEnd: {
            projectId: project4.id,
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
            ? {
                submittedAt,
                dueAt: dueSoon,
                taxInvoiceRequired: true,
                compiledById: vickoUser.id,
                compileNote: "Demo seed — tax-enabled milestone awaiting payment.",
              }
            : {
                submittedAt: null,
                dueAt: null,
                invoicePdfPath: null,
                compiledById: null,
                compileNote: null,
              }),
        },
        create: {
          projectId: project4.id,
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
                submittedAt,
                dueAt: dueSoon,
                taxInvoiceRequired: true,
                compiledById: vickoUser.id,
                compileNote: "Demo seed — tax-enabled milestone awaiting payment.",
              }
            : {}),
        },
      });
      prev = cumulative;
    }
  }

  await prisma.projectInvoicePeriod.upsert({
    where: {
      projectId_periodStart_periodEnd: {
        projectId: project5.id,
        periodStart: utcDate(2026, 7, 5),
        periodEnd: utcDate(2026, 7, 31),
      },
    },
    update: {
      label: "Completion invoice",
      status: InvoicePeriodStatus.ONGOING,
      amount: 35_000_000,
      taxInvoiceRequired: false,
    },
    create: {
      projectId: project5.id,
      periodStart: utcDate(2026, 7, 5),
      periodEnd: utcDate(2026, 7, 31),
      label: "Completion invoice",
      status: InvoicePeriodStatus.ONGOING,
      amount: 35_000_000,
    },
  });

  const julyDates = [
    new Date("2026-07-01"),
    new Date("2026-07-02"),
    new Date("2026-07-03"),
    new Date("2026-07-07"),
    new Date("2026-07-08"),
  ];

  const progressSeed = [
    {
      projectId: project1.id,
      employeeId: staff1.id,
      date: julyDates[0],
      activity: "Lobby and elevator cleaning",
      progressPercent: 10,
    },
    {
      projectId: project1.id,
      employeeId: staff1.id,
      date: julyDates[1],
      activity: "Office floor 5-10 cleaning",
      progressPercent: 20,
    },
    {
      projectId: project1.id,
      employeeId: staff2.id,
      date: julyDates[2],
      activity: "Restroom deep cleaning",
      progressPercent: 30,
    },
    {
      projectId: project2.id,
      employeeId: staff2.id,
      date: julyDates[3],
      activity: "Food court area cleaning",
      progressPercent: 45,
    },
    {
      projectId: project2.id,
      employeeId: staff2.id,
      date: julyDates[4],
      activity: "Parking area maintenance",
      progressPercent: 55,
    },
  ];

  for (const entry of progressSeed) {
    await prisma.dailyProgress.upsert({
      where: {
        projectId_employeeId_date: {
          projectId: entry.projectId,
          employeeId: entry.employeeId,
          date: entry.date,
        },
      },
      update: {
        activity: entry.activity,
        progressPercent: entry.progressPercent,
      },
      create: entry,
    });
  }

  // --- Demo purchase invoices (supplier bills / PPN Masukan later) ---
  const purchaseInvoiceSeed = [
    {
      id: "demo-purchase-inv-1",
      supplierName: "PT Sumber Kimia Bersih",
      invoiceRef: "SKB-INV-2026-0712",
      invoiceDate: utcDate(2026, 7, 12),
      amount: new Prisma.Decimal("18500000.00"),
      includesPpn: true,
      notes: "Bulk cleaning chemicals for Gedung A & Mall B sites.",
      filename: "Purchase-Invoice_PT-Sumber-Kimia-Bersih_SKB-INV-2026-0712.pdf",
    },
    {
      id: "demo-purchase-inv-2",
      supplierName: "CV Alat Kebersihan Nusantara",
      invoiceRef: "AKN/VI/089",
      invoiceDate: utcDate(2026, 6, 28),
      amount: new Prisma.Decimal("7200000.00"),
      includesPpn: true,
      notes: "Floor machines and vacuum spare parts.",
      filename: "Purchase-Invoice_CV-Alat-Kebersihan-Nusantara_AKN-VI-089.pdf",
    },
    {
      id: "demo-purchase-inv-3",
      supplierName: "Toko Plastik Jaya Abadi",
      invoiceRef: "TPJA-45021",
      invoiceDate: utcDate(2026, 7, 5),
      amount: new Prisma.Decimal("2150000.00"),
      includesPpn: false,
      notes: "Trash bags and disposable PPE — no PPN on receipt.",
      filename: "Purchase-Invoice_Toko-Plastik-Jaya-Abadi_TPJA-45021.pdf",
    },
    {
      id: "demo-purchase-inv-4",
      supplierName: "PT Indo Paper Supply",
      invoiceRef: "IPS-202607-00341",
      invoiceDate: utcDate(2026, 7, 15),
      amount: new Prisma.Decimal("9800000.00"),
      includesPpn: true,
      notes: null,
      filename: "Purchase-Invoice_PT-Indo-Paper-Supply_IPS-202607-00341.pdf",
    },
  ] as const;

  for (const row of purchaseInvoiceSeed) {
    const filePath = await ensureDemoPurchaseInvoiceFile(row.filename);
    await prisma.purchaseInvoice.upsert({
      where: { id: row.id },
      update: {
        companyId: company.id,
        supplierName: row.supplierName,
        invoiceRef: row.invoiceRef,
        invoiceDate: row.invoiceDate,
        amount: row.amount,
        filePath,
        notes: row.notes,
        includesPpn: row.includesPpn,
        createdById: vickoUser.id,
      },
      create: {
        id: row.id,
        companyId: company.id,
        supplierName: row.supplierName,
        invoiceRef: row.invoiceRef,
        invoiceDate: row.invoiceDate,
        amount: row.amount,
        filePath,
        notes: row.notes,
        includesPpn: row.includesPpn,
        createdById: vickoUser.id,
      },
    });
  }

  await prisma.websiteContent.upsert({
    where: { companyId: company.id },
    update: {
      content: toWebsiteContentJson(defaultWebsiteContent),
      published: true,
    },
    create: {
      companyId: company.id,
      content: toWebsiteContentJson(defaultWebsiteContent),
      published: true,
    },
  });

  // Sample vendors (idempotent by name). Also: `npx tsx prisma/seed-vendors.ts`
  const seededVendors = await seedSampleVendors(prisma, company.id);

  // Sample purchase invoices (idempotent by invoiceRef). Placeholder files via
  // prisma/seed-purchase-invoices.ts — run that script after seed for filePath assets.
  const purchaseSamples = [
    {
      supplierName: "PT Sumber Alat Kebersihan",
      invoiceRef: "SAK-2026-0412",
      invoiceDate: utcDate(2026, 6, 12),
      amount: "4850000.00",
      includesPpn: true,
      notes: "Bulk mop heads and microfiber cloths for Q3 stock.",
    },
    {
      supplierName: "CV Mandiri Chemical",
      invoiceRef: "MC-INV-7781",
      invoiceDate: utcDate(2026, 7, 3),
      amount: "12750000.00",
      includesPpn: true,
      notes: "Floor cleaner concentrate + disinfectant (20L drums).",
    },
    {
      supplierName: "Toko Plastik Jaya",
      invoiceRef: "TPJ/06/2901",
      invoiceDate: utcDate(2026, 6, 28),
      amount: "890000.00",
      includesPpn: false,
      notes: null as string | null,
    },
    {
      supplierName: "PT Indo Uniform Supply",
      invoiceRef: "IUS-202607-015",
      invoiceDate: utcDate(2026, 7, 8),
      amount: "6420000.00",
      includesPpn: true,
      notes: "Staff uniforms — size mix for new site crew.",
    },
    {
      supplierName: "UD Berkah Sparepart",
      invoiceRef: "BS-4509",
      invoiceDate: utcDate(2026, 5, 20),
      amount: "2150000.00",
      includesPpn: false,
      notes: "Vacuum motor replacements (2 units).",
    },
    {
      supplierName: "PT Graha Office Mart",
      invoiceRef: "GOM-PI-2026-883",
      invoiceDate: utcDate(2026, 7, 15),
      amount: "1575000.00",
      includesPpn: true,
      notes: "Trash bags, gloves, and restroom consumables.",
    },
  ] as const;

  const existingPurchaseRefs = new Set(
    (
      await prisma.purchaseInvoice.findMany({
        where: {
          companyId: company.id,
          invoiceRef: { in: purchaseSamples.map((s) => s.invoiceRef) },
        },
        select: { invoiceRef: true },
      })
    ).map((row) => row.invoiceRef)
  );

  const purchaseToCreate = purchaseSamples.filter(
    (s) => !existingPurchaseRefs.has(s.invoiceRef)
  );

  if (purchaseToCreate.length > 0) {
    await prisma.purchaseInvoice.createMany({
      data: purchaseToCreate.map((sample) => {
        const base = buildBillingDocumentFileBase({
          prefix: "Purchase-Invoice",
          clientName: sample.supplierName,
          invoiceNumber: sample.invoiceRef,
        });
        return {
          companyId: company.id,
          supplierName: sample.supplierName,
          invoiceRef: sample.invoiceRef,
          invoiceDate: sample.invoiceDate,
          amount: new Prisma.Decimal(sample.amount),
          // Placeholder PDFs: `npx tsx prisma/seed-purchase-invoices.ts`
          filePath: `/uploads/purchase-invoices/${base}.pdf`,
          notes: sample.notes,
          includesPpn: sample.includesPpn,
          createdById: vickoUser.id,
        };
      }),
    });
  }

  console.log("✅ Seed complete");
  console.log("");
  console.log("Admin:           vicko / admin123");
  console.log("Demo users:      manager, office, site, site2, client (see seed passwords)");
  console.log("");
  console.log("Demo clients:");
  console.log("  • PT Gedung Sejahtera (NPWP) — Cleaning Gedung A, Cleaning Mall B");
  console.log("  • Demo — PT Nusantara Properti (NPWP) — Menara daily + lobby deep clean");
  console.log("  • Demo — CV Mandiri Facility (no NPWP) — warehouse polish + facade trial");
  console.log("");
  console.log(
    `Demo purchase invoices: ${purchaseInvoiceSeed.length} supplier bills under Purchases`
  );
  console.log(
    `Demo vendors: ${SAMPLE_VENDORS.length} suppliers (${seededVendors.length} newly created)`
  );
  console.log("");
  console.log("Recovery emails: vicko@rgs.co.id, office@rgs.co.id, etc.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
