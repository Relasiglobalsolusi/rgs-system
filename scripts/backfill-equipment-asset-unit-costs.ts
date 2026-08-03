/**
 * Backfill EquipmentAsset.unitCost for legacy rows minted before per-asset cost.
 * Prefers catalog avgUnitCost, then lastUnitCost, then latest purchase unit price.
 *
 * Run: npx tsx scripts/backfill-equipment-asset-unit-costs.ts
 */
import { backfillEquipmentAssetUnitCosts } from "@/lib/equipment-asset";
import { prisma } from "@/lib/prisma";

async function main() {
  const result = await backfillEquipmentAssetUnitCosts(prisma);
  console.log(
    `Backfill complete: ${result.assetsUpdated} equipment asset(s) received unitCost.`
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
