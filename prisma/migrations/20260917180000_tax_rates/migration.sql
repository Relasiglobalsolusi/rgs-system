DO $$ BEGIN
  CREATE TYPE "TaxRateAppliesTo" AS ENUM ('CLIENT_CHARGE', 'CORPORATE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "TaxRateType" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "appliesTo" "TaxRateAppliesTo" NOT NULL,
  "commercialKind" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TaxRateType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TaxRateVersion" (
  "id" TEXT NOT NULL,
  "typeId" TEXT NOT NULL,
  "ratePercent" DECIMAL(7,4) NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TaxRateVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaxRateType_companyId_code_key" ON "TaxRateType"("companyId", "code");
CREATE INDEX IF NOT EXISTS "TaxRateType_companyId_appliesTo_idx" ON "TaxRateType"("companyId", "appliesTo");
CREATE UNIQUE INDEX IF NOT EXISTS "TaxRateVersion_typeId_effectiveFrom_key" ON "TaxRateVersion"("typeId", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "TaxRateVersion_typeId_effectiveFrom_idx" ON "TaxRateVersion"("typeId", "effectiveFrom");

DO $$ BEGIN
  ALTER TABLE "TaxRateType"
    ADD CONSTRAINT "TaxRateType_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TaxRateVersion"
    ADD CONSTRAINT "TaxRateVersion_typeId_fkey"
    FOREIGN KEY ("typeId") REFERENCES "TaxRateType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
