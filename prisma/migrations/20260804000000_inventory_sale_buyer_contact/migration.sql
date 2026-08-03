-- Buyer contact / identity fields for Sold Off (InventorySale).
-- Idempotent for environments that already received columns via db push.

ALTER TABLE "InventorySale" ADD COLUMN IF NOT EXISTS "buyerPicName" TEXT;
ALTER TABLE "InventorySale" ADD COLUMN IF NOT EXISTS "buyerIdNumber" TEXT;
ALTER TABLE "InventorySale" ADD COLUMN IF NOT EXISTS "buyerTaxId" TEXT;
ALTER TABLE "InventorySale" ADD COLUMN IF NOT EXISTS "buyerRegistration" TEXT;
ALTER TABLE "InventorySale" ADD COLUMN IF NOT EXISTS "buyerPhone" TEXT;
ALTER TABLE "InventorySale" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "InventorySale" ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "InventorySale" ADD COLUMN IF NOT EXISTS "taxRatePercent" DECIMAL(5,2);
