-- Per-currency Customs Rates for CIF, plus own remittance rate when
-- freight / insurance is not included in the factory invoice.

ALTER TABLE "PurchaseInvoice" ADD COLUMN IF NOT EXISTS "customsRatesToIdr" JSONB;
ALTER TABLE "PurchaseInvoice" ADD COLUMN IF NOT EXISTS "freightIncludedInInvoice" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PurchaseInvoice" ADD COLUMN IF NOT EXISTS "freightRateToIdr" DECIMAL(18,6);
ALTER TABLE "PurchaseInvoice" ADD COLUMN IF NOT EXISTS "insuranceIncludedInInvoice" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PurchaseInvoice" ADD COLUMN IF NOT EXISTS "insuranceRateToIdr" DECIMAL(18,6);

UPDATE "PurchaseInvoice"
SET "customsRatesToIdr" = jsonb_build_object(
  UPPER(COALESCE(NULLIF(TRIM("invoiceCurrency"), ''), 'USD')),
  "customsRateToIdr"
)
WHERE "origin" = 'IMPORT'
  AND "customsRateToIdr" IS NOT NULL
  AND ("customsRatesToIdr" IS NULL OR "customsRatesToIdr" = 'null'::jsonb);
