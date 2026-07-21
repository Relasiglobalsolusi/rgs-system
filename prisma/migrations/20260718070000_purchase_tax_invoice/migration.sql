-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN "taxInvoiceFilePath" TEXT,
ADD COLUMN "taxInvoiceUploadedAt" TIMESTAMP(3);
