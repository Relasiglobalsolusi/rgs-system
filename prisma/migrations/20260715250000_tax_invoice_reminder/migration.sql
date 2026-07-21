-- Tax invoice (faktur) reminder checklist: project flag + per-period queue state.

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "requiresTaxInvoice" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProjectInvoicePeriod"
  ADD COLUMN IF NOT EXISTS "taxInvoiceRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProjectInvoicePeriod"
  ADD COLUMN IF NOT EXISTS "taxInvoiceDoneAt" TIMESTAMP(3);

ALTER TABLE "ProjectInvoicePeriod"
  ADD COLUMN IF NOT EXISTS "taxInvoiceDoneById" TEXT;

CREATE INDEX IF NOT EXISTS "ProjectInvoicePeriod_taxInvoiceRequired_taxInvoiceDoneAt_idx"
  ON "ProjectInvoicePeriod"("taxInvoiceRequired", "taxInvoiceDoneAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ProjectInvoicePeriod_taxInvoiceDoneById_fkey'
  ) THEN
    ALTER TABLE "ProjectInvoicePeriod"
      ADD CONSTRAINT "ProjectInvoicePeriod_taxInvoiceDoneById_fkey"
      FOREIGN KEY ("taxInvoiceDoneById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Queue already-issued invoices on tax-enabled projects that were never flagged.
UPDATE "ProjectInvoicePeriod" AS pip
SET "taxInvoiceRequired" = true
FROM "Project" AS p
WHERE pip."projectId" = p.id
  AND p."requiresTaxInvoice" = true
  AND pip."taxInvoiceRequired" = false
  AND pip."status" IN ('AWAITING_PAYMENT', 'OVERDUE', 'PAID');
