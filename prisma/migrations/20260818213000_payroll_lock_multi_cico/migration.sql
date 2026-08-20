-- Multi-site CICO: one complete session per employee × date × project.
DROP INDEX IF EXISTS "Attendance_employeeId_date_key";

CREATE UNIQUE INDEX "Attendance_employeeId_date_projectId_key"
  ON "Attendance"("employeeId", "date", "projectId");

CREATE INDEX IF NOT EXISTS "Attendance_employeeId_date_idx"
  ON "Attendance"("employeeId", "date");

-- Frozen Internal Payroll period after Generate PDF.
CREATE TABLE "InternalPayrollLock" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "lockedAt" TIMESTAMP(3),
  "lockedById" TEXT,
  "lockedByName" TEXT,
  "unlockedAt" TIMESTAMP(3),
  "unlockedById" TEXT,
  "unlockedByName" TEXT,
  "unlockReason" TEXT,
  "snapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InternalPayrollLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternalPayrollLock_companyId_year_month_key"
  ON "InternalPayrollLock"("companyId", "year", "month");

ALTER TABLE "InternalPayrollLock"
  ADD CONSTRAINT "InternalPayrollLock_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InternalPayrollLock"
  ADD CONSTRAINT "InternalPayrollLock_lockedById_fkey"
  FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InternalPayrollLock"
  ADD CONSTRAINT "InternalPayrollLock_unlockedById_fkey"
  FOREIGN KEY ("unlockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
