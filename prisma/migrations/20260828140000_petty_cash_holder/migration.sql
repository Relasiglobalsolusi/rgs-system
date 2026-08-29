-- Per-employee Petty Cash wallets. Legacy rows stay on the company pool (holder null).

ALTER TYPE "PettyCashEntryKind" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
ALTER TYPE "PettyCashEntryKind" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';

ALTER TABLE "PettyCashEntry" ADD COLUMN IF NOT EXISTS "holderEmployeeId" TEXT;
ALTER TABLE "PettyCashEntry" ADD COLUMN IF NOT EXISTS "relatedEmployeeId" TEXT;

CREATE INDEX IF NOT EXISTS "PettyCashEntry_holderEmployeeId_idx" ON "PettyCashEntry"("holderEmployeeId");
CREATE INDEX IF NOT EXISTS "PettyCashEntry_relatedEmployeeId_idx" ON "PettyCashEntry"("relatedEmployeeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PettyCashEntry_holderEmployeeId_fkey'
  ) THEN
    ALTER TABLE "PettyCashEntry"
      ADD CONSTRAINT "PettyCashEntry_holderEmployeeId_fkey"
      FOREIGN KEY ("holderEmployeeId") REFERENCES "Employee"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PettyCashEntry_relatedEmployeeId_fkey'
  ) THEN
    ALTER TABLE "PettyCashEntry"
      ADD CONSTRAINT "PettyCashEntry_relatedEmployeeId_fkey"
      FOREIGN KEY ("relatedEmployeeId") REFERENCES "Employee"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
