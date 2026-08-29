-- Monthly lease installment recorded in Expenses against an existing leased vehicle.

ALTER TYPE "VehicleExpenseKind" ADD VALUE IF NOT EXISTS 'LEASE_PAYMENT';
