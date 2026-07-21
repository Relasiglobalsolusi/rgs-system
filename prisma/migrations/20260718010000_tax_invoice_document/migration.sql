-- AlterTable
ALTER TABLE "ProjectInvoicePeriod" ADD COLUMN "taxInvoiceDocumentPath" TEXT,
ADD COLUMN "taxInvoiceDocumentUploadedAt" TIMESTAMP(3);
