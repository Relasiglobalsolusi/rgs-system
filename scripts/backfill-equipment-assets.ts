/**
 * One-off backfill: mint missing EquipmentAsset rows for existing Equipment stock.
 * Run: npx tsx scripts/backfill-equipment-assets.ts
 */
import { backfillEquipmentAssets } from "@/lib/equipment-asset";
import { prisma } from "@/lib/prisma";

async function main() {
  const result = await backfillEquipmentAssets(prisma);
  console.log(
    `Backfill complete: ${result.assetsMinted} asset(s) minted across ${result.itemsProcessed} Equipment item(s).`
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
