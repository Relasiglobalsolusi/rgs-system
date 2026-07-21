-- AlterTable
ALTER TABLE "Project" ADD COLUMN "is24Hours" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "operatingHoursStart" TEXT;
ALTER TABLE "Project" ADD COLUMN "operatingHoursEnd" TEXT;

-- AlterTable
ALTER TABLE "ProjectAssignment" ADD COLUMN "shiftStart" TEXT;
ALTER TABLE "ProjectAssignment" ADD COLUMN "shiftEnd" TEXT;
