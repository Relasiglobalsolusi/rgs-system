-- AlterTable
ALTER TABLE "ProjectInvoicePeriod" ADD COLUMN "taxInvoiceSerial" TEXT,
ADD COLUMN "taxInvoiceIssuedAt" DATE,
ADD COLUMN "taxInvoiceDocumentHash" TEXT;

-- CreateIndex
CREATE INDEX "ProjectInvoicePeriod_taxInvoiceSerial_idx" ON "ProjectInvoicePeriod"("taxInvoiceSerial");

-- CreateIndex
CREATE INDEX "ProjectInvoicePeriod_taxInvoiceDocumentHash_idx" ON "ProjectInvoicePeriod"("taxInvoiceDocumentHash");

-- CreateIndex
CREATE INDEX "ProjectInvoicePeriod_taxInvoiceIssuedAt_amount_idx" ON "ProjectInvoicePeriod"("taxInvoiceIssuedAt", "amount");
