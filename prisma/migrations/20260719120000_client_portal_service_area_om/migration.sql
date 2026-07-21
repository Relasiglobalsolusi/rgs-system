-- Client portal model, Multi-Project Access, Service Area, OM Approval Areas
CREATE TYPE "ServiceArea" AS ENUM ('CLEANING', 'PARKING', 'SECURITY');
CREATE TYPE "ClientType" AS ENUM ('COMPANY', 'INDIVIDUAL');
CREATE TYPE "MultiProjectSecurityMode" AS ENUM ('GROUP_ONLY', 'MASTER_AND_GROUP');
CREATE TYPE "BillingPeriodBasis" AS ENUM ('CALENDAR_MONTH', 'CONTRACT_CYCLE');
CREATE TYPE "ClientSecurityCodeKind" AS ENUM ('MASTER', 'GROUP');

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "clientType" "ClientType" NOT NULL DEFAULT 'COMPANY';
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "multiProjectAccess" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "multiProjectSecurityMode" "MultiProjectSecurityMode";
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "nameNormalized" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "nationalId" TEXT;

UPDATE "Client" SET "nameNormalized" = lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
WHERE "nameNormalized" IS NULL;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "serviceArea" "ServiceArea" NOT NULL DEFAULT 'CLEANING';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "billingPeriodBasis" "BillingPeriodBasis";
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "contractDocumentUrl" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "groupId" TEXT;

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "omApprovalAreas" "ServiceArea"[] NOT NULL DEFAULT ARRAY[]::"ServiceArea"[];

CREATE TABLE IF NOT EXISTS "ClientProjectGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "clientId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientProjectGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientSecurityCode" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "codeHint" TEXT,
  "kind" "ClientSecurityCodeKind" NOT NULL,
  "clientId" TEXT NOT NULL,
  "groupId" TEXT,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "faceTemplateRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientSecurityCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientContractExtension" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "extendedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "previousEndDate" TIMESTAMP(3) NOT NULL,
  "newEndDate" TIMESTAMP(3) NOT NULL,
  "proofUrl" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientContractExtension_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ClientProjectGroup" ADD CONSTRAINT "ClientProjectGroup_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClientSecurityCode" ADD CONSTRAINT "ClientSecurityCode_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClientSecurityCode" ADD CONSTRAINT "ClientSecurityCode_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "ClientProjectGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClientContractExtension" ADD CONSTRAINT "ClientContractExtension_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "ClientProjectGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ClientProjectGroup_clientId_idx" ON "ClientProjectGroup"("clientId");
CREATE INDEX IF NOT EXISTS "ClientSecurityCode_clientId_idx" ON "ClientSecurityCode"("clientId");
CREATE INDEX IF NOT EXISTS "ClientContractExtension_projectId_idx" ON "ClientContractExtension"("projectId");
CREATE INDEX IF NOT EXISTS "Project_serviceArea_idx" ON "Project"("serviceArea");
CREATE INDEX IF NOT EXISTS "Project_groupId_idx" ON "Project"("groupId");
CREATE INDEX IF NOT EXISTS "Client_companyId_nameNormalized_idx" ON "Client"("companyId", "nameNormalized");
