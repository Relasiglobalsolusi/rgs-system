-- Track litres filled and km-per-litre so remaining fuel can be estimated.

ALTER TABLE "EquipmentAsset" ADD COLUMN "kmPerLitreMin" DECIMAL(8,2);
ALTER TABLE "EquipmentAsset" ADD COLUMN "kmPerLitreMax" DECIMAL(8,2);
ALTER TABLE "EquipmentAsset" ADD COLUMN "lastFillLitres" DECIMAL(8,2);
ALTER TABLE "EquipmentAsset" ADD COLUMN "estimatedFuelLeftLitresMin" DECIMAL(8,2);
ALTER TABLE "EquipmentAsset" ADD COLUMN "estimatedFuelLeftLitresMax" DECIMAL(8,2);

ALTER TABLE "VehicleOdometerReading" ADD COLUMN "litresFilled" DECIMAL(8,2);
ALTER TABLE "VehicleOdometerReading" ADD COLUMN "fuelUsedLitresMin" DECIMAL(8,2);
ALTER TABLE "VehicleOdometerReading" ADD COLUMN "fuelUsedLitresMax" DECIMAL(8,2);
ALTER TABLE "VehicleOdometerReading" ADD COLUMN "fuelLeftBeforeMin" DECIMAL(8,2);
ALTER TABLE "VehicleOdometerReading" ADD COLUMN "fuelLeftBeforeMax" DECIMAL(8,2);
ALTER TABLE "VehicleOdometerReading" ADD COLUMN "fuelLeftAfterMin" DECIMAL(8,2);
ALTER TABLE "VehicleOdometerReading" ADD COLUMN "fuelLeftAfterMax" DECIMAL(8,2);
ALTER TABLE "VehicleOdometerReading" ADD COLUMN "expectedKmMin" INTEGER;
ALTER TABLE "VehicleOdometerReading" ADD COLUMN "expectedKmMax" INTEGER;
