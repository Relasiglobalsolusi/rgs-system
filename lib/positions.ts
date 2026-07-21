import type { Position, Prisma } from "@prisma/client";

import { getNextEmployeeNumber } from "@/lib/employee-number";
import { titleCaseWords } from "@/lib/text-case";

export type PositionOption = Pick<
  Position,
  "id" | "name" | "slug" | "description" | "sortOrder" | "active" | "categoryId"
>;

export type PositionRow = PositionOption & {
  category: { id: string; name: string; slug: string; prefix: string };
  _count: { employees: number };
};

type CategoryDb = Pick<
  Prisma.TransactionClient,
  "employeeCategory" | "position" | "employee"
>;

export const DEFAULT_POSITIONS_BY_CATEGORY_SLUG: Record<
  string,
  Array<{ slug: string; name: string; description: string; sortOrder: number }>
> = {
  corporate: [
    {
      slug: "admin",
      name: "Admin",
      description: "Corporate Administration",
      sortOrder: 10,
    },
    {
      slug: "director",
      name: "Director",
      description: "Company Director / Leadership",
      sortOrder: 20,
    },
    {
      slug: "in-house-cleaning-staff",
      name: "In-House Cleaning Staff",
      description: "Internal Facility Cleaning",
      sortOrder: 30,
    },
    {
      slug: "accountant",
      name: "Accountant",
      description: "Finance Accounting",
      sortOrder: 40,
    },
    {
      slug: "finance-admin",
      name: "Finance Admin",
      description: "Finance Administration",
      sortOrder: 50,
    },
  ],
  operations: [
    {
      slug: "cleaning-staff",
      name: "Cleaning Staff",
      description: "Regular Cleaning Crew",
      sortOrder: 10,
    },
    {
      slug: "gc-staff",
      name: "GC Staff",
      description: "General Cleaning / Gondola Crew",
      sortOrder: 20,
    },
    {
      slug: "operations-manager",
      name: "Operations Manager",
      description: "Field Operations Leadership",
      sortOrder: 30,
    },
  ],
};

export function positionSlugFromName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return normalized || "position";
}

export function isOperationsManagerPosition(position: {
  slug?: string | null;
  name?: string | null;
}): boolean {
  const slug = (position.slug ?? "").trim().toLowerCase();
  const name = (position.name ?? "").trim().toLowerCase();
  return (
    slug === "operations-manager" ||
    name === "operations manager" ||
    name === "om"
  );
}

export function isDirectorPosition(position: {
  slug?: string | null;
  name?: string | null;
}): boolean {
  const slug = (position.slug ?? "").trim().toLowerCase();
  const name = (position.name ?? "").trim().toLowerCase();
  return (
    slug === "director" ||
    slug === "director-of-operations" ||
    name === "director" ||
    name === "director of operations"
  );
}

export function isCrewPickerPosition(position: {
  slug?: string | null;
  name?: string | null;
}): boolean {
  const slug = (position.slug ?? "").trim().toLowerCase();
  const name = (position.name ?? "").trim().toLowerCase();
  if (isOperationsManagerPosition(position)) {
    return false;
  }
  return (
    slug === "cleaning-staff" ||
    slug === "gc-staff" ||
    name === "cleaning staff" ||
    name === "gc staff" ||
    name.includes("gondola")
  );
}

export async function ensureDefaultPositions(
  db: Pick<Prisma.TransactionClient, "employeeCategory" | "position">,
  companyId: string
) {
  const categories = await db.employeeCategory.findMany({
    where: { companyId, active: true },
    select: { id: true, slug: true },
  });

  for (const category of categories) {
    const defaults = DEFAULT_POSITIONS_BY_CATEGORY_SLUG[category.slug];
    if (!defaults) continue;

    for (const item of defaults) {
      await db.position.upsert({
        where: {
          categoryId_slug: {
            categoryId: category.id,
            slug: item.slug,
          },
        },
        update: {
          name: item.name,
          description: item.description,
          sortOrder: item.sortOrder,
          active: true,
        },
        create: {
          companyId,
          categoryId: category.id,
          name: item.name,
          slug: item.slug,
          description: item.description,
          sortOrder: item.sortOrder,
          active: true,
        },
      });
    }
  }
}

/** Normalize all position names/descriptions to Title Case; sync denormalized employee.position. */
export async function normalizePositionTitleCase(
  db: Pick<Prisma.TransactionClient, "position" | "employee">,
  companyId?: string
) {
  const positions = await db.position.findMany({
    where: companyId ? { companyId } : undefined,
    select: { id: true, name: true, description: true },
  });

  for (const position of positions) {
    const name = titleCaseWords(position.name);
    const description = position.description
      ? titleCaseWords(position.description)
      : null;
    if (name === position.name && description === position.description) {
      continue;
    }

    await db.position.update({
      where: { id: position.id },
      data: { name, description },
    });
    await db.employee.updateMany({
      where: { positionId: position.id },
      data: { position: name },
    });
  }
}

