/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Department` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `Department` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Department" DROP CONSTRAINT "Department_companyId_fkey";

-- AlterTable
ALTER TABLE "public"."Department" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "code" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "public"."Department"("code");

-- AddForeignKey
ALTER TABLE "public"."Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
