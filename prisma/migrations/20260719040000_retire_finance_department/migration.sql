-- Retire Finance department: finance roles become Corporate positions.
-- Migrate FIN employees to Corporate with a new COR number.
-- Title-case default position names/descriptions.

-- 1) Ensure Corporate + Operations exist
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

-- 2) Ensure Corporate finance positions (Title Case)
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
    ('accountant', 'Accountant', 'Finance Accounting', 40),
    ('finance-admin', 'Finance Admin', 'Finance Administration', 50)
) AS p(slug, name, description, sort_order)
WHERE ec."slug" = 'corporate'
ON CONFLICT DO NOTHING;

-- 3) Move finance-category positions onto Corporate (by slug), then re-point employees
UPDATE "Employee" e
SET
  "categoryId" = corp."id",
  "positionId" = corp_pos."id",
  "position" = corp_pos."name",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "EmployeeCategory" fin
JOIN "EmployeeCategory" corp
  ON corp."companyId" = fin."companyId" AND corp."slug" = 'corporate'
JOIN "Position" fin_pos
  ON fin_pos."categoryId" = fin."id"
JOIN "Position" corp_pos
  ON corp_pos."categoryId" = corp."id" AND corp_pos."slug" = fin_pos."slug"
WHERE (fin."slug" = 'finance' OR upper(fin."prefix") = 'FIN')
  AND e."categoryId" = fin."id"
  AND fin_pos."id" = e."positionId";

-- Employees on Finance with no matching position slug -> Corporate Accountant
UPDATE "Employee" e
SET
  "categoryId" = corp."id",
  "positionId" = acct."id",
  "position" = acct."name",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "EmployeeCategory" fin
JOIN "EmployeeCategory" corp
  ON corp."companyId" = fin."companyId" AND corp."slug" = 'corporate'
JOIN "Position" acct
  ON acct."categoryId" = corp."id" AND acct."slug" = 'accountant'
WHERE (fin."slug" = 'finance' OR upper(fin."prefix") = 'FIN')
  AND e."categoryId" = fin."id";

-- 4) Reassign FIN-* employee numbers to next COR-* (never reuse COR sequences).
-- Park FIN numbers with ~retired-fin~ so FIN sequences stay occupied if FIN returns.
UPDATE "Employee" e
SET
  "employeeNo" = e."employeeNo" || '~retired-fin~' || left(e."id", 8),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE e."employeeNo" ~* '^FIN-[0-9]+$'
  AND e."employeeNo" NOT LIKE '%~retired-fin~%';

-- Assign next available COR number for parked FIN employees now under Corporate
WITH corp AS (
  SELECT ec."id" AS "categoryId", ec."companyId", ec."prefix"
  FROM "EmployeeCategory" ec
  WHERE ec."slug" = 'corporate'
),
ranked AS (
  SELECT
    e."id",
    e."companyId",
    corp."categoryId",
    upper(corp."prefix") AS prefix,
    ROW_NUMBER() OVER (
      PARTITION BY e."companyId"
      ORDER BY e."employeeNo", e."id"
    ) AS rn
  FROM "Employee" e
  JOIN corp ON corp."companyId" = e."companyId"
  WHERE e."employeeNo" LIKE '%~retired-fin~%'
    AND e."categoryId" = corp."categoryId"
),
used AS (
  SELECT
    e."companyId",
    COALESCE(
      MAX(
        CASE
          WHEN e."employeeNo" ~* ('^' || upper(c."prefix") || '-[0-9]+')
          THEN CAST(substring(e."employeeNo" FROM '[0-9]+') AS INTEGER)
          ELSE 0
        END
      ),
      0
    ) AS max_seq
  FROM "Employee" e
  JOIN "EmployeeCategory" c
    ON c."id" = e."categoryId" AND c."slug" = 'corporate'
  WHERE e."employeeNo" NOT LIKE '%~retired-fin~%'
  GROUP BY e."companyId"
)
UPDATE "Employee" e
SET
  "employeeNo" = ranked.prefix || '-' || lpad((COALESCE(used.max_seq, 0) + ranked.rn)::text, 3, '0'),
  "updatedAt" = CURRENT_TIMESTAMP
FROM ranked
LEFT JOIN used ON used."companyId" = ranked."companyId"
WHERE e."id" = ranked."id";

-- 5) Delete Finance positions, then Finance categories
DELETE FROM "Position" p
USING "EmployeeCategory" fin
WHERE p."categoryId" = fin."id"
  AND (fin."slug" = 'finance' OR upper(fin."prefix") = 'FIN');

DELETE FROM "EmployeeCategory"
WHERE "slug" = 'finance' OR upper("prefix") = 'FIN';

-- 6) Title Case known default position names/descriptions
UPDATE "Position" SET "name" = 'Admin', "description" = 'Corporate Administration', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'admin';
UPDATE "Position" SET "name" = 'Director', "description" = 'Company Director / Leadership', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'director';
UPDATE "Position" SET "name" = 'In-House Cleaning Staff', "description" = 'Internal Facility Cleaning', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'in-house-cleaning-staff';
UPDATE "Position" SET "name" = 'Accountant', "description" = 'Finance Accounting', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'accountant';
UPDATE "Position" SET "name" = 'Finance Admin', "description" = 'Finance Administration', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'finance-admin';
UPDATE "Position" SET "name" = 'Cleaning Staff', "description" = 'Regular Cleaning Crew', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'cleaning-staff';
UPDATE "Position" SET "name" = 'GC Staff', "description" = 'General Cleaning / Gondola Crew', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'gc-staff';
UPDATE "Position" SET "name" = 'Operations Manager', "description" = 'Field Operations Leadership', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'operations-manager';

UPDATE "Employee" e
SET "position" = p."name", "updatedAt" = CURRENT_TIMESTAMP
FROM "Position" p
WHERE e."positionId" = p."id" AND e."position" IS DISTINCT FROM p."name";
