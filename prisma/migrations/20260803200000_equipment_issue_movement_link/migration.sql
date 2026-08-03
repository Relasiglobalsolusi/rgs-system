-- Link bulk ISSUE_TO_PROJECT movements to discrete equipment assets (many assets per movement).
ALTER TABLE "EquipmentAsset" ADD COLUMN "issueMovementId" TEXT;

-- CreateIndex
CREATE INDEX "EquipmentAsset_issueMovementId_idx" ON "EquipmentAsset"("issueMovementId");

-- AddForeignKey
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_issueMovementId_fkey" FOREIGN KEY ("issueMovementId") REFERENCES "InventoryMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
