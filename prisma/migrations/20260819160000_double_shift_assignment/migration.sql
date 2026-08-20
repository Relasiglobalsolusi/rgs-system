-- CreateTable
CREATE TABLE "DoubleShiftAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoubleShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoubleShiftAssignment_employeeId_date_key" ON "DoubleShiftAssignment"("employeeId", "date");

-- CreateIndex
CREATE INDEX "DoubleShiftAssignment_projectId_date_idx" ON "DoubleShiftAssignment"("projectId", "date");

-- CreateIndex
CREATE INDEX "DoubleShiftAssignment_assignedById_idx" ON "DoubleShiftAssignment"("assignedById");

-- AddForeignKey
ALTER TABLE "DoubleShiftAssignment" ADD CONSTRAINT "DoubleShiftAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoubleShiftAssignment" ADD CONSTRAINT "DoubleShiftAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoubleShiftAssignment" ADD CONSTRAINT "DoubleShiftAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
