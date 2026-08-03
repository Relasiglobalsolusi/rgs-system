/**
 * Grant every ERP module to head-office admin accounts (sidebar + route gates).
 *
 * Targets active ADMIN users that are not client/vendor/employee portal logins.
 * Clears stored moduleOverrides so permissions match the admin baseline (all on).
 *
 * Usage (local):
 *   npx tsx scripts/grant-admin-full-access.ts
 *
 * Usage (VPS / production — from app root, with .env pointing at prod DB):
 *   npx tsx scripts/grant-admin-full-access.ts
 *
 * Safe to re-run; idempotent.
 */
import { Prisma, PrismaClient } from "@prisma/client";

import { isHoAdminAccount } from "../lib/permissions";

const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      active: true,
      clientId: null,
      vendorId: null,
    },
    select: {
      id: true,
      username: true,
      name: true,
      moduleOverrides: true,
      employee: {
        select: {
          employeeNo: true,
          employeeType: true,
        },
      },
    },
    orderBy: { username: "asc" },
  });

  const hoAdmins = candidates.filter((user) =>
    isHoAdminAccount({
      role: "ADMIN",
      username: user.username,
      employee: user.employee,
      employeeType: user.employee?.employeeType ?? null,
    })
  );

  if (hoAdmins.length === 0) {
    console.log("No head-office admin accounts found.");
    return;
  }

  let updated = 0;
  for (const user of hoAdmins) {
    const hadOverrides =
      user.moduleOverrides &&
      typeof user.moduleOverrides === "object" &&
      !Array.isArray(user.moduleOverrides) &&
      Object.keys(user.moduleOverrides as object).length > 0;

    if (hadOverrides) {
      await prisma.user.update({
        where: { id: user.id },
        data: { moduleOverrides: Prisma.DbNull },
      });
      updated += 1;
      console.log(
        `Cleared moduleOverrides for ${user.username} (${user.name})`
      );
    } else {
      console.log(
        `Already full access: ${user.username} (${user.name})`
      );
    }
  }

  console.log(
    `\nDone. ${hoAdmins.length} HO admin account(s); cleared overrides on ${updated}.`
  );
  console.log(
    "Re-login (or wait for JWT refresh) so the sidebar picks up the change."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
