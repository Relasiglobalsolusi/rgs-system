ALTER TYPE "PurchaseCategory" ADD VALUE IF NOT EXISTS 'GOVERNMENT';

CREATE TYPE "GovernmentTaxKind" AS ENUM (
  'PPN',
  'PPH_25',
  'PPH_29',
  'PPH_21',
  'PPH_23',
  'PPH_4_2',
  'STAMP_DUTY',
  'OTHER'
);

ALTER TABLE "PurchaseInvoice" ADD COLUMN "governmentTaxKind" "GovernmentTaxKind";
