-- Link WRITE_OFF movements to discrete equipment assets retired by that write-off.
ALTER TABLE "EquipmentAsset" ADD COLUMN "writeOffMovementId" TEXT;

-- CreateIndex
CREATE INDEX "EquipmentAsset_writeOffMovementId_idx" ON "EquipmentAsset"("writeOffMovementId");

-- AddForeignKey
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_writeOffMovementId_fkey" FOREIGN KEY ("writeOffMovementId") REFERENCES "InventoryMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
