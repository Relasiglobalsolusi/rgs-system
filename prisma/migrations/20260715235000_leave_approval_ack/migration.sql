-- Persist per-user acknowledgement of leave-approved dashboard notifications.
CREATE TABLE IF NOT EXISTS "LeaveApprovalAck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveApprovalAck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeaveApprovalAck_userId_leaveRequestId_key"
ON "LeaveApprovalAck"("userId", "leaveRequestId");

CREATE INDEX IF NOT EXISTS "LeaveApprovalAck_userId_idx"
ON "LeaveApprovalAck"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeaveApprovalAck_userId_fkey'
  ) THEN
    ALTER TABLE "LeaveApprovalAck"
      ADD CONSTRAINT "LeaveApprovalAck_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeaveApprovalAck_leaveRequestId_fkey'
  ) THEN
    ALTER TABLE "LeaveApprovalAck"
      ADD CONSTRAINT "LeaveApprovalAck_leaveRequestId_fkey"
      FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
