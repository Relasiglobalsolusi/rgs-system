-- Reassign employees from duplicate category rows to the keeper (lowest sortOrder, then oldest).
WITH ranked AS (
  SELECT
    id,
    "companyId",
    prefix,
    ROW_NUMBER() OVER (
      PARTITION BY "companyId", prefix
      ORDER BY "sortOrder" ASC, "createdAt" ASC
    ) AS rn
  FROM "EmployeeCategory"
),
keepers AS (
  SELECT id, "companyId", prefix FROM ranked WHERE rn = 1
),
dupes AS (
  SELECT id AS dupe_id, "companyId", prefix FROM ranked WHERE rn > 1
)
UPDATE "Employee" e
SET "categoryId" = k.id
FROM dupes d
JOIN keepers k ON k."companyId" = d."companyId" AND k.prefix = d.prefix
WHERE e."categoryId" = d.dupe_id;

-- Remove duplicate category rows.
DELETE FROM "EmployeeCategory"
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "companyId", prefix
        ORDER BY "sortOrder" ASC, "createdAt" ASC
      ) AS rn
    FROM "EmployeeCategory"
  ) ranked
  WHERE rn > 1
);

-- Enforce one prefix per company.
CREATE UNIQUE INDEX "EmployeeCategory_companyId_prefix_key" ON "EmployeeCategory"("companyId", "prefix");
