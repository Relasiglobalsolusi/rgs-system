-- Odometer tracking on company vehicles. Fuel fills record km traveled.

ALTER TABLE "EquipmentAsset" ADD COLUMN "currentOdometerKm" INTEGER;
ALTER TABLE "EquipmentAsset" ADD COLUMN "initialOdometerKm" INTEGER;
ALTER TABLE "EquipmentAsset" ADD COLUMN "expectedRangeKm" INTEGER;

CREATE TYPE "VehicleOdometerKind" AS ENUM ('INITIAL', 'REFUEL');
CREATE TYPE "VehicleOdometerSource" AS ENUM ('MANUAL', 'PETTY_CASH', 'PREPAID', 'PURCHASE_INVOICE');

CREATE TABLE "VehicleOdometerReading" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleAssetId" TEXT NOT NULL,
    "readingKm" INTEGER NOT NULL,
    "previousReadingKm" INTEGER,
    "kmTraveled" INTEGER,
    "kind" "VehicleOdometerKind" NOT NULL,
    "source" "VehicleOdometerSource" NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "prepaidCardEntryId" TEXT,
    "pettyCashEntryId" TEXT,
    "purchaseInvoiceId" TEXT,
    "createdById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleOdometerReading_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleOdometerReading_prepaidCardEntryId_key" ON "VehicleOdometerReading"("prepaidCardEntryId");
CREATE UNIQUE INDEX "VehicleOdometerReading_pettyCashEntryId_key" ON "VehicleOdometerReading"("pettyCashEntryId");
CREATE UNIQUE INDEX "VehicleOdometerReading_purchaseInvoiceId_key" ON "VehicleOdometerReading"("purchaseInvoiceId");
CREATE INDEX "VehicleOdometerReading_companyId_flagged_acknowledgedAt_idx" ON "VehicleOdometerReading"("companyId", "flagged", "acknowledgedAt");
CREATE INDEX "VehicleOdometerReading_vehicleAssetId_recordedAt_idx" ON "VehicleOdometerReading"("vehicleAssetId", "recordedAt");

ALTER TABLE "VehicleOdometerReading" ADD CONSTRAINT "VehicleOdometerReading_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleOdometerReading" ADD CONSTRAINT "VehicleOdometerReading_vehicleAssetId_fkey" FOREIGN KEY ("vehicleAssetId") REFERENCES "EquipmentAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleOdometerReading" ADD CONSTRAINT "VehicleOdometerReading_prepaidCardEntryId_fkey" FOREIGN KEY ("prepaidCardEntryId") REFERENCES "PrepaidCardEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VehicleOdometerReading" ADD CONSTRAINT "VehicleOdometerReading_pettyCashEntryId_fkey" FOREIGN KEY ("pettyCashEntryId") REFERENCES "PettyCashEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VehicleOdometerReading" ADD CONSTRAINT "VehicleOdometerReading_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VehicleOdometerReading" ADD CONSTRAINT "VehicleOdometerReading_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VehicleOdometerReading" ADD CONSTRAINT "VehicleOdometerReading_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
