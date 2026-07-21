-- AlterEnum
ALTER TYPE "InvoicePeriodStatus" ADD VALUE 'AWAITING_CLIENT_REVIEW';

-- CreateEnum
CREATE TYPE "ClientReviewKind" AS ENUM ('RECONCILIATION', 'PROGRESS');

-- CreateEnum
CREATE TYPE "ClientReviewStatus" AS ENUM (
  'NONE',
  'AWAITING_CLIENT',
  'CLIENT_APPROVED',
  'CLIENT_REVISED',
  'HO_APPROVED_REVISION',
  'HO_REJECTED_REVISION'
);

-- AlterTable
ALTER TABLE "ProjectInvoicePeriod"
  ADD COLUMN "clientReviewKind" "ClientReviewKind",
  ADD COLUMN "clientReviewStatus" "ClientReviewStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "reviewReportPdfPath" TEXT,
  ADD COLUMN "reviewSentToClientAt" TIMESTAMP(3),
  ADD COLUMN "clientReviewedAt" TIMESTAMP(3),
  ADD COLUMN "clientRevisionNote" TEXT,
  ADD COLUMN "clientRevisionProofPath" TEXT,
  ADD COLUMN "hoReviewNote" TEXT,
  ADD COLUMN "hoReviewProofPath" TEXT,
  ADD COLUMN "hoReviewedAt" TIMESTAMP(3),
  ADD COLUMN "hoReviewedById" TEXT,
  ADD COLUMN "revisedInvoiceAmount" DECIMAL(14,2),
  ADD COLUMN "revisedInvoiceNumber" TEXT;

-- CreateIndex
CREATE INDEX "ProjectInvoicePeriod_clientReviewStatus_idx"
  ON "ProjectInvoicePeriod"("clientReviewStatus");

-- AddForeignKey
ALTER TABLE "ProjectInvoicePeriod"
  ADD CONSTRAINT "ProjectInvoicePeriod_hoReviewedById_fkey"
  FOREIGN KEY ("hoReviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "BillingClientReviewEvent" (
  "id" TEXT NOT NULL,
  "invoicePeriodId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "note" TEXT,
  "proofPath" TEXT,
  "statusAfter" "ClientReviewStatus",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingClientReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingClientReviewEvent_invoicePeriodId_createdAt_idx"
  ON "BillingClientReviewEvent"("invoicePeriodId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingClientReviewEvent_userId_idx"
  ON "BillingClientReviewEvent"("userId");

-- AddForeignKey
ALTER TABLE "BillingClientReviewEvent"
  ADD CONSTRAINT "BillingClientReviewEvent_invoicePeriodId_fkey"
  FOREIGN KEY ("invoicePeriodId") REFERENCES "ProjectInvoicePeriod"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingClientReviewEvent"
  ADD CONSTRAINT "BillingClientReviewEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
