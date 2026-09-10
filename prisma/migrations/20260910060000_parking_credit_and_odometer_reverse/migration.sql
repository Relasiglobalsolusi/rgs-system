-- Parking income books on the bank credit date, labeled as the parking month.
ALTER TABLE "ParkingMonthlyLog" ADD COLUMN "creditedAt" DATE;
ALTER TABLE "ParkingMonthlyLog" ADD COLUMN "bankAccountId" TEXT;

ALTER TABLE "ParkingMonthlyLog" ADD CONSTRAINT "ParkingMonthlyLog_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ParkingMonthlyLog_bankAccountId_creditedAt_idx" ON "ParkingMonthlyLog"("bankAccountId", "creditedAt");

-- Keep reversed odometer readings; current km falls back to the last live reading.
ALTER TABLE "VehicleOdometerReading" ADD COLUMN "reversedAt" TIMESTAMP(3);

-- Employee Paying Balance Due (and similar banked project income) follows the receiving bank.
ALTER TABLE "ProjectExpense" ADD COLUMN "bankAccountId" TEXT;
ALTER TABLE "ProjectExpense" ADD CONSTRAINT "ProjectExpense_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ProjectExpense_bankAccountId_idx" ON "ProjectExpense"("bankAccountId");
