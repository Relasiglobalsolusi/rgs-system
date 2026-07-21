-- Lightweight client short codes for billing upload filenames (e.g. C001).
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "shortCode" TEXT;

-- Backfill by creation order within each company (C001, C002, …).
WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "companyId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "Client"
  WHERE "shortCode" IS NULL OR btrim("shortCode") = ''
)
UPDATE "Client" AS c
SET "shortCode" = 'C' || lpad(ordered.rn::text, 3, '0')
FROM ordered
WHERE c.id = ordered.id;

ALTER TABLE "Client" ALTER COLUMN "shortCode" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Client_companyId_shortCode_key"
  ON "Client"("companyId", "shortCode");
