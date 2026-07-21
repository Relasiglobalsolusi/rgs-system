-- Persist per-user acknowledgement of missing progress-report warnings.
CREATE TABLE IF NOT EXISTS "ProgressWarningAck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressWarningAck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProgressWarningAck_userId_projectId_reportDate_key"
ON "ProgressWarningAck"("userId", "projectId", "reportDate");

CREATE INDEX IF NOT EXISTS "ProgressWarningAck_userId_idx"
ON "ProgressWarningAck"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProgressWarningAck_userId_fkey'
  ) THEN
    ALTER TABLE "ProgressWarningAck"
      ADD CONSTRAINT "ProgressWarningAck_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProgressWarningAck_projectId_fkey'
  ) THEN
    ALTER TABLE "ProgressWarningAck"
      ADD CONSTRAINT "ProgressWarningAck_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
