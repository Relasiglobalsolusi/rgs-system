/**
 * Sample supplier vendors for the demo company (rgs-company / Relasi Global Solusi).
 *
 * Usage: npx tsx prisma/seed-vendors.ts
 *
 * Idempotent by vendor name — skips names that already exist for the company.
 * Does not delete existing data. Short codes allocated via getNextVendorShortCode (V001…).
 */
import { PrismaClient, type Prisma } from "@prisma/client";

import { getNextVendorShortCode } from "../lib/vendor-short-code";

type Db = Prisma.TransactionClient | PrismaClient;

export type SampleVendor = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  npwp: string | null;
  contactPersonFirstName: string;
  contactPersonLastName: string | null;
  contactPersonPosition: string | null;
  contactPersonEmail: string | null;
  contactPersonPhone: string | null;
  vendorSince: Date;
  paymentTermsDays: number;
};

export const SAMPLE_VENDORS: SampleVendor[] = [
  {
    name: "CV Mandiri Chemical",
    email: "sales@mandirichemical.co.id",
    phone: "+62 21 7890123",
    address: "Jl. Industri Raya No. 45, Cikarang, Bekasi",
    npwp: "018765432109000",
    contactPersonFirstName: "Budi",
    contactPersonLastName: "Santoso",
    contactPersonPosition: "Sales Manager",
    contactPersonEmail: "budi.santoso@mandirichemical.co.id",
    contactPersonPhone: "+62 812 3456 7801",
    vendorSince: new Date(Date.UTC(2023, 2, 15)),
    paymentTermsDays: 30,
  },
  {
    name: "PT Sumber Alat Kebersihan",
    email: "order@sumberalat.co.id",
    phone: "+62 21 5566778",
    address: "Jl. Rawa Gelam III No. 12, Jakarta Timur",
    npwp: "027654321098000",
    contactPersonFirstName: "Siti",
    contactPersonLastName: "Rahayu",
    contactPersonPosition: "Account Executive",
    contactPersonEmail: "siti.rahayu@sumberalat.co.id",
    contactPersonPhone: "+62 813 9876 5432",
    vendorSince: new Date(Date.UTC(2022, 8, 1)),
    paymentTermsDays: 14,
  },
  {
    name: "CV Kertas Prima Nusantara",
    email: "info@kertasprima.co.id",
    phone: "+62 21 3344556",
    address: "Jl. Gunung Sahari Raya No. 88, Jakarta Pusat",
    npwp: "031234567890000",
    contactPersonFirstName: "Andi",
    contactPersonLastName: "Wijaya",
    contactPersonPosition: "Owner",
    contactPersonEmail: "andi@kertasprima.co.id",
    contactPersonPhone: "+62 821 1122 3344",
    vendorSince: new Date(Date.UTC(2024, 0, 10)),
    paymentTermsDays: 14,
  },
  {
    name: "PT Indo Uniform Supply",
    email: "hello@indouniform.id",
    phone: "+62 31 5678901",
    address: "Jl. Rungkut Industri I No. 7, Surabaya",
    npwp: "045678901234000",
    contactPersonFirstName: "Dewi",
    contactPersonLastName: "Lestari",
    contactPersonPosition: "Sales Coordinator",
    contactPersonEmail: "dewi.lestari@indouniform.id",
    contactPersonPhone: "+62 857 3344 5566",
    vendorSince: new Date(Date.UTC(2023, 5, 20)),
    paymentTermsDays: 30,
  },
  {
    name: "Toko Plastik Jaya",
    email: null,
    phone: "+62 812 7788 9900",
    address: "Pasar Minggu Blok C No. 15, Jakarta Selatan",
    npwp: null,
    contactPersonFirstName: "Hendra",
    contactPersonLastName: "Gunawan",
    contactPersonPosition: "Pemilik",
    contactPersonEmail: null,
    contactPersonPhone: "+62 812 7788 9900",
    vendorSince: new Date(Date.UTC(2025, 1, 5)),
    paymentTermsDays: 7,
  },
  {
    name: "UD Berkah Sparepart",
    email: "berkah.sparepart@gmail.com",
    phone: "+62 878 2211 3344",
    address: "Jl. Kapuk Muara No. 3, Jakarta Utara",
    npwp: null,
    contactPersonFirstName: "Agus",
    contactPersonLastName: "Prasongko",
    contactPersonPosition: "Teknisi / Penjualan",
    contactPersonEmail: "berkah.sparepart@gmail.com",
    contactPersonPhone: "+62 878 2211 3344",
    vendorSince: new Date(Date.UTC(2024, 9, 12)),
    paymentTermsDays: 14,
  },
  {
    name: "PT Graha Office Mart",
    email: "procurement@grahaoffice.co.id",
    phone: "+62 21 29001122",
    address: "Jl. TB Simatupang Kav. 17, Jakarta Selatan",
    npwp: "059876543210000",
    contactPersonFirstName: "Rina",
    contactPersonLastName: "Kartika",
    contactPersonPosition: "Key Account",
    contactPersonEmail: "rina.kartika@grahaoffice.co.id",
    contactPersonPhone: "+62 811 2233 4455",
    vendorSince: new Date(Date.UTC(2022, 11, 8)),
    paymentTermsDays: 45,
  },
  {
    name: "CV Sabun & Disinfektan Sejahtera",
    email: "cs@sabunsejahtera.id",
    phone: "+62 22 8765432",
    address: "Jl. Soekarno-Hatta No. 210, Bandung",
    npwp: "062345678901000",
    contactPersonFirstName: "Yusuf",
    contactPersonLastName: "Maulana",
    contactPersonPosition: "Sales Supervisor",
    contactPersonEmail: "yusuf@sabunsejahtera.id",
    contactPersonPhone: "+62 856 6677 8899",
    vendorSince: new Date(Date.UTC(2023, 10, 3)),
    paymentTermsDays: 14,
  },
];

