-- AlterTable
ALTER TABLE "Client" ADD COLUMN "clientSince" TIMESTAMP(3);

-- Backfill existing clients from record creation date
UPDATE "Client" SET "clientSince" = "createdAt" WHERE "clientSince" IS NULL;

ALTER TABLE "Client" ALTER COLUMN "clientSince" SET NOT NULL;
ALTER TABLE "Client" ALTER COLUMN "clientSince" SET DEFAULT CURRENT_TIMESTAMP;