/**
 * Retire Finance department: move finance roles under Corporate as positions,
 * migrate FIN employees to Corporate + matching finance position with a new COR
 * number. FIN prefix is no longer issued; COR/OPR never-reuse is unchanged.
 */
export async function retireFinanceDepartments(db: CategoryDb) {
  const financeCategories = await db.employeeCategory.findMany({
    where: {
      OR: [
        { slug: "finance" },
        { prefix: { equals: "FIN", mode: "insensitive" } },
      ],
    },
    select: { id: true, companyId: true },
  });

  for (const finance of financeCategories) {
    let corporate = await db.employeeCategory.findFirst({
      where: { companyId: finance.companyId, slug: "corporate" },
      select: { id: true },
    });

    if (!corporate) {
      corporate = await db.employeeCategory.create({
        data: {
          companyId: finance.companyId,
          name: "Corporate",
          slug: "corporate",
          prefix: "COR",
          sortOrder: 10,
          active: true,
        },
        select: { id: true },
      });
    }

    await ensureDefaultPositions(db, finance.companyId);

    const financePositions = await db.position.findMany({
      where: { categoryId: finance.id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        sortOrder: true,
      },
    });

    const corporatePositionBySlug = new Map<string, { id: string; name: string }>();

    for (const pos of financePositions) {
      const name = titleCaseWords(pos.name);
      const description = pos.description
        ? titleCaseWords(pos.description)
        : null;

      let target = await db.position.findFirst({
        where: { categoryId: corporate.id, slug: pos.slug },
        select: { id: true, name: true },
      });

      if (!target) {
        target = await db.position.create({
          data: {
            companyId: finance.companyId,
            categoryId: corporate.id,
            name,
            slug: pos.slug,
            description,
            sortOrder: pos.sortOrder,
            active: true,
          },
          select: { id: true, name: true },
        });
      } else {
        target = await db.position.update({
          where: { id: target.id },
          data: { name, description, active: true },
          select: { id: true, name: true },
        });
      }

      corporatePositionBySlug.set(pos.slug, target);

      const employees = await db.employee.findMany({
        where: { positionId: pos.id },
        select: { id: true, employeeNo: true },
      });

      for (const employee of employees) {
        await migrateFinanceEmployee(db, {
          employeeId: employee.id,
          employeeNo: employee.employeeNo,
          companyId: finance.companyId,
          corporateId: corporate.id,
          positionId: target.id,
          positionName: target.name,
        });
      }

      await db.position.delete({ where: { id: pos.id } });
    }

    const leftoverEmployees = await db.employee.findMany({
      where: { categoryId: finance.id },
      select: { id: true, employeeNo: true },
    });

    const fallbackPosition =
      corporatePositionBySlug.get("accountant") ??
      corporatePositionBySlug.get("finance-admin") ??
      (await db.position.findFirst({
        where: { categoryId: corporate.id, slug: "accountant", active: true },
        select: { id: true, name: true },
      })) ??
      (await db.position.findFirst({
        where: { categoryId: corporate.id, active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      }));

    for (const employee of leftoverEmployees) {
      if (!fallbackPosition) {
        await db.employee.update({
          where: { id: employee.id },
          data: { categoryId: corporate.id },
        });
        continue;
      }
      await migrateFinanceEmployee(db, {
        employeeId: employee.id,
        employeeNo: employee.employeeNo,
        companyId: finance.companyId,
        corporateId: corporate.id,
        positionId: fallbackPosition.id,
        positionName: fallbackPosition.name,
      });
    }

    await db.employeeCategory.delete({ where: { id: finance.id } }).catch(() => {
      /* may already be gone */
    });
  }
}

async function migrateFinanceEmployee(
  db: CategoryDb,
  options: {
    employeeId: string;
    employeeNo: string;
    companyId: string;
    corporateId: string;
    positionId: string;
    positionName: string;
  }
) {
  const { employeeId, employeeNo, companyId, corporateId, positionId, positionName } =
    options;

  // Keep existing non-FIN numbers (already Corporate); only reassign FIN-* → COR-*.
  const employeeNoNext = /^FIN-/i.test(employeeNo)
    ? await getNextEmployeeNumber(companyId, corporateId, db)
    : employeeNo;

  await db.employee.update({
    where: { id: employeeId },
    data: {
      categoryId: corporateId,
      positionId,
      position: positionName,
      employeeNo: employeeNoNext,
    },
  });
}

export function formatPositionLabel(
  position: Pick<Position, "name"> | null | undefined
): string {
  return position?.name?.trim() || "-";
}
