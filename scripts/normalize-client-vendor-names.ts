/**
 * One-shot: rewrite Client/Vendor.name when it differs from capitalizeProper(name).
 * Source of truth is the DB — UI and Excel should display stored values as-is.
 *
 * Usage: npx tsx scripts/normalize-client-vendor-names.ts
 */
import { PrismaClient } from "@prisma/client";

import { capitalizeProper } from "../lib/text-case";

const prisma = new PrismaClient();

async function normalizeModel(
  label: "client" | "vendor",
  rows: { id: string; name: string }[],
  update: (id: string, name: string) => Promise<unknown>
) {
  let updated = 0;
  for (const row of rows) {
    const next = capitalizeProper(row.name);
    if (!next || next === row.name) continue;
    await update(row.id, next);
    console.log(`[${label}] ${JSON.stringify(row.name)} → ${JSON.stringify(next)}`);
    updated += 1;
  }
  console.log(`[${label}] updated ${updated} of ${rows.length}`);
  return updated;
}

async function main() {
  const [clients, vendors] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true } }),
    prisma.vendor.findMany({ select: { id: true, name: true } }),
  ]);

  const clientUpdated = await normalizeModel("client", clients, (id, name) =>
    prisma.client.update({ where: { id }, data: { name } })
  );
  const vendorUpdated = await normalizeModel("vendor", vendors, (id, name) =>
    prisma.vendor.update({ where: { id }, data: { name } })
  );

  console.log(
    `\nDone. clients=${clientUpdated} vendors=${vendorUpdated} total=${clientUpdated + vendorUpdated}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
