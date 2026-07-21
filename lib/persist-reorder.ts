import { prisma } from "@/lib/prisma";
import { nextSortOrderFromMax, sortOrdersForIds } from "@/lib/reorder";

export type CompanyScopedModel =
  | "employeeCategory"
  | "position"
  | "client"
  | "vendor"
  | "employee"
  | "user"
  | "project";

async function countOwnedIds(
  model: CompanyScopedModel,
  companyId: string,
  ids: string[]
): Promise<number> {
  const where = { companyId, id: { in: ids } };
  switch (model) {
    case "employeeCategory":
      return prisma.employeeCategory.count({ where });
    case "position":
      return prisma.position.count({ where });
    case "client":
      return prisma.client.count({ where });
    case "vendor":
      return prisma.vendor.count({ where });
    case "employee":
      return prisma.employee.count({ where });
    case "user":
      return prisma.user.count({ where });
    case "project":
      return prisma.project.count({ where });
  }
}

async function applySortOrders(
  model: CompanyScopedModel,
  updates: { id: string; sortOrder: number }[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const { id, sortOrder } of updates) {
      switch (model) {
        case "employeeCategory":
          await tx.employeeCategory.update({
            where: { id },
            data: { sortOrder },
          });
          break;
        case "position":
          await tx.position.update({
            where: { id },
            data: { sortOrder },
          });
          break;
        case "client":
          await tx.client.update({ where: { id }, data: { sortOrder } });
          break;
        case "vendor":
          await tx.vendor.update({ where: { id }, data: { sortOrder } });
          break;
        case "employee":
          await tx.employee.update({ where: { id }, data: { sortOrder } });
          break;
        case "user":
          await tx.user.update({ where: { id }, data: { sortOrder } });
          break;
        case "project":
          await tx.project.update({ where: { id }, data: { sortOrder } });
          break;
      }
    }
  });
}

/**
 * Validates that every id belongs to the company, then writes sortOrder = index * step.
 */
export async function persistCompanyScopedReorder(
  model: CompanyScopedModel,
  options: {
    companyId: string;
    ids: string[];
    emptyError?: string;
    mismatchError?: string;
  }
): Promise<void> {
  const ids = options.ids.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    throw new Error(options.emptyError ?? "Nothing to reorder.");
  }

  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length !== ids.length) {
    throw new Error(options.mismatchError ?? "Duplicate ids in reorder list.");
  }

  const owned = await countOwnedIds(model, options.companyId, ids);
  if (owned !== ids.length) {
    throw new Error(
      options.mismatchError ?? "One or more rows are invalid for reorder."
    );
  }

  await applySortOrders(model, sortOrdersForIds(ids));
}

export async function nextCompanyScopedSortOrder(
  model: CompanyScopedModel,
  companyId: string
): Promise<number> {
  const where = { companyId };
  const orderBy = { sortOrder: "desc" as const };
  const select = { sortOrder: true };

  let top: { sortOrder: number } | null = null;
  switch (model) {
    case "employeeCategory":
      top = await prisma.employeeCategory.findFirst({ where, orderBy, select });
      break;
    case "position":
      top = await prisma.position.findFirst({ where, orderBy, select });
      break;
    case "client":
      top = await prisma.client.findFirst({ where, orderBy, select });
      break;
    case "vendor":
      top = await prisma.vendor.findFirst({ where, orderBy, select });
      break;
    case "employee":
      top = await prisma.employee.findFirst({ where, orderBy, select });
      break;
    case "user":
      top = await prisma.user.findFirst({ where, orderBy, select });
      break;
    case "project":
      top = await prisma.project.findFirst({ where, orderBy, select });
      break;
  }

  return nextSortOrderFromMax(top?.sortOrder);
}
