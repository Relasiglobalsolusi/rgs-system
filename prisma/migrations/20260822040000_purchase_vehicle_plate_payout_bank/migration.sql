-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN "vehiclePlate" TEXT;

-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN "bankAccountId" TEXT;

-- CreateIndex
CREATE INDEX "PurchaseInvoice_bankAccountId_idx" ON "PurchaseInvoice"("bankAccountId");

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop unused petty-cash OCR amount
ALTER TABLE "PettyCashEntry" DROP COLUMN IF EXISTS "extractedAmount";
