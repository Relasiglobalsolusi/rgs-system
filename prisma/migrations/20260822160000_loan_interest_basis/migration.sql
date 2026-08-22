DO $$ BEGIN
  CREATE TYPE "LoanInterestBasis" AS ENUM ('MONTHLY', 'ANNUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "LoanFacility"
  ADD COLUMN IF NOT EXISTS "interestRateBasis" "LoanInterestBasis" NOT NULL DEFAULT 'ANNUAL';

ALTER TABLE "PurchaseInvoice"
  ADD COLUMN IF NOT EXISTS "bankLoanInterestRateBasis" "LoanInterestBasis",
  ADD COLUMN IF NOT EXISTS "loanInterestPeriod" TEXT,
  ADD COLUMN IF NOT EXISTS "loanPenaltyAmount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "loanAdminFeeAmount" DECIMAL(14,2);

CREATE INDEX IF NOT EXISTS "PurchaseInvoice_loanFacilityId_loanInterestPeriod_idx"
  ON "PurchaseInvoice"("loanFacilityId", "loanInterestPeriod");
