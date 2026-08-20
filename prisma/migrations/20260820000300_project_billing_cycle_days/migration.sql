-- Custom Period: store recurring day-of-month (1–31), not full calendar dates.
ALTER TABLE "Project" ADD COLUMN "billingCycleStartDay" INTEGER;
ALTER TABLE "Project" ADD COLUMN "billingCycleEndDay" INTEGER;

UPDATE "Project"
SET "billingCycleStartDay" = EXTRACT(DAY FROM "billingCycleStart")::integer
WHERE "billingCycleStart" IS NOT NULL;

UPDATE "Project"
SET "billingCycleEndDay" = EXTRACT(DAY FROM "billingCycleEnd")::integer
WHERE "billingCycleEnd" IS NOT NULL;

ALTER TABLE "Project" DROP COLUMN "billingCycleStart";
ALTER TABLE "Project" DROP COLUMN "billingCycleEnd";
