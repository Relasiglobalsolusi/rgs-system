-- Migrate all users to ADMIN before shrinking the enum
UPDATE "User" SET role = 'ADMIN' WHERE role != 'ADMIN';

ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('ADMIN');
ALTER TABLE "User" ALTER COLUMN role DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN role TYPE "UserRole" USING role::text::"UserRole";
ALTER TABLE "User" ALTER COLUMN role SET DEFAULT 'ADMIN';
DROP TYPE "UserRole_old";
