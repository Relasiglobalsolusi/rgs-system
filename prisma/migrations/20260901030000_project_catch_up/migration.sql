-- CreateEnum
CREATE TYPE "ProjectCatchUpKind" AS ENUM ('NONE', 'COMPLETED', 'ONGOING');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "catchUpKind" "ProjectCatchUpKind" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "ProjectInvoicePeriod" ADD COLUMN "isCatchUp" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProjectExpense" ADD COLUMN "isCatchUp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProjectExpense" ADD COLUMN "proofPath" TEXT;
