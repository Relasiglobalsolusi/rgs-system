import type {
  ProjectCatalogBillingKind,
  ProjectSubCategory,
  ServiceArea,
} from "@prisma/client";

import type { AppLocale } from "@/lib/i18n/locale";
import { titleCaseWords } from "@/lib/text-case";

export type ProjectCatalogAreaDTO = {
  id: string;
  slug: string;
  nameEn: string;
  nameId: string;
  sortOrder: number;
  isSystem: boolean;
  systemArea: ServiceArea;
  allowsOneTime: boolean;
  projectCount: number;
  subcategoryCount: number;
  subcategories: ProjectCatalogSubcategoryDTO[];
};

export type ProjectCatalogSubcategoryDTO = {
  id: string;
  slug: string;
  nameEn: string;
  nameId: string;
  sortOrder: number;
  isSystem: boolean;
  systemSubCategory: ProjectSubCategory | null;
  billingKind: ProjectCatalogBillingKind;
  projectCount: number;
};

/** Ended / historical projects do not block catalog delete. */
export const CATALOG_ENDED_PROJECT_STATUSES = ["COMPLETED", "CANCELLED"] as const;

export const DEFAULT_ONE_TIME_SUB_NAMES = {
  nameEn: "One Time",
  nameId: "Satu Kali",
} as const;

export function isVirtualCatalogRow(id: string): boolean {
  return id.startsWith("virtual:");
}

/** Parking / Payroll stay contract-only. Cleaning One Time stays General | Facade. */
export function allowsCustomOneTimeSubcategory(area: {
  allowsOneTime: boolean;
  systemArea: ServiceArea;
}): boolean {
  if (!area.allowsOneTime) return false;
  if (area.systemArea === "CLEANING") return false;
  if (area.systemArea === "PARKING") return false;
  if (area.systemArea === "PAYROLL_MANAGEMENT") return false;
  return true;
}

export function catalogAreaUsageCount(area: ProjectCatalogAreaDTO): number {
  const fromSubs = area.subcategories.reduce(
    (sum, sub) => sum + sub.projectCount,
    0
  );
  return Math.max(area.projectCount, fromSubs);
}

/** Real catalog rows only — every subcategory is editable and deletable. */
export function manageSubcategoriesForArea(
  area: ProjectCatalogAreaDTO
): ProjectCatalogSubcategoryDTO[] {
  return [...area.subcategories].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    return left.nameEn.localeCompare(right.nameEn);
  });
}

/** Add / Edit Project: hide One Time rows when the area has One Time off. */
export function catalogSubsForAddProject(area: ProjectCatalogAreaDTO) {
  return area.subcategories.filter(
    (sub) => sub.billingKind !== "ONE_TIME" || area.allowsOneTime
  );
}

