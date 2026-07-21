-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('MONTHLY', 'ON_COMPLETION', 'MILESTONE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "contractPrice" DECIMAL(14,2),
ADD COLUMN "billingMode" "BillingMode" NOT NULL DEFAULT 'MONTHLY';

-- AlterTable
ALTER TABLE "ProjectInvoicePeriod" ADD COLUMN "amount" DECIMAL(14,2),
ADD COLUMN "milestonePercent" DOUBLE PRECISION;

-- Backfill: Regular Cleaning stays MONTHLY; General/Facade default to ON_COMPLETION.
UPDATE "Project"
SET "billingMode" = 'MONTHLY'
WHERE "subCategory" = 'REGULAR_CLEANING';

UPDATE "Project"
SET "billingMode" = 'MILESTONE'
WHERE "subCategory" IN ('GENERAL_CLEANING', 'FACADE_CLEANING');
