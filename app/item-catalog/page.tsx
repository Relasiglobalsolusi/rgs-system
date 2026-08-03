import { prisma } from "@/lib/prisma";
import { canManageItemCatalog } from "@/lib/project-access";
import { inventoryQtyFromDecimal } from "@/lib/inventory";
import { decimalToNumber } from "@/lib/project-billing";
import { requireModule, toPermissionUser } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import ItemCatalogDirectory from "@/components/item-catalog/ItemCatalogDirectory";
import PageIntro from "@/components/i18n/PageIntro";
import T from "@/components/i18n/T";

export default async function ItemCatalogPage() {
  const session = await requireModule("itemCatalog");
  const canManage = canManageItemCatalog(toPermissionUser(session));

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    return (
      <AppShell
        titleKey="pages.itemCatalog.title"
        descriptionKey="pages.itemCatalog.description"
      >
        <p className="rounded-3xl border border-border bg-elevated p-8 text-text">
          <T k="pages.itemCatalog.companyNotFound" />
        </p>
      </AppShell>
    );
  }

  const items = await prisma.inventoryItem.findMany({
    where: { companyId: company.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const catalogItems = items.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    itemType: item.itemType,
    description: item.description,
    unit: item.unit,
    minStock: inventoryQtyFromDecimal(item.minStock),
    currentStock: inventoryQtyFromDecimal(item.currentStock),
    lastUnitCost: decimalToNumber(item.lastUnitCost),
    avgUnitCost: decimalToNumber(item.avgUnitCost),
    active: item.active,
  }));

  return (
    <AppShell
      titleKey="pages.itemCatalog.title"
      descriptionKey={
        canManage
          ? "pages.itemCatalog.descriptionManage"
          : "pages.itemCatalog.descriptionReadonly"
      }
    >
      <PageIntro
        titleKey="pages.itemCatalog.directoryTitle"
        descriptionKey="pages.itemCatalog.directoryDesc"
      />

      <ItemCatalogDirectory items={catalogItems} canManage={canManage} />
    </AppShell>
  );
}
