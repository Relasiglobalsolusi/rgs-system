CREATE TYPE "VendorType" AS ENUM ('COMPANY', 'INDIVIDUAL', 'OVERSEAS');

ALTER TABLE "Vendor" ALTER COLUMN "vendorType" DROP DEFAULT;
ALTER TABLE "Vendor"
  ALTER COLUMN "vendorType" TYPE "VendorType"
  USING ("vendorType"::text::"VendorType");
ALTER TABLE "Vendor" ALTER COLUMN "vendorType" SET DEFAULT 'COMPANY';
