/**
 * One-off reconcile for Equipment stock vs asset ledger.
 * - Releases phantom over-assignments from the picker/backfill double-count bug
 * - Mints assets only for legacy items with stock but zero active assets
 * - Sets currentStock (On Hand / Warehouse) = AVAILABLE asset count
 *
 * Run: npx tsx scripts/backfill-equipment-assets.ts
 */
import {
  backfillEquipmentAssets,
  deleteSurplusNeverDeployedEquipmentAssets,
  releaseOverAssignedEquipmentAssets,
} from "@/lib/equipment-asset";
import { prisma } from "@/lib/prisma";

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true } });
  let phantomsReleased = 0;
  for (const company of companies) {
    phantomsReleased += await releaseOverAssignedEquipmentAssets(
      prisma,
      company.id
    );
  }

  const surplusDeleted = await deleteSurplusNeverDeployedEquipmentAssets(prisma);
  const result = await backfillEquipmentAssets(prisma);
  console.log(
    `Reconcile complete: ${phantomsReleased} phantom assignment(s) released, ${surplusDeleted} surplus asset(s) deleted, ${result.assetsMinted} asset(s) minted, ${result.stockAdjusted} stock row(s) synced to AVAILABLE count, ${result.assetsShortened} code(s) shortened across ${result.itemsProcessed} Equipment item(s).`
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
