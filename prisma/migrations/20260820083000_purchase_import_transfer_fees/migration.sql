-- Currency + amount for freight, insurance, bank charge, and full-amount fee.
-- Local bank fee is always Rupiah.

ALTER TABLE "PurchaseInvoice"
  ADD COLUMN "freightCurrency" TEXT,
  ADD COLUMN "freightForeignAmount" DECIMAL(14,4),
  ADD COLUMN "insuranceCurrency" TEXT,
  ADD COLUMN "insuranceForeignAmount" DECIMAL(14,4),
  ADD COLUMN "bankFeeCurrency" TEXT,
  ADD COLUMN "bankFeeForeignAmount" DECIMAL(14,4),
  ADD COLUMN "fullAmountFeeCurrency" TEXT,
  ADD COLUMN "fullAmountFeeForeignAmount" DECIMAL(14,4),
  ADD COLUMN "fullAmountFeeIdr" DECIMAL(14,2),
  ADD COLUMN "localBankFeeIdr" DECIMAL(14,2);
