-- AlterEnum
CREATE TYPE "PurchaseCategory" AS ENUM ('PRODUCT', 'SERVICE');

-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN "purchaseCategory" "PurchaseCategory" NOT NULL DEFAULT 'PRODUCT';
ALTER TABLE "PurchaseInvoice" ADD COLUMN "ppnRatePercent" DECIMAL(5,2);
