/**
 * Local sample loans only. Idempotent by facility name. Does not wipe data.
 *
 * Standby: 1 Jun draw 1,000,000,000 and 20 Jun draw 3,000,000,000
 * as a manual ledger. Term loan is a separate facility.
 *
 * Usage: npx tsx scripts/seed-sample-loans.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { termMonthlyInstallment } from "../lib/bank-loan";

const prisma = new PrismaClient();

const DEMO_PDF = Buffer.from(
  "%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf8"
);

const STANDBY_NAME = "Sample BCA Standby Facility";
const TERM_NAME = "Sample Mandiri Term Loan";

async function demoPdf(): Promise<string> {
  const rel = "/uploads/purchase-invoices/sample-loan-proof.pdf";
  const abs = path.join(process.cwd(), "public", ...rel.split("/").filter(Boolean));
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, DEMO_PDF);
  return rel;
}

function utc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

async function main() {
  const company = await prisma.company.findFirst({
    where: { id: "rgs-company" },
    select: { id: true },
  });
  if (!company) {
    throw new Error("Company rgs-company not found. Seed the demo company first.");
  }
  const user = await prisma.user.findFirst({
    where: { companyId: company.id, username: "vicko" },
    select: { id: true },
  });
  const vendor = await prisma.vendor.findFirst({
    where: { companyId: company.id, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const bank = await prisma.companyBankAccount.findFirst({
    where: { companyId: company.id },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!vendor || !bank) {
    throw new Error("Need an active vendor and a company bank account.");
  }
  const filePath = await demoPdf();
  const year = 2026;

  const existingStandby = await prisma.loanFacility.findFirst({
    where: { companyId: company.id, name: STANDBY_NAME },
    select: { id: true },
  });
  if (!existingStandby) {
    const standby = await prisma.loanFacility.create({
      data: {
        companyId: company.id,
        source: "BANK",
        kind: "STANDBY",
        name: STANDBY_NAME,
        lenderName: vendor.name,
        vendorId: vendor.id,
        bankAccountId: bank.id,
        facilityLimit: new Prisma.Decimal(10_000_000_000),
        chargesInterest: true,
        interestRateBasis: "ANNUAL",
        annualRatePercent: new Prisma.Decimal(12),
        startDate: utc(year, 6, 1),
        notes: "Sample KRK-style standby. Daily outstanding, Actual/360.",
        createdById: user?.id,
      },
      select: { id: true },
    });
    await prisma.loanMovement.createMany({
      data: [
        {
          facilityId: standby.id,
          kind: "DRAW",
          movementDate: utc(year, 6, 1),
          amount: new Prisma.Decimal(1_000_000_000),
          principalAmount: new Prisma.Decimal(1_000_000_000),
          interestAmount: new Prisma.Decimal(0),
          bankAccountId: bank.id,
          notes: "First draw — 1 June",
          filePath,
          createdById: user?.id,
        },
        {
          facilityId: standby.id,
          kind: "DRAW",
          movementDate: utc(year, 6, 20),
          amount: new Prisma.Decimal(3_000_000_000),
          principalAmount: new Prisma.Decimal(3_000_000_000),
          interestAmount: new Prisma.Decimal(0),
          bankAccountId: bank.id,
          notes: "Second draw — 20 June",
          filePath,
          createdById: user?.id,
        },
      ],
    });
    console.log(`Created ${STANDBY_NAME} with 1 Jun + 20 Jun draws.`);
  } else {
    console.log(`${STANDBY_NAME} already exists.`);
  }

  const existingTerm = await prisma.loanFacility.findFirst({
    where: { companyId: company.id, name: TERM_NAME },
    select: { id: true },
  });
  if (!existingTerm) {
    const installment = termMonthlyInstallment(2_400_000_000, 12, 36, "ANNUAL");
    const term = await prisma.loanFacility.create({
      data: {
        companyId: company.id,
        source: "BANK",
        kind: "TERM",
        name: TERM_NAME,
        lenderName: vendor.name,
        vendorId: vendor.id,
        bankAccountId: bank.id,
        principal: new Prisma.Decimal(2_400_000_000),
        chargesInterest: true,
        interestRateBasis: "ANNUAL",
        annualRatePercent: new Prisma.Decimal(12),
        tenorMonths: 36,
        monthlyInstallment: new Prisma.Decimal(installment),
        startDate: utc(year, 5, 1),
        notes: "Sample term loan. Pay installment or Settle Early.",
        createdById: user?.id,
      },
      select: { id: true },
    });
    await prisma.loanMovement.create({
      data: {
        facilityId: term.id,
        kind: "DRAW",
        movementDate: utc(year, 5, 1),
        amount: new Prisma.Decimal(2_400_000_000),
        principalAmount: new Prisma.Decimal(2_400_000_000),
        interestAmount: new Prisma.Decimal(0),
        bankAccountId: bank.id,
        notes: "Initial term draw",
        filePath,
        createdById: user?.id,
      },
    });
    console.log(`Created ${TERM_NAME}.`);
  } else {
    console.log(`${TERM_NAME} already exists.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
