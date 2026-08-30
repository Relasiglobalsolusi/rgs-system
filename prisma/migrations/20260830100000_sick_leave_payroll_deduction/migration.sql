-- Manual sick-leave deduction from Approvals (amount entered by the reviewer).
ALTER TYPE "PayrollDeductionType" ADD VALUE IF NOT EXISTS 'SICK_LEAVE';

ALTER TABLE "PayrollDeduction" ADD COLUMN "leaveRequestId" TEXT;

CREATE UNIQUE INDEX "PayrollDeduction_leaveRequestId_key" ON "PayrollDeduction"("leaveRequestId");

ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
