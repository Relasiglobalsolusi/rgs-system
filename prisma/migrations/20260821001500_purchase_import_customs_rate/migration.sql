-- Customs Rate is separate from Bank Rate (exchangeRateToIdr).
-- Existing import expenses used one rate for both payment and duties.
-- Copy that stored rate into customsRateToIdr so historical CIF / duties stay unchanged.

ALTER TABLE "PurchaseInvoice" ADD COLUMN IF NOT EXISTS "customsRateToIdr" DECIMAL(18,6);

UPDATE "PurchaseInvoice"
SET "customsRateToIdr" = "exchangeRateToIdr"
WHERE "exchangeRateToIdr" IS NOT NULL
  AND "customsRateToIdr" IS NULL;
