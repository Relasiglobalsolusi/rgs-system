-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN "taxInvoiceSerial" TEXT,
ADD COLUMN "taxInvoiceIssuedAt" DATE,
ADD COLUMN "taxInvoiceDocumentHash" TEXT;

-- CreateIndex
CREATE INDEX "PurchaseInvoice_taxInvoiceSerial_idx" ON "PurchaseInvoice"("taxInvoiceSerial");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_taxInvoiceDocumentHash_idx" ON "PurchaseInvoice"("taxInvoiceDocumentHash");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_taxInvoiceIssuedAt_amount_idx" ON "PurchaseInvoice"("taxInvoiceIssuedAt", "amount");
