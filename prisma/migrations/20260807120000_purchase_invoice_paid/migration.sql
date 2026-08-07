-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "paymentProofPath" TEXT,
ADD COLUMN "paidById" TEXT;

-- CreateIndex
CREATE INDEX "PurchaseInvoice_companyId_paidAt_idx" ON "PurchaseInvoice"("companyId", "paidAt");

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
