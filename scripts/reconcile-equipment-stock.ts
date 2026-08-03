/**
 * Release phantom equipment assignments, hard-delete never-deployed surplus
 * mints, and sync warehouse stock to AVAILABLE.
 *
 * Does NOT mint from stock+onProject or silently assign extras onto projects.
 * Run: npx tsx scripts/reconcile-equipment-stock.ts
 */
import {
  backfillEquipmentAssetUnitCosts,
  backfillEquipmentAssets,
  backfillProjectEquipmentIssueAssignments,
  checkEquipmentInventoryInvariants,
  releaseOverAssignedEquipmentAssets,
  deleteSurplusNeverDeployedEquipmentAssets,
} from "@/lib/equipment-asset";
import { inventoryQtyFromDecimal } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true } });
  let phantomsReleased = 0;
  let issueOverAssignReleased = 0;
  for (const company of companies) {
    phantomsReleased += await releaseOverAssignedEquipmentAssets(
      prisma,
      company.id
    );
    // Release-only repair — never assign/mint missing units from open issues.
    const projects = await prisma.project.findMany({
      where: { companyId: company.id },
      select: { id: true },
    });
    for (const project of projects) {
      issueOverAssignReleased += await backfillProjectEquipmentIssueAssignments(
        prisma,
        company.id,
        project.id
      );
    }
  }

  const surplusDeleted = await deleteSurplusNeverDeployedEquipmentAssets(prisma);
  const result = await backfillEquipmentAssets(prisma);
  const unitCosts = await backfillEquipmentAssetUnitCosts(prisma);

  const invariantViolations: Record<string, number> = {};
  for (const company of companies) {
    const violations = await checkEquipmentInventoryInvariants(
      prisma,
      company.id,
      { checkOwnedVsPurchases: true }
    );
    invariantViolations[company.id] = violations.length;
    if (violations.length > 0) {
      console.warn("Invariant violations", company.id, violations);
    }
  }

  const item = await prisma.inventoryItem.findFirst({
    where: { sku: "EQP-001" },
    select: { id: true, sku: true, currentStock: true },
  });
  if (item) {
    const assets = await prisma.equipmentAsset.groupBy({
      by: ["status"],
      where: { itemId: item.id },
      _count: true,
    });
    console.log("EQP-001 after reconcile:", {
      currentStock: inventoryQtyFromDecimal(item.currentStock),
      assets,
    });
  }

  console.log({
    phantomsReleased,
    issueOverAssignReleased,
    surplusDeleted,
    unitCostsBackfilled: unitCosts.assetsUpdated,
    invariantViolations,
    ...result,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
