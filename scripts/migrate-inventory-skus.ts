/**
 * Migrate inventory catalog SKUs (and equipment asset codes) to the new scheme:
 *   - Pad width 4 → 3  (EQP-0001 → EQP-001)
 *   - Chemical CHEM → CHM, Consumable CONS → CNS
 *
 * Asset codes are `{ITEM_SKU}-A{n}`; prefixes are rewritten when the item SKU changes.
 * Uses a two-phase rename (temp → final) to avoid @@unique collisions.
 *
 * Safe to re-run: already-canonical rows are skipped.
 *
 * Run: npx tsx scripts/migrate-inventory-skus.ts
 */
import { prisma } from "@/lib/prisma";
import { canonicalizeInventorySku } from "@/lib/inventory-sku";
import { ASSET_CODE_SEPARATOR } from "@/lib/equipment-asset";

type ItemPlan = {
  id: string;
  companyId: string;
  oldSku: string;
  newSku: string;
};

type AssetPlan = {
  id: string;
  companyId: string;
  oldCode: string;
  newCode: string;
};

function tempSku(id: string): string {
  return `__MIG_SKU_${id}`;
}

function tempAssetCode(id: string): string {
  return `__MIG_ASSET_${id}`;
}

function rewriteAssetCode(assetCode: string, oldSku: string, newSku: string): string | null {
  const prefix = `${oldSku}${ASSET_CODE_SEPARATOR}`;
  if (!assetCode.startsWith(prefix)) {
    // Case-insensitive fallback for older mixed-case rows
    const upper = assetCode.toUpperCase();
    const oldPrefix = `${oldSku.toUpperCase()}${ASSET_CODE_SEPARATOR}`;
    if (!upper.startsWith(oldPrefix)) return null;
    const suffix = assetCode.slice(oldPrefix.length);
    return `${newSku}${ASSET_CODE_SEPARATOR}${suffix}`;
  }
  return `${newSku}${ASSET_CODE_SEPARATOR}${assetCode.slice(prefix.length)}`;
}

async function main() {
  const items = await prisma.inventoryItem.findMany({
    select: {
      id: true,
      companyId: true,
      sku: true,
      itemType: true,
      equipmentAssets: {
        select: { id: true, companyId: true, assetCode: true },
      },
    },
    orderBy: [{ companyId: "asc" }, { sku: "asc" }],
  });

  const itemPlans: ItemPlan[] = [];
  const assetPlans: AssetPlan[] = [];

  for (const item of items) {
    const newSku = canonicalizeInventorySku(item.sku, item.itemType);
    if (!newSku || newSku === item.sku) {
      // Still rewrite assets if they somehow embed a non-canonical prefix
      // while the item SKU is already canonical (no-op path).
      continue;
    }

    // Collision check: another item already owns the target SKU
    const clash = items.find(
      (other) =>
        other.id !== item.id &&
        other.companyId === item.companyId &&
        other.sku === newSku
    );
    if (clash) {
      const clashCanonical = canonicalizeInventorySku(clash.sku, clash.itemType);
      if (clashCanonical && clashCanonical !== clash.sku) {
        // Target will also move; two-phase rename handles this.
      } else {
        console.warn(
          `Skip item ${item.id}: ${item.sku} → ${newSku} collides with existing ${clash.sku}`
        );
        continue;
      }
    }

    itemPlans.push({
      id: item.id,
      companyId: item.companyId,
      oldSku: item.sku,
      newSku,
    });

    for (const asset of item.equipmentAssets) {
      const newCode = rewriteAssetCode(asset.assetCode, item.sku, newSku);
      if (!newCode || newCode === asset.assetCode) continue;
      assetPlans.push({
        id: asset.id,
        companyId: asset.companyId,
        oldCode: asset.assetCode,
        newCode,
      });
    }
  }

  if (itemPlans.length === 0 && assetPlans.length === 0) {
    console.log("No inventory SKUs or asset codes need migration.");
    return;
  }

  console.log(
    `Planning migration: ${itemPlans.length} item SKU(s), ${assetPlans.length} asset code(s).`
  );
  for (const plan of itemPlans.slice(0, 20)) {
    console.log(`  ${plan.oldSku} → ${plan.newSku}`);
  }
  if (itemPlans.length > 20) {
    console.log(`  … and ${itemPlans.length - 20} more item(s)`);
  }

  await prisma.$transaction(async (tx) => {
    // Phase 1 — park on unique temp names
    for (const plan of itemPlans) {
      await tx.inventoryItem.update({
        where: { id: plan.id },
        data: { sku: tempSku(plan.id) },
      });
    }
    for (const plan of assetPlans) {
      await tx.equipmentAsset.update({
        where: { id: plan.id },
        data: { assetCode: tempAssetCode(plan.id) },
      });
    }

    // Phase 2 — apply final names
    for (const plan of itemPlans) {
      await tx.inventoryItem.update({
        where: { id: plan.id },
        data: { sku: plan.newSku },
      });
    }
    for (const plan of assetPlans) {
      await tx.equipmentAsset.update({
        where: { id: plan.id },
        data: { assetCode: plan.newCode },
      });
    }
  });

  console.log(
    `Migrated ${itemPlans.length} inventory item SKU(s) and ${assetPlans.length} equipment asset code(s).`
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
