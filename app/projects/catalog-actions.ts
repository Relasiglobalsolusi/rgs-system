"use server";

import { revalidatePath } from "next/cache";
import type {
  Prisma,
  ProjectCatalogBillingKind,
  ProjectSubCategory,
  ServiceArea,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireModule, toPermissionUser } from "@/lib/session";
import { canManageProjects } from "@/lib/project-access";
import {
  allowsCustomOneTimeSubcategory,
  CATALOG_ENDED_PROJECT_STATUSES,
  DEFAULT_ONE_TIME_SUB_NAMES,
  isReservedSubcategorySlug,
  isVirtualCatalogRow,
  slugFromName,
  SYSTEM_AREA_SEEDS,
  titleCaseCatalogName,
  type ProjectCatalogAreaDTO,
} from "@/lib/project-service-catalog";

async function requireProjectManager() {
  const session = await requireModule("projects");
  const user = toPermissionUser(session);
  if (!canManageProjects(user) || session.user.clientId) {
    throw new Error("You cannot manage project service areas.");
  }
  return session;
}

function catalogDelegate() {
  const area = prisma.projectServiceAreaCatalog;
  const sub = prisma.projectSubcategoryCatalog;
  if (!area || !sub) return null;
  return { area, sub };
}

function ongoingProjectWhere(): Prisma.ProjectWhereInput {
  return { status: { notIn: [...CATALOG_ENDED_PROJECT_STATUSES] } };
}

function ongoingAreaProjectWhere(area: {
  id: string;
  systemArea: ServiceArea;
}): Prisma.ProjectWhereInput {
  const legacyArea =
    area.systemArea !== "OTHER" && area.systemArea !== "HEAD_OFFICE"
      ? [{ serviceArea: area.systemArea, areaCatalogId: null }]
      : [];
  return {
    AND: [
      ongoingProjectWhere(),
      {
        OR: [
          { areaCatalogId: area.id },
          { subcategoryCatalog: { areaId: area.id } },
          ...legacyArea,
        ],
      },
    ],
  };
}

function ongoingSubProjectWhere(sub: {
  id: string;
  systemSubCategory: ProjectSubCategory | null;
}): Prisma.ProjectWhereInput {
  return {
    AND: [
      ongoingProjectWhere(),
      {
        OR: [
          { subcategoryCatalogId: sub.id },
          ...(sub.systemSubCategory
            ? [
                {
                  subcategoryCatalogId: null,
                  subCategory: sub.systemSubCategory,
                },
              ]
            : []),
        ],
      },
    ],
  };
}

const seededCompanyIds = new Set<string>();

export async function ensureProjectServiceCatalog(
  companyId: string
): Promise<ProjectCatalogAreaDTO[]> {
  const catalog = catalogDelegate();
  if (!catalog) return [];

  try {
    if (!seededCompanyIds.has(companyId)) {
      await seedProjectServiceCatalog(companyId, catalog);
      seededCompanyIds.add(companyId);
    }
    return await loadProjectServiceCatalog(companyId);
  } catch {
    return [];
  }
}

async function seedProjectServiceCatalog(
  companyId: string,
  catalog: NonNullable<ReturnType<typeof catalogDelegate>>
): Promise<void> {
  const existingAreas = await catalog.area.findMany({
    where: {
      companyId,
      slug: { in: SYSTEM_AREA_SEEDS.map((area) => area.slug) },
    },
    select: {
      id: true,
      slug: true,
      subcategories: { select: { slug: true } },
    },
  });
  const areaBySlug = new Map(
    existingAreas.map((area) => [area.slug, area] as const)
  );

  for (const area of SYSTEM_AREA_SEEDS) {
    let areaRow = areaBySlug.get(area.slug);
    if (!areaRow) {
      const created = await catalog.area.create({
        data: {
          companyId,
          slug: area.slug,
          nameEn: area.nameEn,
          nameId: area.nameId,
          sortOrder: area.sortOrder,
          isSystem: true,
          systemArea: area.systemArea,
          allowsOneTime: area.allowsOneTime,
        },
        select: {
          id: true,
          slug: true,
          subcategories: { select: { slug: true } },
        },
      });
      areaRow = created;
    }

    const haveSub = new Set(areaRow.subcategories.map((sub) => sub.slug));
    for (const sub of area.subcategories) {
      if (haveSub.has(sub.slug)) continue;
      await catalog.sub.create({
        data: {
          areaId: areaRow.id,
          slug: sub.slug,
          nameEn: sub.nameEn,
          nameId: sub.nameId,
          sortOrder: sub.sortOrder,
          isSystem: true,
          systemSubCategory: sub.systemSubCategory,
          billingKind: sub.billingKind,
        },
      });
    }
  }
}

