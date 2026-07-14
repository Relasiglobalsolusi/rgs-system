import { PrismaClient, UserRole, UserType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const company = await prisma.company.upsert({
    where: {
      id: "rgs-company",
    },
    update: {},
    create: {
      id: "rgs-company",
      name: "Relasi Global Solusi",
      email: "admin@rgs.co.id",
      phone: "+62 21 0000000",
      address: "Jakarta, Indonesia",
    },
  });

  const passwordHash = await bcrypt.hash("admin123", 12);

  await prisma.user.upsert({
    where: {
      email: "admin@rgs.co.id",
    },
    update: {
      passwordHash,
    },
    create: {
      name: "Vicko Liem",
      email: "admin@rgs.co.id",
      passwordHash,
      type: UserType.INTERNAL,
      role: UserRole.SUPER_ADMIN,
      companyId: company.id,
      active: true,
    },
  });

  console.log("✅ Super Admin Created");
  console.log("Email: admin@rgs.co.id");
  console.log("Password: admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });