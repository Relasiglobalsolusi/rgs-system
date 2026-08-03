-- Material Requests → Transfer Orders (Ops inventory flow)
-- Idempotent: safe when tables already exist from prior db push.

DO $$ BEGIN
  CREATE TYPE "MaterialRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TransferOrderStatus" AS ENUM ('PENDING_SEND', 'SENT', 'RECEIVED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "MaterialRequest" (
  "id" TEXT NOT NULL,
  "status" "MaterialRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "notes" TEXT,
  "reviewNote" TEXT,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaterialRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MaterialRequestLine" (
  "id" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "notes" TEXT,
  "materialRequestId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  CONSTRAINT "MaterialRequestLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TransferOrder" (
  "id" TEXT NOT NULL,
  "status" "TransferOrderStatus" NOT NULL DEFAULT 'PENDING_SEND',
  "notes" TEXT,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "materialRequestId" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "sentById" TEXT,
  "receivedAt" TIMESTAMP(3),
  "receivedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransferOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TransferOrderLine" (
  "id" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "transferOrderId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  CONSTRAINT "TransferOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TransferOrder_materialRequestId_key" ON "TransferOrder"("materialRequestId");
CREATE INDEX IF NOT EXISTS "MaterialRequest_companyId_status_idx" ON "MaterialRequest"("companyId", "status");
CREATE INDEX IF NOT EXISTS "MaterialRequest_projectId_idx" ON "MaterialRequest"("projectId");
CREATE INDEX IF NOT EXISTS "MaterialRequest_requestedById_idx" ON "MaterialRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "MaterialRequestLine_materialRequestId_idx" ON "MaterialRequestLine"("materialRequestId");
CREATE INDEX IF NOT EXISTS "MaterialRequestLine_itemId_idx" ON "MaterialRequestLine"("itemId");
CREATE INDEX IF NOT EXISTS "TransferOrder_companyId_status_idx" ON "TransferOrder"("companyId", "status");
CREATE INDEX IF NOT EXISTS "TransferOrder_projectId_idx" ON "TransferOrder"("projectId");
CREATE INDEX IF NOT EXISTS "TransferOrderLine_transferOrderId_idx" ON "TransferOrderLine"("transferOrderId");
CREATE INDEX IF NOT EXISTS "TransferOrderLine_itemId_idx" ON "TransferOrderLine"("itemId");

DO $$ BEGIN
  ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MaterialRequestLine" ADD CONSTRAINT "MaterialRequestLine_materialRequestId_fkey"
    FOREIGN KEY ("materialRequestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MaterialRequestLine" ADD CONSTRAINT "MaterialRequestLine_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TransferOrder" ADD CONSTRAINT "TransferOrder_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TransferOrder" ADD CONSTRAINT "TransferOrder_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TransferOrder" ADD CONSTRAINT "TransferOrder_materialRequestId_fkey"
    FOREIGN KEY ("materialRequestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TransferOrder" ADD CONSTRAINT "TransferOrder_sentById_fkey"
    FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TransferOrder" ADD CONSTRAINT "TransferOrder_receivedById_fkey"
    FOREIGN KEY ("receivedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TransferOrderLine" ADD CONSTRAINT "TransferOrderLine_transferOrderId_fkey"
    FOREIGN KEY ("transferOrderId") REFERENCES "TransferOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TransferOrderLine" ADD CONSTRAINT "TransferOrderLine_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