async function loadProjectServiceCatalog(
  companyId: string
): Promise<ProjectCatalogAreaDTO[]> {
  const catalog = catalogDelegate();
  if (!catalog) return [];
  const rows = await catalog.area.findMany({
    where: { companyId },
    include: {
      subcategories: {
        orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
        include: {
          _count: {
            select: { projects: { where: ongoingProjectWhere() } },
          },
        },
      },
      _count: {
        select: {
          projects: { where: ongoingProjectWhere() },
          subcategories: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
  });

  return rows.map((area) => ({
    id: area.id,
    slug: area.slug,
    nameEn: area.nameEn,
    nameId: area.nameId,
    sortOrder: area.sortOrder,
    isSystem: area.isSystem,
    systemArea: area.systemArea,
    allowsOneTime: area.allowsOneTime,
    projectCount: area._count.projects,
    subcategoryCount: area._count.subcategories,
    subcategories: area.subcategories.map((sub) => ({
      id: sub.id,
      slug: sub.slug,
      nameEn: sub.nameEn,
      nameId: sub.nameId,
      sortOrder: sub.sortOrder,
      isSystem: sub.isSystem,
      systemSubCategory: sub.systemSubCategory,
      billingKind: sub.billingKind,
      projectCount: sub._count.projects,
    })),
  }));
}

async function uniqueAreaSlug(companyId: string, name: string): Promise<string> {
  const base = slugFromName(name);
  let slug = base;
  let n = 2;
  while (
    await prisma.projectServiceAreaCatalog.findUnique({
      where: { companyId_slug: { companyId, slug } },
    })
  ) {
    slug = `${base}_${n}`;
    n += 1;
  }
  return slug;
}

async function uniqueSubSlug(areaId: string, name: string): Promise<string> {
  const base = slugFromName(name);
  let slug = base;
  let n = 2;
  while (
    await prisma.projectSubcategoryCatalog.findUnique({
      where: { areaId_slug: { areaId, slug } },
    })
  ) {
    slug = `${base}_${n}`;
    n += 1;
  }
  return slug;
}

export async function createProjectServiceArea(formData: FormData) {
  const session = await requireProjectManager();
  const companyId = session.user.companyId;
  if (!companyId) throw new Error("Company is required.");

  const nameEn = titleCaseCatalogName(String(formData.get("nameEn") ?? ""));
  const nameIdRaw = String(formData.get("nameId") ?? "").trim();
  const nameId = nameIdRaw ? titleCaseCatalogName(nameIdRaw) : nameEn;
  if (!nameEn) throw new Error("Service area name is required.");

  const allowsOneTimeRaw = String(formData.get("allowsOneTime") ?? "")
    .trim()
    .toLowerCase();
  const allowsOneTime =
    allowsOneTimeRaw === "yes" ||
    allowsOneTimeRaw === "true" ||
    allowsOneTimeRaw === "1";

  const slug = await uniqueAreaSlug(companyId, nameEn);
  const last = await prisma.projectServiceAreaCatalog.findFirst({
    where: { companyId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const area = await prisma.projectServiceAreaCatalog.create({
    data: {
      companyId,
      slug,
      nameEn,
      nameId,
      sortOrder: (last?.sortOrder ?? 50) + 10,
      isSystem: false,
      systemArea: "OTHER" satisfies ServiceArea,
      allowsOneTime,
    },
  });

  if (allowsOneTime) {
    const oneTimeSlug = await uniqueSubSlug(area.id, DEFAULT_ONE_TIME_SUB_NAMES.nameEn);
    await prisma.projectSubcategoryCatalog.create({
      data: {
        areaId: area.id,
        slug: oneTimeSlug,
        nameEn: DEFAULT_ONE_TIME_SUB_NAMES.nameEn,
        nameId: DEFAULT_ONE_TIME_SUB_NAMES.nameId,
        sortOrder: 20,
        isSystem: false,
        systemSubCategory: null as ProjectSubCategory | null,
        billingKind: "ONE_TIME",
      },
    });
  }

  revalidatePath("/projects");
  revalidatePath("/teams");
  revalidatePath("/teams/availability");
}

export async function createProjectSubcategory(formData: FormData) {
  const session = await requireProjectManager();
  const companyId = session.user.companyId;
  if (!companyId) throw new Error("Company is required.");

  const areaId = String(formData.get("areaId") ?? "").trim();
  const nameEn = titleCaseCatalogName(String(formData.get("nameEn") ?? ""));
  const nameIdRaw = String(formData.get("nameId") ?? "").trim();
  const nameId = nameIdRaw ? titleCaseCatalogName(nameIdRaw) : nameEn;
  if (!areaId) throw new Error("Service area is required.");
  if (!nameEn) throw new Error("Subcategory name is required.");

  const area = await prisma.projectServiceAreaCatalog.findFirst({
    where: { id: areaId, companyId },
  });
  if (!area) throw new Error("Service area was not found.");

  const rawKind = String(formData.get("billingKind") ?? "CONTRACT")
    .trim()
    .toUpperCase();
  let billingKind: ProjectCatalogBillingKind = "CONTRACT";
  if (rawKind === "ONE_TIME") billingKind = "ONE_TIME";

  if (billingKind === "ONE_TIME" && !allowsCustomOneTimeSubcategory(area)) {
    if (area.systemArea === "CLEANING") {
      throw new Error(
        "Cleaning One Time types are General Cleaning and Facade Cleaning only."
      );
    }
    throw new Error("This service area cannot have One Time.");
  }

  const slug = await uniqueSubSlug(area.id, nameEn);
  if (isReservedSubcategorySlug(slug) && area.isSystem) {
    throw new Error("That subcategory already exists for this service area.");
  }

  const last = await prisma.projectSubcategoryCatalog.findFirst({
    where: { areaId: area.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.projectSubcategoryCatalog.create({
    data: {
      areaId: area.id,
      slug,
      nameEn,
      nameId,
      sortOrder: (last?.sortOrder ?? 30) + 10,
      isSystem: false,
      systemSubCategory: null as ProjectSubCategory | null,
      billingKind,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/teams");
  revalidatePath("/teams/availability");
}

function parseCatalogNames(formData: FormData, requiredLabel: string) {
  const nameEn = titleCaseCatalogName(String(formData.get("nameEn") ?? ""));
  const nameIdRaw = String(formData.get("nameId") ?? "").trim();
  const nameId = nameIdRaw ? titleCaseCatalogName(nameIdRaw) : nameEn;
  if (!nameEn) throw new Error(`${requiredLabel} is required.`);
  return { nameEn, nameId };
}

export async function updateProjectServiceArea(id: string, formData: FormData) {
  const session = await requireProjectManager();
  const companyId = session.user.companyId;
  if (!companyId) throw new Error("Company is required.");

  const area = await prisma.projectServiceAreaCatalog.findFirst({
    where: { id, companyId },
  });
  if (!area) throw new Error("Service area was not found.");

  const { nameEn, nameId } = parseCatalogNames(formData, "Service area name");
  await prisma.projectServiceAreaCatalog.update({
    where: { id: area.id },
    data: { nameEn, nameId },
  });

  revalidatePath("/projects");
  revalidatePath("/teams");
  revalidatePath("/teams/availability");
}

export async function deleteProjectServiceArea(id: string) {
  const session = await requireProjectManager();
  const companyId = session.user.companyId;
  if (!companyId) throw new Error("Company is required.");

  const area = await prisma.projectServiceAreaCatalog.findFirst({
    where: { id, companyId },
  });
  if (!area) throw new Error("Service area was not found.");

  const projectCount = await prisma.project.count({
    where: ongoingAreaProjectWhere(area),
  });
  if (projectCount > 0) {
    throw new Error(
      "This service area cannot be deleted while a project is still ongoing."
    );
  }

  await prisma.projectServiceAreaCatalog.delete({ where: { id: area.id } });
  revalidatePath("/projects");
  revalidatePath("/teams");
  revalidatePath("/teams/availability");
}

export async function updateProjectSubcategory(id: string, formData: FormData) {
  const session = await requireProjectManager();
  const companyId = session.user.companyId;
  if (!companyId) throw new Error("Company is required.");

  const sub = await prisma.projectSubcategoryCatalog.findFirst({
    where: { id, area: { companyId } },
  });
  if (!sub) throw new Error("Subcategory was not found.");

  const { nameEn, nameId } = parseCatalogNames(formData, "Subcategory name");
  await prisma.projectSubcategoryCatalog.update({
    where: { id: sub.id },
    data: { nameEn, nameId },
  });

  revalidatePath("/projects");
  revalidatePath("/teams");
  revalidatePath("/teams/availability");
}

export async function deleteProjectSubcategory(id: string) {
  const session = await requireProjectManager();
  const companyId = session.user.companyId;
  if (!companyId) throw new Error("Company is required.");

  const sub = await prisma.projectSubcategoryCatalog.findFirst({
    where: { id, area: { companyId } },
  });
  if (!sub) throw new Error("Subcategory was not found.");
  if (isVirtualCatalogRow(sub.id)) {
    throw new Error("Subcategory was not found.");
  }

  const projectCount = await prisma.project.count({
    where: ongoingSubProjectWhere(sub),
  });
  if (projectCount > 0) {
    throw new Error(
      "This subcategory cannot be deleted while a project is still ongoing."
    );
  }

  await prisma.projectSubcategoryCatalog.delete({ where: { id: sub.id } });
  revalidatePath("/projects");
  revalidatePath("/teams");
  revalidatePath("/teams/availability");
}
