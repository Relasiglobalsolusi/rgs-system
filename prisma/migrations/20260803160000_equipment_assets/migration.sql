-- CreateEnum
CREATE TYPE "EquipmentAssetStatus" AS ENUM ('AVAILABLE', 'ON_PROJECT', 'RETIRED');

-- CreateTable
CREATE TABLE "EquipmentAsset" (
    "id" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "status" "EquipmentAssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "itemId" TEXT NOT NULL,
    "projectId" TEXT,
    "movementId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "serialNo" TEXT,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentAsset_movementId_key" ON "EquipmentAsset"("movementId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentAsset_companyId_assetCode_key" ON "EquipmentAsset"("companyId", "assetCode");

-- CreateIndex
CREATE INDEX "EquipmentAsset_companyId_status_idx" ON "EquipmentAsset"("companyId", "status");

-- CreateIndex
CREATE INDEX "EquipmentAsset_itemId_status_idx" ON "EquipmentAsset"("itemId", "status");

-- CreateIndex
CREATE INDEX "EquipmentAsset_projectId_idx" ON "EquipmentAsset"("projectId");

-- AddForeignKey
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "InventoryMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
