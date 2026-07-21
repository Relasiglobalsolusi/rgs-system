-- Split Client.contactPersonName into first/last name fields (idempotent).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Client'
      AND column_name = 'contactPersonName'
  ) THEN
    ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "contactPersonFirstName" TEXT;
    ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "contactPersonLastName" TEXT;

    UPDATE "Client"
    SET
      "contactPersonFirstName" = CASE
        WHEN "contactPersonName" IS NULL OR btrim("contactPersonName") = '' THEN NULL
        ELSE split_part(btrim("contactPersonName"), ' ', 1)
      END,
      "contactPersonLastName" = CASE
        WHEN "contactPersonName" IS NULL OR btrim("contactPersonName") = '' THEN NULL
        WHEN position(' ' in btrim("contactPersonName")) = 0 THEN NULL
        ELSE btrim(substring(btrim("contactPersonName") from position(' ' in btrim("contactPersonName")) + 1))
      END
    WHERE "contactPersonFirstName" IS NULL
      AND "contactPersonLastName" IS NULL
      AND "contactPersonName" IS NOT NULL;

    ALTER TABLE "Client" DROP COLUMN "contactPersonName";
  ELSE
    ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "contactPersonFirstName" TEXT;
    ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "contactPersonLastName" TEXT;
  END IF;
END $$;
