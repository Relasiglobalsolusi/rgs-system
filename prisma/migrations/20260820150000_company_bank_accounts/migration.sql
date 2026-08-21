-- CreateTable
CREATE TABLE "CompanyBankAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyBankAccount_companyId_sortOrder_idx" ON "CompanyBankAccount"("companyId", "sortOrder");

-- AddForeignKey
ALTER TABLE "CompanyBankAccount" ADD CONSTRAINT "CompanyBankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate the existing single Company bank into the first Bank row.
INSERT INTO "CompanyBankAccount" ("id", "companyId", "bankName", "accountNumber", "accountHolder", "sortOrder", "createdAt")
SELECT
    CONCAT('cba_', "id"),
    "id",
    COALESCE(NULLIF(TRIM("bankName"), ''), 'Bank'),
    TRIM("bankAccountNumber"),
    COALESCE(NULLIF(TRIM("bankAccountName"), ''), TRIM("name")),
    0,
    CURRENT_TIMESTAMP
FROM "Company"
WHERE "bankAccountNumber" IS NOT NULL
  AND TRIM("bankAccountNumber") <> '';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "bankAccountId" TEXT;

-- AlterTable
ALTER TABLE "ProjectInvoicePeriod" ADD COLUMN "bankAccountId" TEXT;

-- AlterTable
ALTER TABLE "InventorySale" ADD COLUMN "bankAccountId" TEXT;

-- CreateIndex
CREATE INDEX "Project_bankAccountId_idx" ON "Project"("bankAccountId");

-- CreateIndex
CREATE INDEX "ProjectInvoicePeriod_bankAccountId_idx" ON "ProjectInvoicePeriod"("bankAccountId");

-- CreateIndex
CREATE INDEX "InventorySale_bankAccountId_idx" ON "InventorySale"("bankAccountId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInvoicePeriod" ADD CONSTRAINT "ProjectInvoicePeriod_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySale" ADD CONSTRAINT "InventorySale_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
