import { prisma } from "@/lib/prisma";
import { canAssignInventoryToProject } from "@/lib/inventory-access";
import { canManageInventory } from "@/lib/project-access";
import { decimalToNumber } from "@/lib/project-billing";
import { INVENTORY_ISSUE_PROJECT_STATUSES } from "@/lib/inventory";
import { requireModule, toPermissionUser } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import InventoryWorkspace from "@/components/inventory/InventoryWorkspace";
import PageIntro from "@/components/i18n/PageIntro";
import T from "@/components/i18n/T";

export default async function InventoryPage() {
  const session = await requireModule("inventory");
  const permissionUser = toPermissionUser(session);
  const canManage = canManageInventory(permissionUser);
  const canAssignToProject = await canAssignInventoryToProject(
    session.user.id,
    {
      ...permissionUser,
      username: session.user.username,
    }
  );

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    return (
      <AppShell
        titleKey="pages.inventory.title"
        descriptionKey="pages.inventory.description"
      >
        <p className="rounded-3xl border border-border bg-elevated p-8 text-text">
          <T k="pages.inventory.companyNotFound" />
        </p>
      </AppShell>
    );
  }

  const [items, purchases, issues, writeOffs, vendors, projects] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { companyId: company.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.inventoryPurchase.findMany({
      where: { companyId: company.id },
      include: {
        item: {
          select: { id: true, sku: true, name: true, unit: true, itemType: true },
        },
        vendor: { select: { id: true, name: true, shortCode: true } },
      },
      orderBy: { purchasedAt: "desc" },
      take: 200,
    }),
    prisma.inventoryMovement.findMany({
      where: {
        companyId: company.id,
        type: "ISSUE_TO_PROJECT",
        voidedAt: null,
      },
      include: {
        item: {
          select: { id: true, sku: true, name: true, unit: true },
        },
        project: {
          select: { id: true, name: true, status: true },
        },
      },
      orderBy: { movedAt: "desc" },
      take: 200,
    }),
    prisma.inventoryMovement.findMany({
      where: {
        companyId: company.id,
        type: "WRITE_OFF",
        voidedAt: null,
      },
      include: {
        item: {
          select: { id: true, sku: true, name: true, unit: true },
        },
        createdBy: {
          select: { id: true, username: true },
        },
      },
      orderBy: { movedAt: "desc" },
      take: 200,
    }),
    prisma.vendor.findMany({
      where: { companyId: company.id, active: true },
      select: { id: true, name: true, shortCode: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.project.findMany({
      where: {
        companyId: company.id,
        status: { in: [...INVENTORY_ISSUE_PROJECT_STATUSES] },
      },
      select: { id: true, name: true, status: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const catalogItems = items.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    itemType: item.itemType,
    description: item.description,
    unit: item.unit,
    minStock: decimalToNumber(item.minStock) ?? 0,
    currentStock: decimalToNumber(item.currentStock) ?? 0,
    lastUnitCost: decimalToNumber(item.lastUnitCost),
    avgUnitCost: decimalToNumber(item.avgUnitCost),
    active: item.active,
  }));

  const purchaseRows = purchases.map((row) => ({
    id: row.id,
    purchasedAt: row.purchasedAt.toISOString(),
    quantity: decimalToNumber(row.quantity) ?? 0,
    unitPrice: decimalToNumber(row.unitPrice) ?? 0,
    totalPrice: decimalToNumber(row.totalPrice) ?? 0,
    invoiceNo: row.invoiceNo,
    receiptUrl: row.receiptUrl,
    notes: row.notes,
    item: row.item,
    vendor: row.vendor,
  }));

  const issueRows = issues.map((row) => ({
    id: row.id,
    movedAt: row.movedAt.toISOString(),
    quantity: Math.abs(decimalToNumber(row.quantity) ?? 0),
    unitCost: decimalToNumber(row.unitCost) ?? 0,
    totalCost: decimalToNumber(row.totalCost) ?? 0,
    notes: row.notes,
    item: row.item,
    project: row.project,
  }));

  const writeOffRows = writeOffs.map((row) => ({
    id: row.id,
    movedAt: row.movedAt.toISOString(),
    quantity: Math.abs(decimalToNumber(row.quantity) ?? 0),
    unitCost: decimalToNumber(row.unitCost) ?? 0,
    totalCost: decimalToNumber(row.totalCost) ?? 0,
    reason: row.notes ?? "",
    createdBy: row.createdBy,
    item: row.item,
  }));

  return (
    <AppShell
      titleKey="pages.inventory.title"
      descriptionKey={
        canManage
          ? "pages.inventory.descriptionManage"
          : "pages.inventory.descriptionReadonly"
      }
    >
      <PageIntro
        titleKey="pages.inventory.workspaceTitle"
        descriptionKey="pages.inventory.workspaceDesc"
      />

      <InventoryWorkspace
        canManage={canManage}
        canAssignToProject={canAssignToProject}
        items={catalogItems}
        purchases={purchaseRows}
        issues={issueRows}
        writeOffs={writeOffRows}
        vendors={vendors}
        projects={projects}
      />
    </AppShell>
  );
}
