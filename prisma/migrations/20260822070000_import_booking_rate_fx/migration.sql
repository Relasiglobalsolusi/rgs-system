-- Booking Rate stays on exchangeRateToIdr. These store the Bank Rate used
-- when a Net import is paid, and the Head Office rate difference.
ALTER TABLE "PurchaseInvoice" ADD COLUMN IF NOT EXISTS "paidExchangeRateToIdr" DECIMAL(18,6);
ALTER TABLE "PurchaseInvoice" ADD COLUMN IF NOT EXISTS "importFxDifferenceIdr" DECIMAL(14,2);
