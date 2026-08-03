-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "tracksStock" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PurchaseInvoiceLine" (
    "id" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "totalPrice" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "InventoryPurchase" ADD COLUMN "purchaseInvoiceLineId" TEXT;

-- CreateIndex
CREATE INDEX "PurchaseInvoiceLine_purchaseInvoiceId_idx" ON "PurchaseInvoiceLine"("purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "PurchaseInvoiceLine_itemId_idx" ON "PurchaseInvoiceLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPurchase_purchaseInvoiceLineId_key" ON "InventoryPurchase"("purchaseInvoiceLineId");

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceLine" ADD CONSTRAINT "PurchaseInvoiceLine_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceLine" ADD CONSTRAINT "PurchaseInvoiceLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPurchase" ADD CONSTRAINT "InventoryPurchase_purchaseInvoiceLineId_fkey" FOREIGN KEY ("purchaseInvoiceLineId") REFERENCES "PurchaseInvoiceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
