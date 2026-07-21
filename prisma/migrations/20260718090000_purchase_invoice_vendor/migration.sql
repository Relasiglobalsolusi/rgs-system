-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN "vendorId" TEXT;

-- CreateIndex
CREATE INDEX "PurchaseInvoice_vendorId_idx" ON "PurchaseInvoice"("vendorId");

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
