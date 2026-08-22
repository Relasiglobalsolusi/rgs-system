-- AlterEnum
ALTER TYPE "PurchaseCategory" ADD VALUE IF NOT EXISTS 'BANK_LOAN';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BankLoanKind" AS ENUM ('STANDBY', 'TERM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "PurchaseInvoice"
  ADD COLUMN IF NOT EXISTS "bankLoanKind" "BankLoanKind",
  ADD COLUMN IF NOT EXISTS "bankLoanPrincipal" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "bankLoanFacilityLimit" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "bankLoanAnnualRatePercent" DECIMAL(6,3),
  ADD COLUMN IF NOT EXISTS "bankLoanTenorMonths" INTEGER,
  ADD COLUMN IF NOT EXISTS "bankLoanMonthlyInstallment" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "transferFeeIdr" DECIMAL(14,2);
