-- CreateEnum
CREATE TYPE "ThrPaymentStatus" AS ENUM ('DRAFT', 'GENERATED', 'PAID');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "basePay" DECIMAL(14,2),
ADD COLUMN "bpjsKesehatanEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "bpjsKetenagakerjaanEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "jhtEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "jpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "jkkEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "jkmEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "jkkPercent" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "ThrPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "hariRayaDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "basePaySnapshot" DECIMAL(14,2) NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "status" "ThrPaymentStatus" NOT NULL DEFAULT 'GENERATED',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThrPayment_companyId_year_idx" ON "ThrPayment"("companyId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ThrPayment_employeeId_year_key" ON "ThrPayment"("employeeId", "year");

-- AddForeignKey
ALTER TABLE "ThrPayment" ADD CONSTRAINT "ThrPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrPayment" ADD CONSTRAINT "ThrPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
