-- AlterTable
ALTER TABLE "Client" ADD COLUMN "paymentTermsDays" INTEGER NOT NULL DEFAULT 14;

-- AlterTable
ALTER TABLE "ProjectInvoicePeriod" ADD COLUMN "reconciledAt" TIMESTAMP(3),
ADD COLUMN "reconciledById" TEXT;

-- AddForeignKey
ALTER TABLE "ProjectInvoicePeriod" ADD CONSTRAINT "ProjectInvoicePeriod_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
