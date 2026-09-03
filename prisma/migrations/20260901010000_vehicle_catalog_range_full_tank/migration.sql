-- Predicted km/L lives on the vehicle catalog type. First full fill is the tank size.

ALTER TABLE "InventoryItem" ADD COLUMN "kmPerLitreMin" DECIMAL(8,2);
ALTER TABLE "InventoryItem" ADD COLUMN "kmPerLitreMax" DECIMAL(8,2);

ALTER TABLE "EquipmentAsset" ADD COLUMN "fullTankLitres" DECIMAL(8,2);
