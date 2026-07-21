-- Add Unassign (UNA) employee category for each company and backfill legacy unassigned employees.

INSERT INTO "EmployeeCategory" ("id", "name", "slug", "prefix", "active", "sortOrder", "companyId", "createdAt", "updatedAt")
SELECT
  'una_cat_' || c."id",
  'Unassign',
  'unassign',
  'UNA',
  true,
  70,
  c."id",
  NOW(),
  NOW()
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmployeeCategory" ec
  WHERE ec."companyId" = c."id"
    AND ec."prefix" = 'UNA'
);

UPDATE "Employee" e
SET "categoryId" = ec."id"
FROM "EmployeeCategory" ec
WHERE e."categoryId" IS NULL
  AND e."assignmentScope" = 'UNASSIGNED'
  AND ec."companyId" = e."companyId"
  AND ec."prefix" = 'UNA';
