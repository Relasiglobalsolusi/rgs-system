-- Manual overtime (lembur) payable on Internal Payroll, plus per-employee enable flag.
ALTER TYPE "PayrollDeductionType" ADD VALUE IF NOT EXISTS 'OVERTIME';

ALTER TABLE "Employee" ADD COLUMN "overtimeEnabled" BOOLEAN NOT NULL DEFAULT false;
