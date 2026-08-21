-- Land and Building Tax on government + commercial tax pickers.
-- OM / Area Manager can cover every project or pick projects one by one.

ALTER TYPE "GovernmentTaxKind" ADD VALUE IF NOT EXISTS 'PBB';
ALTER TYPE "GovernmentTaxKind" ADD VALUE IF NOT EXISTS 'PPH_22';
ALTER TYPE "CommercialTaxKind" ADD VALUE IF NOT EXISTS 'PBB';

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "manageAllProjects" BOOLEAN NOT NULL DEFAULT false;
