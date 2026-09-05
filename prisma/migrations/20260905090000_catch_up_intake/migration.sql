-- Temporary backlog store. Drop this table when Add Project catch-up is removed.
-- Project / invoice / expense rows are not touched by that drop.
CREATE TABLE "CatchUpIntake" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ProjectCatchUpKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatchUpIntake_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatchUpIntake_projectId_key" ON "CatchUpIntake"("projectId");

ALTER TABLE "CatchUpIntake" ADD CONSTRAINT "CatchUpIntake_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CatchUpIntake" ("id", "projectId", "kind", "createdAt", "updatedAt")
SELECT
    "id",
    "id",
    "catchUpKind",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Project"
WHERE "catchUpKind" IN ('ONGOING', 'COMPLETED');
