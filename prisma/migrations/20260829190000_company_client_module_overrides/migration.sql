-- Company-wide default module access for client portal logins.
ALTER TABLE "Company" ADD COLUMN "clientModuleOverrides" JSONB;
