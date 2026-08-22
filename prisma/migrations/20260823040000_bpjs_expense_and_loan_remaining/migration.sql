DO $$ BEGIN
  CREATE TYPE "BpjsProgram" AS ENUM ('KESEHATAN', 'KETENAGAKERJAAN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TYPE "GovernmentTaxKind" ADD VALUE IF NOT EXISTS 'BPJS_KESEHATAN';
ALTER TYPE "GovernmentTaxKind" ADD VALUE IF NOT EXISTS 'BPJS_KETENAGAKERJAAN';

ALTER TABLE "PurchaseInvoice"
  ADD COLUMN IF NOT EXISTS "governmentOperatingAmount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "loanProvisionAmount" DECIMAL(14,2);

ALTER TABLE "LoanFacility"
  ADD COLUMN IF NOT EXISTS "dayCountYear" INTEGER NOT NULL DEFAULT 360;

ALTER TABLE "PettyCashEntry"
  ADD COLUMN IF NOT EXISTS "extractedAmount" DECIMAL(14,2);

CREATE TABLE IF NOT EXISTS "BpjsRemittance" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "program" "BpjsProgram" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "paidAt" DATE NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "purchaseInvoiceId" TEXT,
  "companyShareAmount" DECIMAL(14,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BpjsRemittance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BpjsRemittance_companyId_year_month_program_idx"
  ON "BpjsRemittance"("companyId", "year", "month", "program");
CREATE INDEX IF NOT EXISTS "BpjsRemittance_purchaseInvoiceId_idx"
  ON "BpjsRemittance"("purchaseInvoiceId");

DO $$ BEGIN
  ALTER TABLE "BpjsRemittance" ADD CONSTRAINT "BpjsRemittance_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BpjsRemittance" ADD CONSTRAINT "BpjsRemittance_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BpjsRemittance" ADD CONSTRAINT "BpjsRemittance_purchaseInvoiceId_fkey"
    FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