export async function seedSampleVendors(
  db: Db,
  companyId: string
): Promise<{ id: string; name: string; shortCode: string }[]> {
  const existing = await db.vendor.findMany({
    where: {
      companyId,
      name: { in: SAMPLE_VENDORS.map((s) => s.name) },
    },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((row) => row.name));
  const toCreate = SAMPLE_VENDORS.filter((s) => !existingNames.has(s.name));

  if (toCreate.length === 0) return [];

  const top = await db.vendor.findFirst({
    where: { companyId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let sortOrder = (top?.sortOrder ?? -1) + 1;

  const created: { id: string; name: string; shortCode: string }[] = [];

  for (const sample of toCreate) {
    const shortCode = await getNextVendorShortCode(companyId, db);
    const vendor = await db.vendor.create({
      data: {
        name: sample.name,
        shortCode,
        email: sample.email,
        phone: sample.phone,
        address: sample.address,
        npwp: sample.npwp,
        contactPersonFirstName: sample.contactPersonFirstName,
        contactPersonLastName: sample.contactPersonLastName,
        contactPersonPosition: sample.contactPersonPosition,
        contactPersonEmail: sample.contactPersonEmail,
        contactPersonPhone: sample.contactPersonPhone,
        vendorSince: sample.vendorSince,
        paymentTermsDays: sample.paymentTermsDays,
        companyId,
        active: true,
        sortOrder: sortOrder++,
      },
      select: { id: true, name: true, shortCode: true },
    });
    created.push(vendor);
  }

  return created;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("Seeding sample vendors…");

    const company =
      (await prisma.company.findUnique({ where: { id: "rgs-company" } })) ??
      (await prisma.company.findFirst({ orderBy: { createdAt: "asc" } }));

    if (!company) {
      throw new Error("No company found. Run npm run db:seed first.");
    }

    const created = await seedSampleVendors(prisma, company.id);

    if (created.length === 0) {
      const existing = await prisma.vendor.findMany({
        where: {
          companyId: company.id,
          name: { in: SAMPLE_VENDORS.map((s) => s.name) },
        },
        select: { id: true, name: true, shortCode: true },
        orderBy: { shortCode: "asc" },
      });
      console.log(
        `All ${SAMPLE_VENDORS.length} sample vendors already exist for ${company.name} (${company.id}).`
      );
      for (const row of existing) {
        console.log(`  • ${row.shortCode} — ${row.name} (${row.id})`);
      }
    } else {
      console.log(
        `Created ${created.length} vendor(s) for ${company.name} (${company.id}).`
      );
      for (const row of created) {
        console.log(`  • ${row.shortCode} — ${row.name} (${row.id})`);
      }
      const skipped = SAMPLE_VENDORS.length - created.length;
      if (skipped > 0) {
        console.log(`Skipped ${skipped} already-present name(s).`);
      }
    }

    console.log("");
    console.log("Refresh /vendors (hard refresh if needed).");
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").endsWith("prisma/seed-vendors.ts");

if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
