-- Prepaid Card lifecycle: kinds, statuses, assignments, loss/recovery.

CREATE TYPE "PrepaidCardKind" AS ENUM ('VEHICLE', 'OPEN');
CREATE TYPE "PrepaidCardStatus" AS ENUM ('STANDBY', 'ACTIVE', 'DAMAGED', 'LOST', 'REPLACED');
CREATE TYPE "PrepaidCardLossRecoveryKind" AS ENUM ('COMPANY', 'NEXT_PAY', 'INSTALLMENTS', 'PAY_NOW');
CREATE TYPE "PrepaidCardRecoverySource" AS ENUM ('PAYROLL', 'PAY_NOW');

ALTER TYPE "PrepaidCardSpendKind" ADD VALUE IF NOT EXISTS 'OTHER';
ALTER TYPE "PrepaidCardEntryKind" ADD VALUE IF NOT EXISTS 'WRITE_OFF';
ALTER TYPE "PrepaidCardEntryKind" ADD VALUE IF NOT EXISTS 'REPLACEMENT_FEE';
ALTER TYPE "PrepaidCardEntryKind" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
ALTER TYPE "PrepaidCardEntryKind" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';

ALTER TABLE "PrepaidCard" ADD COLUMN "kind" "PrepaidCardKind" NOT NULL DEFAULT 'VEHICLE';
ALTER TABLE "PrepaidCard" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "PrepaidCard" ADD COLUMN "status" "PrepaidCardStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "PrepaidCard" ALTER COLUMN "status" SET DEFAULT 'STANDBY';
ALTER TABLE "PrepaidCard" ADD COLUMN "custodianEmployeeId" TEXT;
ALTER TABLE "PrepaidCard" ADD COLUMN "replacedByCardId" TEXT;
ALTER TABLE "PrepaidCard" ALTER COLUMN "vehicleItemId" DROP NOT NULL;

ALTER TABLE "PrepaidCard" DROP CONSTRAINT IF EXISTS "PrepaidCard_companyId_vehicleItemId_key";

CREATE INDEX "PrepaidCard_companyId_kind_status_idx" ON "PrepaidCard"("companyId", "kind", "status");
CREATE INDEX "PrepaidCard_companyId_vehicleItemId_idx" ON "PrepaidCard"("companyId", "vehicleItemId");
CREATE INDEX "PrepaidCard_companyId_custodianEmployeeId_idx" ON "PrepaidCard"("companyId", "custodianEmployeeId");

