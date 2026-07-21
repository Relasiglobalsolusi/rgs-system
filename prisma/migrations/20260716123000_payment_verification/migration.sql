-- AlterEnum
ALTER TYPE "InvoicePeriodStatus" ADD VALUE 'PENDING_VERIFICATION';

-- AlterTable
ALTER TABLE "ProjectInvoicePeriod" ADD COLUMN "paymentProofPath" TEXT,
ADD COLUMN "paymentProofUploadedAt" TIMESTAMP(3),
ADD COLUMN "paymentVerifiedAt" TIMESTAMP(3),
ADD COLUMN "paymentVerifiedById" TEXT;

-- AddForeignKey
ALTER TABLE "ProjectInvoicePeriod" ADD CONSTRAINT "ProjectInvoicePeriod_paymentVerifiedById_fkey" FOREIGN KEY ("paymentVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
