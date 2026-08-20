-- AlterEnum
ALTER TYPE "EmploymentStatus" ADD VALUE 'RESIGNED';

-- CreateEnum
CREATE TYPE "SecurityDepositStatus" AS ENUM ('NONE', 'HELD', 'RETURNED', 'KEPT_BY_COMPANY');

-- CreateEnum
CREATE TYPE "PayrollDeductionType" AS ENUM (
  'SECURITY_DEPOSIT',
  'LOST_STOCK',
  'PENALTY',
  'OTHER',
  'RETURN_OF_SECURITY_DEPOSIT'
);

-- AlterTable
ALTER TABLE "Employee"
  ADD COLUMN "depositHeldAmount" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "depositStatus" "SecurityDepositStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "lastWorkingDay" DATE,
  ADD COLUMN "resignAccordingToProcedure" BOOLEAN,
  ADD COLUMN "resignNote" TEXT,
  ADD COLUMN "resignedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PayrollDeduction" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "type" "PayrollDeductionType" NOT NULL,
  "amount" DECIMAL(14, 2) NOT NULL,
  "reason" TEXT,
  "itemName" TEXT,
  "quantity" DECIMAL(14, 3),
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "projectId" TEXT,
  "inventoryItemId" TEXT,
  "inventoryMovementId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PayrollDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollDeduction_inventoryMovementId_key" ON "PayrollDeduction"("inventoryMovementId");

-- CreateIndex
CREATE INDEX "PayrollDeduction_employeeId_year_month_idx" ON "PayrollDeduction"("employeeId", "year", "month");

-- CreateIndex
CREATE INDEX "PayrollDeduction_companyId_year_month_idx" ON "PayrollDeduction"("companyId", "year", "month");

-- CreateIndex
CREATE INDEX "PayrollDeduction_projectId_type_idx" ON "PayrollDeduction"("projectId", "type");

-- AddForeignKey
ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_inventoryMovementId_fkey" FOREIGN KEY ("inventoryMovementId") REFERENCES "InventoryMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
