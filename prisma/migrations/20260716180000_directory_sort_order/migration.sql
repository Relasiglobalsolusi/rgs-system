-- Directory / ERP-wide manual row order
ALTER TABLE "Department" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Client" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Employee" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProgressReport" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill from current list conventions (stable within each company)
WITH ordered AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "name" ASC, id ASC) * 10 AS "sortOrder"
  FROM "Department"
)
UPDATE "Department" d SET "sortOrder" = o."sortOrder" FROM ordered o WHERE d.id = o.id;

WITH ordered AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "name" ASC, id ASC) * 10 AS "sortOrder"
  FROM "Client"
)
UPDATE "Client" c SET "sortOrder" = o."sortOrder" FROM ordered o WHERE c.id = o.id;

WITH ordered AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "employeeNo" ASC, id ASC) * 10 AS "sortOrder"
  FROM "Employee"
)
UPDATE "Employee" e SET "sortOrder" = o."sortOrder" FROM ordered o WHERE e.id = o.id;

WITH ordered AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt" DESC, id ASC) * 10 AS "sortOrder"
  FROM "User"
)
UPDATE "User" u SET "sortOrder" = o."sortOrder" FROM ordered o WHERE u.id = o.id;

WITH ordered AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt" DESC, id ASC) * 10 AS "sortOrder"
  FROM "Project"
)
UPDATE "Project" p SET "sortOrder" = o."sortOrder" FROM ordered o WHERE p.id = o.id;

WITH ordered AS (
  SELECT pr.id,
    ROW_NUMBER() OVER (
      PARTITION BY p."companyId"
      ORDER BY pr."createdAt" DESC, pr.id ASC
    ) * 10 AS "sortOrder"
  FROM "ProgressReport" pr
  INNER JOIN "Project" p ON p.id = pr."projectId"
)
UPDATE "ProgressReport" pr SET "sortOrder" = o."sortOrder" FROM ordered o WHERE pr.id = o.id;
