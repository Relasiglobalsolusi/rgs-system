-- Spec tank size on the vehicle catalog type. Fill tolerance is 10% in app logic.

ALTER TABLE "InventoryItem" ADD COLUMN "fuelTankLitres" DECIMAL(8,2);
