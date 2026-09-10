-- Two Internal Payroll runs per month, prepaid cards tied to a plate,
-- and factory refunds booked to a company bank.

DO $$ BEGIN
  CREATE TYPE "PayrollRunKind" AS ENUM ('PROJECT_CYCLE', 'HEAD_OFFICE_MONTHLY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "payrollRun" "PayrollRunKind" NOT NULL DEFAULT 'PROJECT_CYCLE';

ALTER TABLE "PayrollDeduction"
  ADD COLUMN IF NOT EXISTS "run" "PayrollRunKind" NOT NULL DEFAULT 'PROJECT_CYCLE';

DROP INDEX IF EXISTS "PayrollDeduction_employeeId_year_month_idx";
DROP INDEX IF EXISTS "PayrollDeduction_companyId_year_month_idx";
CREATE INDEX IF NOT EXISTS "PayrollDeduction_employeeId_year_month_run_idx"
  ON "PayrollDeduction"("employeeId", "year", "month", "run");
CREATE INDEX IF NOT EXISTS "PayrollDeduction_companyId_year_month_run_idx"
  ON "PayrollDeduction"("companyId", "year", "month", "run");

ALTER TABLE "InternalPayrollLock"
  ADD COLUMN IF NOT EXISTS "run" "PayrollRunKind" NOT NULL DEFAULT 'PROJECT_CYCLE';

DROP INDEX IF EXISTS "InternalPayrollLock_companyId_year_month_key";
CREATE UNIQUE INDEX IF NOT EXISTS "InternalPayrollLock_companyId_year_month_run_key"
  ON "InternalPayrollLock"("companyId", "year", "month", "run");

ALTER TABLE "PrepaidCard"
  ADD COLUMN IF NOT EXISTS "vehicleAssetId" TEXT;
CREATE INDEX IF NOT EXISTS "PrepaidCard_companyId_vehicleAssetId_idx"
  ON "PrepaidCard"("companyId", "vehicleAssetId");

ALTER TABLE "PrepaidCardAssignment"
  ADD COLUMN IF NOT EXISTS "vehicleAssetId" TEXT;
CREATE INDEX IF NOT EXISTS "PrepaidCardAssignment_vehicleAssetId_idx"
  ON "PrepaidCardAssignment"("vehicleAssetId");

ALTER TABLE "EquipmentFactoryReturn"
  ADD COLUMN IF NOT EXISTS "bankAccountId" TEXT;
CREATE INDEX IF NOT EXISTS "EquipmentFactoryReturn_bankAccountId_idx"
  ON "EquipmentFactoryReturn"("bankAccountId");

DO $$ BEGIN
  ALTER TABLE "PrepaidCard"
    ADD CONSTRAINT "PrepaidCard_vehicleAssetId_fkey"
    FOREIGN KEY ("vehicleAssetId") REFERENCES "EquipmentAsset"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PrepaidCardAssignment"
    ADD CONSTRAINT "PrepaidCardAssignment_vehicleAssetId_fkey"
    FOREIGN KEY ("vehicleAssetId") REFERENCES "EquipmentAsset"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "EquipmentFactoryReturn"
    ADD CONSTRAINT "EquipmentFactoryReturn_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
