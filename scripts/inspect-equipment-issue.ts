import { prisma } from "@/lib/prisma";

async function main() {
  const movement = await prisma.inventoryMovement.findUnique({
    where: { id: "cmsdccuxj035mvpx8yqjnuvjw" },
    select: {
      id: true,
      type: true,
      quantity: true,
      voidedAt: true,
      voidReason: true,
      projectId: true,
      itemId: true,
      notes: true,
    },
  });
  console.log("movement", movement);

  const assets = await prisma.equipmentAsset.findMany({
    where: { item: { sku: "EQP-001" } },
    select: {
      assetCode: true,
      status: true,
      movementId: true,
      issueMovementId: true,
      projectId: true,
    },
    orderBy: { assetCode: "asc" },
  });
  console.log("assets", assets);

  const item = await prisma.inventoryItem.findFirst({
    where: { sku: "EQP-001" },
    select: { id: true, currentStock: true, name: true },
  });
  console.log("item", item);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
