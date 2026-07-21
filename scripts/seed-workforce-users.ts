import {
  PrismaClient,
  EmployeeType,
  EmploymentType,
  Placement,
  EmploymentStatus,
  UserRole,
  Prisma,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  getClientModuleOverrides,
  getEmployeeModuleOverrides,
} from "../lib/permissions";
import {
  ensureDefaultPositions,
  normalizePositionTitleCase,
  retireFinanceDepartments,
} from "../lib/positions";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({
    where: { id: "rgs-company" },
  });
  if (!company) throw new Error("Company not found");

  for (const item of [
    { slug: "corporate", name: "Corporate", prefix: "COR", sortOrder: 10 },
    { slug: "operations", name: "Operations", prefix: "OPR", sortOrder: 20 },
  ] as const) {
    await prisma.employeeCategory.upsert({
      where: {
        companyId_slug: { companyId: company.id, slug: item.slug },
      },
      update: {
        name: item.name,
        prefix: item.prefix,
        sortOrder: item.sortOrder,
        active: true,
      },
      create: { ...item, companyId: company.id, active: true },
    });
  }
  await retireFinanceDepartments(prisma);
  await ensureDefaultPositions(prisma, company.id);
  await normalizePositionTitleCase(prisma, company.id);

  const passwordHash = await bcrypt.hash("admin123", 12);
  const staffHash = await bcrypt.hash("staff123", 12);
  const employeeModuleOverrides = getEmployeeModuleOverrides({
    placement: "AVAILABLE",
    employeeType: "PROJECT_SITE",
  });

  const vicko = await prisma.user.upsert({
    where: { username: "vicko" },
    update: {
      passwordHash,
      mustSetPassword: false,
      role: UserRole.ADMIN,
      email: "vicko@rgs.co.id",
      name: "Vicko Liem",
      active: true,
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
      active: true,
    },
  });

  const site = await prisma.user.upsert({
    where: { username: "site" },
    update: {
      passwordHash: staffHash,
      mustSetPassword: false,
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
      moduleOverrides: employeeModuleOverrides,
      active: true,
    },
  });

  const site2 = await prisma.user.upsert({
    where: { username: "site2" },
    update: {
      passwordHash: staffHash,
      mustSetPassword: false,
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
      moduleOverrides: employeeModuleOverrides,
      active: true,
    },
  });

  const ops = await prisma.employeeCategory.findFirstOrThrow({
    where: { companyId: company.id, slug: "operations" },
  });
  const corp = await prisma.employeeCategory.findFirstOrThrow({
    where: { companyId: company.id, slug: "corporate" },
  });
  const cleaning = await prisma.position.findFirst({
    where: { categoryId: ops.id, slug: "cleaning-staff" },
  });
  const gc = await prisma.position.findFirst({
    where: { categoryId: ops.id, slug: "gc-staff" },
  });
  const director = await prisma.position.findFirst({
    where: { categoryId: corp.id, slug: "director" },
  });

  // Unlink then recreate demo employees
  await prisma.employee.updateMany({
    where: {
      companyId: company.id,
      employeeNo: { in: ["OPR-001", "OPR-002", "COR-001", "CS-001", "GCS-001", "HO-001"] },
    },
    data: { userId: null },
  });
  await prisma.projectAssignment.deleteMany({
    where: {
      employee: {
        employeeNo: {
          in: ["OPR-001", "OPR-002", "COR-001", "CS-001", "GCS-001", "HO-001"],
        },
      },
    },
  });
  await prisma.employee.deleteMany({
    where: {
      companyId: company.id,
      employeeNo: {
        in: ["OPR-001", "OPR-002", "COR-001", "CS-001", "GCS-001", "HO-001"],
      },
    },
  });

  await prisma.employee.create({
    data: {
      employeeNo: "OPR-001",
      firstName: "Budi",
      lastName: "Santoso",
      email: "site@rgs.co.id",
      phone: "+62 812 0000 0001",
      employeeType: EmployeeType.PROJECT_SITE,
      employmentType: EmploymentType.FULL_TIME,
      placement: Placement.AVAILABLE,
      portalAccessRequested: true,
      categoryId: ops.id,
      positionId: cleaning?.id,
      position: cleaning?.name ?? "Cleaning staff",
      status: EmploymentStatus.ACTIVE,
      companyId: company.id,
      userId: site.id,
      hiredAt: new Date("2024-01-15"),
    },
  });

  await prisma.employee.create({
    data: {
      employeeNo: "OPR-002",
      firstName: "Siti",
      lastName: "Aminah",
      email: "site2@rgs.co.id",
      phone: "+62 812 0000 0002",
      employeeType: EmployeeType.PROJECT_SITE,
      employmentType: EmploymentType.FULL_TIME,
      placement: Placement.AVAILABLE,
      portalAccessRequested: true,
      categoryId: ops.id,
      positionId: gc?.id,
      position: gc?.name ?? "GC staff",
      status: EmploymentStatus.ACTIVE,
      companyId: company.id,
      userId: site2.id,
      hiredAt: new Date("2024-03-01"),
    },
  });

  await prisma.employee.create({
    data: {
      employeeNo: "COR-001",
      firstName: "Vicko",
      lastName: "Liem",
      email: "vicko@rgs.co.id",
      phone: "+62 812 0000 0003",
      employeeType: EmployeeType.HEAD_OFFICE,
      employmentType: EmploymentType.FULL_TIME,
      placement: Placement.HEAD_OFFICE,
      portalAccessRequested: true,
      categoryId: corp.id,
      positionId: director?.id,
      position: director?.name ?? "Director",
      status: EmploymentStatus.ACTIVE,
      companyId: company.id,
      userId: vicko.id,
      hiredAt: new Date("2024-02-01"),
    },
  });

  void getClientModuleOverrides;

  const employees = await prisma.employee.findMany({
    where: { companyId: company.id, archivedFromDirectory: false },
    select: {
      employeeNo: true,
      placement: true,
      employmentType: true,
      position: true,
      category: { select: { name: true } },
    },
  });
  console.log("Seeded users: vicko / site / site2 (admin123 / staff123)");
  console.log("Employees:", employees);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
