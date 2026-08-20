-- Transfer Order send books stock as IN_TRANSIT until site receive.
ALTER TYPE "InventoryMovementType" ADD VALUE 'IN_TRANSIT';
ALTER TYPE "EquipmentAssetStatus" ADD VALUE 'IN_TRANSIT';
