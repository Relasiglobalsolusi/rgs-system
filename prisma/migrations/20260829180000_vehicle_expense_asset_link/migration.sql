-- Link vehicle expenses (servicing / modification / other) to an inventory vehicle.
ALTER TABLE "PurchaseInvoice" ADD COLUMN "vehicleAssetId" TEXT;
ALTER TABLE "PurchaseInvoice" ADD COLUMN "vehicleOtherCostDescription" TEXT;

CREATE INDEX "PurchaseInvoice_vehicleAssetId_idx" ON "PurchaseInvoice"("vehicleAssetId");

ALTER TABLE "PurchaseInvoice"
  ADD CONSTRAINT "PurchaseInvoice_vehicleAssetId_fkey"
  FOREIGN KEY ("vehicleAssetId") REFERENCES "EquipmentAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
