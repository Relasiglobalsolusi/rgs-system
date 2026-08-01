-- Unused: tax identity lives in Client.npwp (NPWP or NIK). nationalId was never written by the app.
ALTER TABLE "Client" DROP COLUMN IF EXISTS "nationalId";
