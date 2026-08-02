-- Pending leave request: employee unavailable for ops until approved/rejected.
ALTER TYPE "EmploymentStatus" ADD VALUE 'LEAVE_PENDING';

-- Align roster staff who already have pending leave requests.
UPDATE "Employee" e
SET status = 'LEAVE_PENDING'
WHERE e.status IN ('ACTIVE', 'ON_LEAVE')
  AND EXISTS (
    SELECT 1
    FROM "LeaveRequest" lr
    WHERE lr."employeeId" = e.id
      AND lr.status = 'PENDING'
  );
