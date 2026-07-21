-- CreateTable
CREATE TABLE "AssignmentScopeConfig" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentScopeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentScopeConfig_companyId_code_key" ON "AssignmentScopeConfig"("companyId", "code");

-- AddForeignKey
ALTER TABLE "AssignmentScopeConfig" ADD CONSTRAINT "AssignmentScopeConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed system scopes for each company
INSERT INTO "AssignmentScopeConfig" ("id", "code", "label", "description", "sortOrder", "active", "isSystem", "companyId", "createdAt", "updatedAt")
SELECT
    'asc_' || substr(md5(c."id" || ':' || s.code), 1, 22),
    s.code,
    s.label,
    s.description,
    s.sort_order,
    true,
    true,
    c."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Company" c
CROSS JOIN (
    VALUES
        ('CORPORATE', 'Head Office', 'Directors, CEO, and head office leadership not tied to a site.', 10),
        ('FIELD_OPERATIONS', 'Field Operations', 'Field staff working across sites; project assignment is optional.', 20),
        ('SITE_BASED', 'Site Assignment', 'Assigned to one or more active project sites.', 30),
        ('UNASSIGNED', 'Unassigned', 'Pending department assignment; receives a temporary UNA employee number.', 40)
) AS s(code, label, description, sort_order);

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "assignmentScopeId" TEXT;

-- Migrate existing enum values to config rows
UPDATE "Employee" e
SET "assignmentScopeId" = scope_cfg."id"
FROM "AssignmentScopeConfig" scope_cfg
WHERE scope_cfg."companyId" = e."companyId"
  AND scope_cfg."code" = e."assignmentScope"::text;

-- Fallback any unmigrated rows to SITE_BASED
UPDATE "Employee" e
SET "assignmentScopeId" = scope_cfg."id"
FROM "AssignmentScopeConfig" scope_cfg
WHERE e."assignmentScopeId" IS NULL
  AND scope_cfg."companyId" = e."companyId"
  AND scope_cfg."code" = 'SITE_BASED';

ALTER TABLE "Employee" ALTER COLUMN "assignmentScopeId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_assignmentScopeId_fkey" FOREIGN KEY ("assignmentScopeId") REFERENCES "AssignmentScopeConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropEnum column and type
ALTER TABLE "Employee" DROP COLUMN "assignmentScope";
DROP TYPE "AssignmentScope";
