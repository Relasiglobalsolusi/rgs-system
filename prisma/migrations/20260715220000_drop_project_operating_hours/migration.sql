-- Remove project site operating hours (informational only; CICO was never gated by them).
-- is24Hours may already be dropped by 20260715210000_drop_project_is24_hours.
ALTER TABLE "Project" DROP COLUMN IF EXISTS "is24Hours";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "operatingHoursStart";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "operatingHoursEnd";
