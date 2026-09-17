-- Company cash at hand: withdraw from a bank into unlocated cash, spend on expenses.

CREATE TYPE "CompanyCashMovementKind" AS ENUM ('WITHDRAW', 'SPEND');

ALTER TABLE "PurchaseInvoice" ADD COLUMN "paidWithCash" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "PurchaseInvoice_companyId_paidWithCash_idx" ON "PurchaseInvoice"("companyId", "paidWithCash");

CREATE TABLE "CompanyCashMovement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "CompanyCashMovementKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "occurredAt" DATE NOT NULL,
    "bankAccountId" TEXT,
    "purchaseInvoiceId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyCashMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyCashMovement_purchaseInvoiceId_key" ON "CompanyCashMovement"("purchaseInvoiceId");
CREATE INDEX "CompanyCashMovement_companyId_occurredAt_idx" ON "CompanyCashMovement"("companyId", "occurredAt");
CREATE INDEX "CompanyCashMovement_companyId_kind_reversedAt_idx" ON "CompanyCashMovement"("companyId", "kind", "reversedAt");
CREATE INDEX "CompanyCashMovement_bankAccountId_idx" ON "CompanyCashMovement"("bankAccountId");

ALTER TABLE "CompanyCashMovement" ADD CONSTRAINT "CompanyCashMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyCashMovement" ADD CONSTRAINT "CompanyCashMovement_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyCashMovement" ADD CONSTRAINT "CompanyCashMovement_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyCashMovement" ADD CONSTRAINT "CompanyCashMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
