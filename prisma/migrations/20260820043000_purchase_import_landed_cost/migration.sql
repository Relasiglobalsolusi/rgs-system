-- Local vs overseas product expenses, with Indonesian import charges.

CREATE TYPE "PurchaseOrigin" AS ENUM ('LOCAL', 'IMPORT');
CREATE TYPE "ImportPph22Basis" AS ENUM ('API', 'WITHOUT_API', 'CUSTOM');

ALTER TABLE "PurchaseInvoice"
  ADD COLUMN "origin" "PurchaseOrigin" NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN "invoiceCurrency" TEXT,
  ADD COLUMN "invoiceForeignAmount" DECIMAL(14,4),
  ADD COLUMN "exchangeRateToIdr" DECIMAL(18,6),
  ADD COLUMN "invoiceAmountIdr" DECIMAL(14,2),
  ADD COLUMN "freightIdr" DECIMAL(14,2),
  ADD COLUMN "insuranceIdr" DECIMAL(14,2),
  ADD COLUMN "bankFeeIdr" DECIMAL(14,2),
  ADD COLUMN "clearanceCostIdr" DECIMAL(14,2),
  ADD COLUMN "formEApplied" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "beaMasukApplied" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "beaMasukRatePercent" DECIMAL(5,2),
  ADD COLUMN "beaMasukAmountIdr" DECIMAL(14,2),
  ADD COLUMN "ppnbmApplied" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ppnbmRatePercent" DECIMAL(5,2),
  ADD COLUMN "ppnbmAmountIdr" DECIMAL(14,2),
  ADD COLUMN "importPpnAmountIdr" DECIMAL(14,2),
  ADD COLUMN "pph22Applied" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pph22Basis" "ImportPph22Basis",
  ADD COLUMN "pph22RatePercent" DECIMAL(5,2),
  ADD COLUMN "pph22AmountIdr" DECIMAL(14,2),
  ADD COLUMN "customsValueIdr" DECIMAL(14,2),
  ADD COLUMN "importValueIdr" DECIMAL(14,2),
  ADD COLUMN "stockLandedCostIdr" DECIMAL(14,2);
