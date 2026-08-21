-- Tax kind on local expenses (Tax Included) and on client projects (what we charge).

CREATE TYPE "CommercialTaxKind" AS ENUM ('PPN', 'PPH_23', 'PPN_AND_PPH_23', 'PPH_4_2', 'OTHER');

ALTER TABLE "Project"
  ADD COLUMN "chargedTaxKind" "CommercialTaxKind",
  ADD COLUMN "pphRatePercent" DECIMAL(5,2);

ALTER TABLE "PurchaseInvoice"
  ADD COLUMN "includedTaxKind" "CommercialTaxKind",
  ADD COLUMN "pphRatePercent" DECIMAL(5,2);

UPDATE "Project"
SET "chargedTaxKind" = 'PPN'
WHERE "requiresTaxInvoice" = true
  AND "subCategory" <> 'INTERNAL';

UPDATE "PurchaseInvoice"
SET "includedTaxKind" = 'PPN'
WHERE "includesPpn" = true
  AND "purchaseCategory" <> 'GOVERNMENT'
  AND "origin" <> 'IMPORT';
