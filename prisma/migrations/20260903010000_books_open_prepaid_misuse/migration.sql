-- AlterTable
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "booksOpenDate" DATE;

-- AlterEnum
ALTER TYPE "PayrollDeductionType" ADD VALUE IF NOT EXISTS 'PREPAID_MISUSE';
