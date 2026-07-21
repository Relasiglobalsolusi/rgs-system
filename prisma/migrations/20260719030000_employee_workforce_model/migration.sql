-- Employee workforce model: Placement, EmploymentType, Position.
-- Testing wipe: delete all employees (cascading staff history) for a clean reshape.
-- Projects / clients / vendors are kept. Staff portal users (non-admin) are removed.

-- 1) Enums
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME');
CREATE TYPE "Placement" AS ENUM ('AVAILABLE', 'ON_PROJECT', 'HEAD_OFFICE', 'FIELD');

-- 2) Position table
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Position_categoryId_slug_key" ON "Position"("categoryId", "slug");
CREATE UNIQUE INDEX "Position_categoryId_name_key" ON "Position"("categoryId", "name");
CREATE INDEX "Position_companyId_categoryId_idx" ON "Position"("companyId", "categoryId");

ALTER TABLE "Position" ADD CONSTRAINT "Position_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EmployeeCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Testing wipe of employees
DELETE FROM "LeaveApprovalAck";
DELETE FROM "LeaveRequest";
DELETE FROM "ProgressWarningAck";
DELETE FROM "ProgressReportPhoto";
DELETE FROM "ProgressReport";
DELETE FROM "ProgressPhoto";
DELETE FROM "DailyProgress";
DELETE FROM "Attendance";
DELETE FROM "ProjectAssignment";

-- Collect staff user ids before employee delete
CREATE TEMP TABLE "_staff_users_to_drop" AS
SELECT DISTINCT e."userId" AS "id"
FROM "Employee" e
WHERE e."userId" IS NOT NULL;

UPDATE "Employee" SET "userId" = NULL;
DELETE FROM "Employee";

-- Drop orphaned staff portal users (keep client/vendor + core admin usernames)
DELETE FROM "PasswordResetToken"
WHERE "userId" IN (SELECT "id" FROM "_staff_users_to_drop");
DELETE FROM "User"
WHERE "id" IN (SELECT "id" FROM "_staff_users_to_drop")
  AND "clientId" IS NULL
  AND "vendorId" IS NULL
  AND "username" NOT IN ('vicko', 'admin', 'manager');

DROP TABLE "_staff_users_to_drop";

-- 4) Employee workforce columns
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_assignmentScopeId_fkey";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "assignmentScopeId";

ALTER TABLE "Employee" ADD COLUMN "positionId" TEXT;
ALTER TABLE "Employee" ADD COLUMN "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME';
ALTER TABLE "Employee" ADD COLUMN "placement" "Placement" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "Employee" ADD COLUMN "portalAccessRequested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN "loginRevokedReason" TEXT;

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5) Drop AssignmentScopeConfig (replaced by Placement)
DROP TABLE IF EXISTS "AssignmentScopeConfig";

-- 6) Retire UNA / CS / GCS / GON; rename Head Office → Corporate (prefix COR)
DELETE FROM "EmployeeCategory"
WHERE "prefix" IN ('UNA', 'CS', 'GCS', 'GON')
   OR "slug" IN ('unassign', 'cleaning-staff', 'general-cleaning-staff', 'gondola');

UPDATE "EmployeeCategory"
SET
  "name" = 'Corporate',
  "slug" = 'corporate',
  "prefix" = 'COR',
  "sortOrder" = 10,
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" IN ('head-office', 'corporate') OR "prefix" IN ('HO', 'COR');

-- Ensure Corporate / Operations / Finance for every company
INSERT INTO "EmployeeCategory" ("id", "name", "slug", "prefix", "active", "sortOrder", "companyId", "createdAt", "updatedAt")
SELECT
  md5(c."id" || ':corporate'),
  'Corporate',
  'corporate',
  'COR',
  true,
  10,
  c."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1 FROM "EmployeeCategory" ec
  WHERE ec."companyId" = c."id" AND ec."slug" = 'corporate'
);

INSERT INTO "EmployeeCategory" ("id", "name", "slug", "prefix", "active", "sortOrder", "companyId", "createdAt", "updatedAt")
SELECT
  md5(c."id" || ':operations'),
  'Operations',
  'operations',
  'OPR',
  true,
  20,
  c."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1 FROM "EmployeeCategory" ec
  WHERE ec."companyId" = c."id" AND ec."slug" = 'operations'
);

INSERT INTO "EmployeeCategory" ("id", "name", "slug", "prefix", "active", "sortOrder", "companyId", "createdAt", "updatedAt")
SELECT
  md5(c."id" || ':finance'),
  'Finance',
  'finance',
  'FIN',
  true,
  30,
  c."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1 FROM "EmployeeCategory" ec
  WHERE ec."companyId" = c."id" AND ec."slug" = 'finance'
);

UPDATE "EmployeeCategory"
SET "sortOrder" = 20, "name" = 'Operations', "active" = true, "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'operations';

UPDATE "EmployeeCategory"
SET "sortOrder" = 30, "name" = 'Finance', "active" = true, "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'finance';

-- 7) Seed default positions (Corporate / Operations / Finance)
INSERT INTO "Position" ("id", "name", "slug", "description", "sortOrder", "active", "categoryId", "companyId", "createdAt", "updatedAt")
SELECT
  md5(ec."id" || ':' || p.slug),
  p.name,
  p.slug,
  p.description,
  p.sort_order,
  true,
  ec."id",
  ec."companyId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "EmployeeCategory" ec
CROSS JOIN (
  VALUES
    ('admin', 'Admin', 'Corporate administration', 10),
    ('director', 'Director', 'Company director / leadership', 20),
    ('in-house-cleaning-staff', 'In-house cleaning staff', 'Internal facility cleaning', 30)
) AS p(slug, name, description, sort_order)
WHERE ec."slug" = 'corporate'
ON CONFLICT DO NOTHING;

INSERT INTO "Position" ("id", "name", "slug", "description", "sortOrder", "active", "categoryId", "companyId", "createdAt", "updatedAt")
SELECT
  md5(ec."id" || ':' || p.slug),
  p.name,
  p.slug,
  p.description,
  p.sort_order,
  true,
  ec."id",
  ec."companyId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "EmployeeCategory" ec
CROSS JOIN (
  VALUES
    ('cleaning-staff', 'Cleaning staff', 'Regular cleaning crew', 10),
    ('gc-staff', 'GC staff', 'General cleaning / gondola crew', 20),
    ('operations-manager', 'Operations Manager', 'Field operations leadership', 30)
) AS p(slug, name, description, sort_order)
WHERE ec."slug" = 'operations'
ON CONFLICT DO NOTHING;

INSERT INTO "Position" ("id", "name", "slug", "description", "sortOrder", "active", "categoryId", "companyId", "createdAt", "updatedAt")
SELECT
  md5(ec."id" || ':' || p.slug),
  p.name,
  p.slug,
  p.description,
  p.sort_order,
  true,
  ec."id",
  ec."companyId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "EmployeeCategory" ec
CROSS JOIN (
  VALUES
    ('accountant', 'Accountant', 'Finance accounting', 10),
    ('finance-admin', 'Finance admin', 'Finance administration', 20)
) AS p(slug, name, description, sort_order)
WHERE ec."slug" = 'finance'
ON CONFLICT DO NOTHING;
