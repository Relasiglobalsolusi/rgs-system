/**
 * Strip PPN from inventory purchase / movement / equipment asset costs that
 * were stored tax-inclusive from Finance purchase invoices (detectable cases).
 *
 * Caveat: does not rebuild catalog avgUnitCost / lastUnitCost or historical
 * SOLD_OFF movement cost basis.
 *
 * Run: npx tsx scripts/backfill-inclusive-purchase-costs-to-ex-tax.ts
 */
import { backfillInclusivePurchaseCostsToExTax } from "@/lib/inventory-ex-tax-cost-backfill";
import { prisma } from "@/lib/prisma";

async function main() {
  const result = await backfillInclusivePurchaseCostsToExTax(prisma);
  console.log(
    `Backfill complete: ${result.purchasesUpdated} purchase(s), ${result.movementsUpdated} movement(s), ${result.assetsUpdated} asset(s) converted to ex-tax.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
