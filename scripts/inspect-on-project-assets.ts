import { prisma } from "@/lib/prisma";

async function main() {
  const rows = await prisma.equipmentAsset.findMany({
    where: { status: "ON_PROJECT" },
    select: {
      id: true,
      assetCode: true,
      movementId: true,
      issueMovementId: true,
      projectId: true,
      status: true,
      item: { select: { sku: true, currentStock: true } },
    },
  });
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