export const SYSTEM_AREA_SEEDS: ReadonlyArray<{
  slug: string;
  nameEn: string;
  nameId: string;
  systemArea: ServiceArea;
  allowsOneTime: boolean;
  sortOrder: number;
  subcategories: ReadonlyArray<{
    slug: string;
    nameEn: string;
    nameId: string;
    systemSubCategory: ProjectSubCategory;
    billingKind: ProjectCatalogBillingKind;
    sortOrder: number;
  }>;
}> = [
  {
    slug: "CLEANING",
    nameEn: "Cleaning",
    nameId: "Cleaning",
    systemArea: "CLEANING",
    allowsOneTime: true,
    sortOrder: 10,
    subcategories: [
      {
        slug: "REGULAR_CLEANING",
        nameEn: "Regular Cleaning",
        nameId: "Pembersihan Rutin",
        systemSubCategory: "REGULAR_CLEANING",
        billingKind: "CONTRACT",
        sortOrder: 10,
      },
      {
        slug: "CONTRACT_GENERAL_CLEANING",
        nameEn: "General Cleaning",
        nameId: "Pembersihan General",
        systemSubCategory: "CONTRACT_GENERAL_CLEANING",
        billingKind: "CONTRACT",
        sortOrder: 20,
      },
      {
        slug: "CONTRACT_FACADE_CLEANING",
        nameEn: "Facade Cleaning",
        nameId: "Pembersihan Fasad",
        systemSubCategory: "CONTRACT_FACADE_CLEANING",
        billingKind: "CONTRACT",
        sortOrder: 30,
      },
    ],
  },
  {
    slug: "LANDSCAPING",
    nameEn: "Landscaping",
    nameId: "Landscaping",
    systemArea: "LANDSCAPING",
    allowsOneTime: true,
    sortOrder: 20,
    subcategories: [
      {
        slug: "REGULAR_LANDSCAPING",
        nameEn: "Regular",
        nameId: "Rutin",
        systemSubCategory: "REGULAR_LANDSCAPING",
        billingKind: "CONTRACT",
        sortOrder: 10,
      },
      {
        slug: "ONE_TIME_LANDSCAPING",
        nameEn: "One Time",
        nameId: "Satu Kali",
        systemSubCategory: "ONE_TIME_LANDSCAPING",
        billingKind: "ONE_TIME",
        sortOrder: 20,
      },
    ],
  },
  {
    slug: "SECURITY",
    nameEn: "Security",
    nameId: "Security",
    systemArea: "SECURITY",
    allowsOneTime: true,
    sortOrder: 30,
    subcategories: [
      {
        slug: "SECURITY",
        nameEn: "Regular",
        nameId: "Rutin",
        systemSubCategory: "SECURITY",
        billingKind: "CONTRACT",
        sortOrder: 10,
      },
      {
        slug: "ONE_TIME_SECURITY",
        nameEn: "One Time",
        nameId: "Satu Kali",
        systemSubCategory: "ONE_TIME_SECURITY",
        billingKind: "ONE_TIME",
        sortOrder: 20,
      },
    ],
  },
  {
    slug: "PARKING",
    nameEn: "Parking",
    nameId: "Parking",
    systemArea: "PARKING",
    allowsOneTime: false,
    sortOrder: 40,
    subcategories: [
      {
        slug: "PARKING",
        nameEn: "Parking",
        nameId: "Parking",
        systemSubCategory: "PARKING",
        billingKind: "CONTRACT",
        sortOrder: 10,
      },
    ],
  },
  {
    slug: "PAYROLL_MANAGEMENT",
    nameEn: "Payroll Management",
    nameId: "Manajemen Payroll",
    systemArea: "PAYROLL_MANAGEMENT",
    allowsOneTime: false,
    sortOrder: 50,
    subcategories: [
      {
        slug: "PAYROLL_MANAGEMENT",
        nameEn: "Payroll Management",
        nameId: "Manajemen Payroll",
        systemSubCategory: "PAYROLL_MANAGEMENT",
        billingKind: "CONTRACT",
        sortOrder: 10,
      },
    ],
  },
];

const RESERVED_SUB_SLUGS = new Set([
  "ONE_TIME",
  "REGULAR_CLEANING",
  "GENERAL_CLEANING",
  "FACADE_CLEANING",
  "CONTRACT_GENERAL_CLEANING",
  "CONTRACT_FACADE_CLEANING",
  "REGULAR_LANDSCAPING",
  "ONE_TIME_LANDSCAPING",
  "SECURITY",
  "ONE_TIME_SECURITY",
  "PARKING",
  "PAYROLL_MANAGEMENT",
  "INTERNAL",
]);

export function catalogDisplayName(
  row: { nameEn: string; nameId: string },
  locale: AppLocale
): string {
  return locale === "id" ? row.nameId || row.nameEn : row.nameEn || row.nameId;
}

export function slugFromName(name: string): string {
  const raw = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return raw || "CUSTOM";
}

export function titleCaseCatalogName(name: string): string {
  return titleCaseWords(name.trim());
}

export function isReservedSubcategorySlug(slug: string): boolean {
  return RESERVED_SUB_SLUGS.has(slug.trim().toUpperCase());
}

/** Demo-only Pest Control area — not a real RGS service. */
export function isRetiredDemoServiceArea(area: {
  slug?: string | null;
  nameEn?: string | null;
  nameId?: string | null;
}): boolean {
  const slug = (area.slug ?? "").trim().toUpperCase();
  if (slug === "PEST_CONTROL") return true;
  const name = `${area.nameEn ?? ""} ${area.nameId ?? ""}`.toLowerCase();
  return (
    name.includes("pest control") || name.includes("pengendalian hama")
  );
}

/** Map a custom catalog row to the stored billing enum (existing paths only). */
export function billingSubCategoryForCatalog(opts: {
  systemArea: ServiceArea;
  billingKind: ProjectCatalogBillingKind;
  systemSubCategory?: ProjectSubCategory | null;
}): ProjectSubCategory {
  if (opts.systemSubCategory) return opts.systemSubCategory;
  if (opts.billingKind === "ONE_TIME") {
    if (opts.systemArea === "LANDSCAPING") return "ONE_TIME_LANDSCAPING";
    if (opts.systemArea === "SECURITY") return "ONE_TIME_SECURITY";
    return "GENERAL_CLEANING";
  }
  if (opts.systemArea === "LANDSCAPING") return "REGULAR_LANDSCAPING";
  if (opts.systemArea === "SECURITY") return "SECURITY";
  if (opts.systemArea === "PARKING") return "PARKING";
  if (opts.systemArea === "PAYROLL_MANAGEMENT") return "PAYROLL_MANAGEMENT";
  return "REGULAR_CLEANING";
}
