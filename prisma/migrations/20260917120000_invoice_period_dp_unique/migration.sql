-- Same-day down payment + remainder invoices.
DROP INDEX IF EXISTS "ProjectInvoicePeriod_projectId_periodStart_periodEnd_key";
CREATE UNIQUE INDEX "ProjectInvoicePeriod_projectId_periodStart_periodEnd_isDownPayment_key" ON "ProjectInvoicePeriod"("projectId", "periodStart", "periodEnd", "isDownPayment");
