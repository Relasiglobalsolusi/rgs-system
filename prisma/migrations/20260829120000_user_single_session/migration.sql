-- Single active login session per user (JWT sessionToken must match).
ALTER TABLE "User" ADD COLUMN "sessionToken" TEXT;
ALTER TABLE "User" ADD COLUMN "sessionIssuedAt" TIMESTAMP(3);
