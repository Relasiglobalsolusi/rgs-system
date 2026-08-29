-- Vehicle condition (new/used) and lease snapshot on purchases and inventory assets.
-- Year, condition, and lease are set at purchase and are not edited later.

CREATE TYPE "VehicleCondition" AS ENUM ('NEW', 'USED');

ALTER TABLE "PurchaseInvoice" ADD COLUMN "vehicleCondition" "VehicleCondition";

ALTER TABLE "EquipmentAsset" ADD COLUMN "vehicleCondition" "VehicleCondition";
ALTER TABLE "EquipmentAsset" ADD COLUMN "isVehicleLease" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EquipmentAsset" ADD COLUMN "leaseOtrAmount" DECIMAL(14,2);
ALTER TABLE "EquipmentAsset" ADD COLUMN "leaseDownPayment" DECIMAL(14,2);
ALTER TABLE "EquipmentAsset" ADD COLUMN "leaseTenorMonths" INTEGER;
ALTER TABLE "EquipmentAsset" ADD COLUMN "leaseInterestPercentYear" DECIMAL(6,3);
ALTER TABLE "EquipmentAsset" ADD COLUMN "leaseAdminFee" DECIMAL(14,2);
ALTER TABLE "EquipmentAsset" ADD COLUMN "leaseInsuranceAmount" DECIMAL(14,2);
ALTER TABLE "EquipmentAsset" ADD COLUMN "leaseFiduciaryFee" DECIMAL(14,2);
ALTER TABLE "EquipmentAsset" ADD COLUMN "leaseProvisionFee" DECIMAL(14,2);
ALTER TABLE "EquipmentAsset" ADD COLUMN "leaseOtherFee" DECIMAL(14,2);
ALTER TABLE "EquipmentAsset" ADD COLUMN "leaseMonthlyInstallment" DECIMAL(14,2);
