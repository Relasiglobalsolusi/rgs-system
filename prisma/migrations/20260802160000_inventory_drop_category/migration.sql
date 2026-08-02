-- Drop Category from inventory catalog (Item Type covers classification).
ALTER TABLE "InventoryItem" DROP COLUMN IF EXISTS "category";
