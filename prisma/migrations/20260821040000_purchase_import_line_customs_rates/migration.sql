-- Own Customs Rate (NDPBM) when freight / insurance is not included
-- in the factory invoice. Unused for Rupiah lines.

ALTER TABLE "PurchaseInvoice" ADD COLUMN IF NOT EXISTS "freightCustomsRateToIdr" DECIMAL(18,6);
ALTER TABLE "PurchaseInvoice" ADD COLUMN IF NOT EXISTS "insuranceCustomsRateToIdr" DECIMAL(18,6);
