-- AlterTable
ALTER TABLE "Project" ADD COLUMN "downPaymentPercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "ProjectInvoicePeriod" ADD COLUMN "isDownPayment" BOOLEAN NOT NULL DEFAULT false;
