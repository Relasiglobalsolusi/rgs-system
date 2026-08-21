UPDATE "Project"
SET "chargedTaxKind" = 'PPN'
WHERE "requiresTaxInvoice" = true
  AND "subCategory" <> 'INTERNAL'
  AND "chargedTaxKind" IS NULL;

UPDATE "PurchaseInvoice"
SET "includedTaxKind" = 'PPN'
WHERE "includesPpn" = true
  AND "purchaseCategory" <> 'GOVERNMENT'
  AND "origin" <> 'IMPORT'
  AND "includedTaxKind" IS NULL;
