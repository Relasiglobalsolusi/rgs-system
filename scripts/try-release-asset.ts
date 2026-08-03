import { prisma } from "@/lib/prisma";
import { lockInventoryItemRow } from "@/lib/inventory-access";
import {
  inventoryQtyFromDecimal,
  normalizeInventoryQty,
  toDecimal,
} from "@/lib/inventory";

async function main() {
  const assetId = "cmsdc7kki035gvpx8wcq5m58x";
  const projectId = "cmsbeh4zt0001vpe0o3wcndu4";

  await prisma.$transaction(async (tx) => {
    const asset = await tx.equipmentAsset.findFirst({
      where: {
        id: assetId,
        projectId,
        status: "ON_PROJECT",
      },
      select: {
        id: true,
        itemId: true,
        movementId: true,
        issueMovementId: true,
        assetCode: true,
        companyId: true,
      },
    });
    console.log("found asset", asset);
    if (!asset) throw new Error("asset not found");

    const locked = await lockInventoryItemRow(tx, asset.itemId);
    console.log("locked", locked);

    if (asset.movementId) {
      console.log("path: movementId");
    } else if (asset.issueMovementId && locked) {
      console.log("path: issueMovementId restore");
      const currentStock = inventoryQtyFromDecimal(locked.currentStock);
      await tx.inventoryItem.update({
        where: { id: asset.itemId },
        data: {
          currentStock: toDecimal(normalizeInventoryQty(currentStock + 1)),
        },
      });
    } else {
      console.log("path: neither / no lock — status-only release");
    }

    await tx.equipmentAsset.update({
      where: { id: asset.id },
      data: {
        status: "AVAILABLE",
        projectId: null,
        movementId: null,
        issueMovementId: null,
        assignedAt: null,
      },
    });
    console.log("updated ok");
  });

  // Revert so we don't change user data unexpectedly — re-assign
  await prisma.equipmentAsset.update({
    where: { id: assetId },
    data: {
      status: "ON_PROJECT",
      projectId,
      issueMovementId: "cmsdccuxj035mvpx8yqjnuvjw",
      assignedAt: new Date(),
    },
  });
  const item = await prisma.inventoryItem.findFirst({
    where: { sku: "EQP-001" },
    select: { currentStock: true },
  });
  // Undo the +1 stock if we applied it
  if (item) {
    const stock = inventoryQtyFromDecimal(item.currentStock);
    await prisma.inventoryItem.updateMany({
      where: { sku: "EQP-001" },
      data: { currentStock: toDecimal(normalizeInventoryQty(Math.max(0, stock - 1))) },
    });
  }
  console.log("reverted");
}

main()
  .catch((error) => {
    console.error("FAILED", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
