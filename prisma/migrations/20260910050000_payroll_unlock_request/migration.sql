-- Reopening a closed payroll period goes through the owner. Anyone with the
-- Payroll module may ask; only the owner decides.

DO $$ BEGIN
  CREATE TYPE "PayrollUnlockRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "PayrollUnlockRequest" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "run" "PayrollRunKind" NOT NULL DEFAULT 'PROJECT_CYCLE',
  "reason" TEXT NOT NULL,
  "status" "PayrollUnlockRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT,
  "requestedByName" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedById" TEXT,
  "decidedByName" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollUnlockRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PayrollUnlockRequest_companyId_status_idx"
  ON "PayrollUnlockRequest"("companyId", "status");
CREATE INDEX IF NOT EXISTS "PayrollUnlockRequest_companyId_year_month_run_idx"
  ON "PayrollUnlockRequest"("companyId", "year", "month", "run");
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollUnlockRequest_one_pending_period_key"
  ON "PayrollUnlockRequest"("companyId", "year", "month", "run")
  WHERE "status" = 'PENDING';

DO $$ BEGIN
  ALTER TABLE "PayrollUnlockRequest"
    ADD CONSTRAINT "PayrollUnlockRequest_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PayrollUnlockRequest"
    ADD CONSTRAINT "PayrollUnlockRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PayrollUnlockRequest"
    ADD CONSTRAINT "PayrollUnlockRequest_decidedById_fkey"
    FOREIGN KEY ("decidedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
