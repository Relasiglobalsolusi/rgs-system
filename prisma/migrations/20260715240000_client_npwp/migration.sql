-- Add optional company tax ID (NPWP) on Client.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "npwp" TEXT;