ALTER TABLE "PrepaidCard"
  ADD CONSTRAINT "PrepaidCard_custodianEmployeeId_fkey"
  FOREIGN KEY ("custodianEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrepaidCard"
  ADD CONSTRAINT "PrepaidCard_replacedByCardId_fkey"
  FOREIGN KEY ("replacedByCardId") REFERENCES "PrepaidCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PrepaidCardAssignment" (
    "id" TEXT NOT NULL,
    "prepaidCardId" TEXT NOT NULL,
    "vehicleItemId" TEXT,
    "custodianEmployeeId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepaidCardAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrepaidCardAssignment_prepaidCardId_startedAt_idx" ON "PrepaidCardAssignment"("prepaidCardId", "startedAt");
CREATE INDEX "PrepaidCardAssignment_custodianEmployeeId_idx" ON "PrepaidCardAssignment"("custodianEmployeeId");
CREATE INDEX "PrepaidCardAssignment_vehicleItemId_idx" ON "PrepaidCardAssignment"("vehicleItemId");

ALTER TABLE "PrepaidCardAssignment"
  ADD CONSTRAINT "PrepaidCardAssignment_prepaidCardId_fkey"
  FOREIGN KEY ("prepaidCardId") REFERENCES "PrepaidCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrepaidCardAssignment"
  ADD CONSTRAINT "PrepaidCardAssignment_vehicleItemId_fkey"
  FOREIGN KEY ("vehicleItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrepaidCardAssignment"
  ADD CONSTRAINT "PrepaidCardAssignment_custodianEmployeeId_fkey"
  FOREIGN KEY ("custodianEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "PrepaidCardAssignment" ("id", "prepaidCardId", "vehicleItemId", "startedAt", "createdAt")
SELECT 'asgn_' || "id", "id", "vehicleItemId", "createdAt", CURRENT_TIMESTAMP
FROM "PrepaidCard"
WHERE "vehicleItemId" IS NOT NULL;

ALTER TABLE "PrepaidCardEntry" ADD COLUMN "assignmentId" TEXT;
ALTER TABLE "PrepaidCardEntry" ADD COLUMN "purchaseInvoiceId" TEXT;
ALTER TABLE "PrepaidCardEntry" ADD COLUMN "lossId" TEXT;
ALTER TABLE "PrepaidCardEntry" ADD COLUMN "relatedCardId" TEXT;
ALTER TABLE "PrepaidCardEntry" ADD COLUMN "bankAccountId" TEXT;

CREATE INDEX "PrepaidCardEntry_assignmentId_idx" ON "PrepaidCardEntry"("assignmentId");
CREATE INDEX "PrepaidCardEntry_purchaseInvoiceId_idx" ON "PrepaidCardEntry"("purchaseInvoiceId");
CREATE INDEX "PrepaidCardEntry_lossId_idx" ON "PrepaidCardEntry"("lossId");

UPDATE "PrepaidCardEntry" e
SET "assignmentId" = a."id"
FROM "PrepaidCardAssignment" a
WHERE e."prepaidCardId" = a."prepaidCardId" AND a."endedAt" IS NULL;

ALTER TABLE "PrepaidCardEntry"
  ADD CONSTRAINT "PrepaidCardEntry_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "PrepaidCardAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrepaidCardEntry"
  ADD CONSTRAINT "PrepaidCardEntry_relatedCardId_fkey"
  FOREIGN KEY ("relatedCardId") REFERENCES "PrepaidCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrepaidCardEntry"
  ADD CONSTRAINT "PrepaidCardEntry_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PrepaidCardLoss" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "prepaidCardId" TEXT NOT NULL,
    "leftoverAmount" DECIMAL(14,2) NOT NULL,
    "recoveryKind" "PrepaidCardLossRecoveryKind" NOT NULL,
    "employeeId" TEXT,
    "bankAccountId" TEXT,
    "writtenOffAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepaidCardLoss_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrepaidCardLoss_companyId_writtenOffAt_idx" ON "PrepaidCardLoss"("companyId", "writtenOffAt");
CREATE INDEX "PrepaidCardLoss_prepaidCardId_idx" ON "PrepaidCardLoss"("prepaidCardId");
CREATE INDEX "PrepaidCardLoss_employeeId_idx" ON "PrepaidCardLoss"("employeeId");

ALTER TABLE "PrepaidCardLoss"
  ADD CONSTRAINT "PrepaidCardLoss_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrepaidCardLoss"
  ADD CONSTRAINT "PrepaidCardLoss_prepaidCardId_fkey"
  FOREIGN KEY ("prepaidCardId") REFERENCES "PrepaidCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrepaidCardLoss"
  ADD CONSTRAINT "PrepaidCardLoss_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrepaidCardLoss"
  ADD CONSTRAINT "PrepaidCardLoss_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PrepaidCardLossRecovery" (
    "id" TEXT NOT NULL,
    "lossId" TEXT NOT NULL,
    "source" "PrepaidCardRecoverySource" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "recoveredAt" TIMESTAMP(3) NOT NULL,
    "bankAccountId" TEXT,
    "payrollDeductionId" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepaidCardLossRecovery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrepaidCardLossRecovery_payrollDeductionId_key" ON "PrepaidCardLossRecovery"("payrollDeductionId");
CREATE INDEX "PrepaidCardLossRecovery_lossId_idx" ON "PrepaidCardLossRecovery"("lossId");
CREATE INDEX "PrepaidCardLossRecovery_bankAccountId_idx" ON "PrepaidCardLossRecovery"("bankAccountId");

ALTER TABLE "PrepaidCardLossRecovery"
  ADD CONSTRAINT "PrepaidCardLossRecovery_lossId_fkey"
  FOREIGN KEY ("lossId") REFERENCES "PrepaidCardLoss"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrepaidCardLossRecovery"
  ADD CONSTRAINT "PrepaidCardLossRecovery_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseInvoice" ADD COLUMN "prepaidCardId" TEXT;
CREATE INDEX "PurchaseInvoice_prepaidCardId_idx" ON "PurchaseInvoice"("prepaidCardId");
ALTER TABLE "PurchaseInvoice"
  ADD CONSTRAINT "PurchaseInvoice_prepaidCardId_fkey"
  FOREIGN KEY ("prepaidCardId") REFERENCES "PrepaidCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PrepaidCardEntry"
  ADD CONSTRAINT "PrepaidCardEntry_purchaseInvoiceId_fkey"
  FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrepaidCardEntry"
  ADD CONSTRAINT "PrepaidCardEntry_lossId_fkey"
  FOREIGN KEY ("lossId") REFERENCES "PrepaidCardLoss"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollDeduction" ADD COLUMN "prepaidCardLossId" TEXT;
CREATE INDEX "PayrollDeduction_prepaidCardLossId_idx" ON "PayrollDeduction"("prepaidCardLossId");
ALTER TABLE "PayrollDeduction"
  ADD CONSTRAINT "PayrollDeduction_prepaidCardLossId_fkey"
  FOREIGN KEY ("prepaidCardLossId") REFERENCES "PrepaidCardLoss"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PrepaidCardLossRecovery"
  ADD CONSTRAINT "PrepaidCardLossRecovery_payrollDeductionId_fkey"
  FOREIGN KEY ("payrollDeductionId") REFERENCES "PayrollDeduction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
