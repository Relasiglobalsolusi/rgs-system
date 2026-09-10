-- Freeze the wage-cost split per site when a payroll run is locked, so the
-- Financial Report reads the locked run instead of re-reading live CICO.
ALTER TABLE "InternalPayrollLock"
  ADD COLUMN IF NOT EXISTS "wageSites" JSONB;
