-- AlterTable
ALTER TABLE "EmployeeCategory" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 100;

-- Backfill known category importance order (lower = more important)
UPDATE "EmployeeCategory" SET "sortOrder" = 10 WHERE "prefix" = 'HO';
UPDATE "EmployeeCategory" SET "sortOrder" = 20 WHERE "prefix" = 'OPR';
UPDATE "EmployeeCategory" SET "sortOrder" = 30 WHERE "prefix" = 'FIN';
UPDATE "EmployeeCategory" SET "sortOrder" = 40 WHERE "prefix" = 'CS';
UPDATE "EmployeeCategory" SET "sortOrder" = 50 WHERE "prefix" = 'GCS';
UPDATE "EmployeeCategory" SET "sortOrder" = 60 WHERE "prefix" = 'GON';
