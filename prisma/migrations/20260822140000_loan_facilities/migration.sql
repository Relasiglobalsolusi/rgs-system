-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "LoanSource" AS ENUM ('BANK', 'SHAREHOLDER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LoanFacilityStatus" AS ENUM ('ACTIVE', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LoanMovementKind" AS ENUM ('DRAW', 'REPAYMENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "PurchaseInvoice"
  ADD COLUMN IF NOT EXISTS "loanFacilityId" TEXT,
  ADD COLUMN IF NOT EXISTS "loanSource" "LoanSource",
  ADD COLUMN IF NOT EXISTS "loanPrincipalAmount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "loanInterestAmount" DECIMAL(14,2);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LoanFacility" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "source" "LoanSource" NOT NULL,
  "kind" "BankLoanKind" NOT NULL,
  "status" "LoanFacilityStatus" NOT NULL DEFAULT 'ACTIVE',
  "name" TEXT NOT NULL,
  "lenderName" TEXT NOT NULL,
  "vendorId" TEXT,
  "bankAccountId" TEXT,
  "facilityLimit" DECIMAL(14,2),
  "principal" DECIMAL(14,2),
  "chargesInterest" BOOLEAN NOT NULL DEFAULT true,
  "annualRatePercent" DECIMAL(6,3),
  "tenorMonths" INTEGER,
  "monthlyInstallment" DECIMAL(14,2),
  "startDate" DATE NOT NULL,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LoanFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LoanMovement" (
  "id" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "kind" "LoanMovementKind" NOT NULL,
  "movementDate" DATE NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "principalAmount" DECIMAL(14,2),
  "interestAmount" DECIMAL(14,2),
  "transferFeeIdr" DECIMAL(14,2),
  "bankAccountId" TEXT,
  "purchaseInvoiceId" TEXT,
  "notes" TEXT,
  "filePath" TEXT,
  "reversedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LoanMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoanFacility_companyId_status_idx" ON "LoanFacility"("companyId", "status");
CREATE INDEX IF NOT EXISTS "LoanFacility_companyId_source_idx" ON "LoanFacility"("companyId", "source");
CREATE INDEX IF NOT EXISTS "LoanMovement_facilityId_movementDate_idx" ON "LoanMovement"("facilityId", "movementDate");
CREATE INDEX IF NOT EXISTS "LoanMovement_purchaseInvoiceId_idx" ON "LoanMovement"("purchaseInvoiceId");
CREATE INDEX IF NOT EXISTS "PurchaseInvoice_loanFacilityId_idx" ON "PurchaseInvoice"("loanFacilityId");

DO $$ BEGIN
  ALTER TABLE "LoanFacility" ADD CONSTRAINT "LoanFacility_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoanFacility" ADD CONSTRAINT "LoanFacility_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoanFacility" ADD CONSTRAINT "LoanFacility_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoanFacility" ADD CONSTRAINT "LoanFacility_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoanMovement" ADD CONSTRAINT "LoanMovement_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "LoanFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoanMovement" ADD CONSTRAINT "LoanMovement_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoanMovement" ADD CONSTRAINT "LoanMovement_purchaseInvoiceId_fkey"
    FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoanMovement" ADD CONSTRAINT "LoanMovement_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_loanFacilityId_fkey"
    FOREIGN KEY ("loanFacilityId") REFERENCES "LoanFacility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
