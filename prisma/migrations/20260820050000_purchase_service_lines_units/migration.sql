-- Service expense lines do not need a catalog item.
-- Product lines can store purchase unit and pack contents.

ALTER TABLE "PurchaseInvoiceLine" ALTER COLUMN "itemId" DROP NOT NULL;
ALTER TABLE "PurchaseInvoiceLine" ADD COLUMN "description" TEXT;
ALTER TABLE "PurchaseInvoiceLine" ADD COLUMN "unit" TEXT;
ALTER TABLE "PurchaseInvoiceLine" ADD COLUMN "packContents" DECIMAL(14,3);
