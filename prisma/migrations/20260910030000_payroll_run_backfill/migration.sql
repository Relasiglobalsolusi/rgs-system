-- Put existing head office, corporate, director, Operational Manager, and GC
-- staff on the 26th–25th run. The column landed with a PROJECT_CYCLE default,
-- so these rows were still sitting in the 16th–15th project run.
-- Mirrors `defaultPayrollRunForEmployee` in lib/employee-payroll-run.ts.

UPDATE "Employee" e
SET "payrollRun" = 'HEAD_OFFICE_MONTHLY'
WHERE e."payrollRun" = 'PROJECT_CYCLE'
  AND (
    e."employeeType" = 'HEAD_OFFICE'
    OR EXISTS (
      SELECT 1
      FROM "Position" p
      WHERE p."id" = e."positionId"
        AND (
          lower(btrim(p."slug")) IN (
            'director',
            'director-of-operations',
            'operations-manager',
            'gc-staff'
          )
          OR lower(btrim(p."name")) IN (
            'director',
            'director of operations',
            'operations manager',
            'om',
            'gc staff'
          )
        )
    )
  );
