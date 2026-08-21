import type { Prisma, ProjectSubCategory } from "@prisma/client";

import { isProjectSubCategory } from "@/lib/project-subcategory";

/** Top-row Projects directory chips (system). Custom areas use `custom:{id}`. */
export const PROJECT_DIRECTORY_TOP_CHIPS = [
  "all",
  "INTERNAL",
  "ONE_TIME",
  "CLEANING",
  "SECURITY",
  "PARKING",
  "PAYROLL_MANAGEMENT",
  "LANDSCAPING",
] as const;

export type ProjectDirectoryTopChip =
  | (typeof PROJECT_DIRECTORY_TOP_CHIPS)[number]
  | `custom:${string}`;

const SYSTEM_TOP = new Set<string>(PROJECT_DIRECTORY_TOP_CHIPS);

export function isSystemTopChip(
  value: string
): value is (typeof PROJECT_DIRECTORY_TOP_CHIPS)[number] {
  return SYSTEM_TOP.has(value);
}

export function customChipId(value: string | null | undefined): string | null {
  if (!value?.startsWith("custom:")) return null;
  const id = value.slice("custom:".length).trim();
  return id || null;
}

export function toCustomChip(id: string): `custom:${string}` {
  return `custom:${id}`;
}

/** Cleaning contract subchips — not one-shot. */
export const CLEANING_DIRECTORY_SUB_CHIPS = [
  { key: "REGULAR" as const, subCategories: ["REGULAR_CLEANING"] as const },
  {
    key: "GENERAL" as const,
    subCategories: ["CONTRACT_GENERAL_CLEANING"] as const,
  },
  {
    key: "FACADE" as const,
    subCategories: ["CONTRACT_FACADE_CLEANING"] as const,
  },
];

/** One Time subchips — one-shot jobs by work kind. */
export const ONE_TIME_DIRECTORY_SUB_CHIPS = [
  {
    key: "LANDSCAPING" as const,
    subCategories: ["ONE_TIME_LANDSCAPING"] as const,
  },
  {
    key: "SECURITY" as const,
    subCategories: ["ONE_TIME_SECURITY"] as const,
  },
  {
    key: "CLEANING" as const,
    subCategories: ["GENERAL_CLEANING", "FACADE_CLEANING"] as const,
  },
];

export type DirectoryChipState = {
  area: ProjectDirectoryTopChip;
  sub: string | undefined;
};

/** Map legacy `?subCategory=` bookmarks onto the new area / sub chips. */
export function legacySubCategoryToChips(
  subCategory: string | undefined
): DirectoryChipState | null {
  if (!subCategory || !isProjectSubCategory(subCategory)) return null;
  switch (subCategory) {
    case "INTERNAL":
      return { area: "INTERNAL", sub: undefined };
    case "REGULAR_CLEANING":
      return { area: "CLEANING", sub: "REGULAR" };
    case "CONTRACT_GENERAL_CLEANING":
      return { area: "CLEANING", sub: "GENERAL" };
    case "CONTRACT_FACADE_CLEANING":
      return { area: "CLEANING", sub: "FACADE" };
    case "GENERAL_CLEANING":
    case "FACADE_CLEANING":
      return { area: "ONE_TIME", sub: "CLEANING" };
    case "REGULAR_LANDSCAPING":
      return { area: "LANDSCAPING", sub: undefined };
    case "ONE_TIME_LANDSCAPING":
      return { area: "ONE_TIME", sub: "LANDSCAPING" };
    case "SECURITY":
      return { area: "SECURITY", sub: undefined };
    case "ONE_TIME_SECURITY":
      return { area: "ONE_TIME", sub: "SECURITY" };
    case "PARKING":
      return { area: "PARKING", sub: undefined };
    case "PAYROLL_MANAGEMENT":
      return { area: "PAYROLL_MANAGEMENT", sub: undefined };
    default:
      return null;
  }
}

export function resolveDirectoryChips(opts: {
  area?: string;
  sub?: string;
  subCategory?: string;
}): DirectoryChipState {
  const areaRaw = opts.area?.trim() || "";
  if (areaRaw && (isSystemTopChip(areaRaw) || customChipId(areaRaw))) {
    return {
      area: areaRaw as ProjectDirectoryTopChip,
      sub: opts.sub?.trim() || undefined,
    };
  }
  const legacy = legacySubCategoryToChips(opts.subCategory);
  if (legacy) return legacy;
  return { area: "all", sub: undefined };
}

function systemSubCategoriesForTop(
  area: (typeof PROJECT_DIRECTORY_TOP_CHIPS)[number]
): ProjectSubCategory[] | null {
  switch (area) {
    case "INTERNAL":
      return ["INTERNAL"];
    case "ONE_TIME":
      return [
        "GENERAL_CLEANING",
        "FACADE_CLEANING",
        "ONE_TIME_LANDSCAPING",
        "ONE_TIME_SECURITY",
      ];
    case "CLEANING":
      return [
        "REGULAR_CLEANING",
        "CONTRACT_GENERAL_CLEANING",
        "CONTRACT_FACADE_CLEANING",
      ];
    case "SECURITY":
      return ["SECURITY"];
    case "PARKING":
      return ["PARKING"];
    case "PAYROLL_MANAGEMENT":
      return ["PAYROLL_MANAGEMENT"];
    case "LANDSCAPING":
      return ["REGULAR_LANDSCAPING"];
    default:
      return null;
  }
}

function systemSubCategoriesForSubChip(
  area: (typeof PROJECT_DIRECTORY_TOP_CHIPS)[number],
  sub: string
): ProjectSubCategory[] | null {
  if (area === "CLEANING") {
    const row = CLEANING_DIRECTORY_SUB_CHIPS.find((item) => item.key === sub);
    return row ? [...row.subCategories] : null;
  }
  if (area === "ONE_TIME") {
    const row = ONE_TIME_DIRECTORY_SUB_CHIPS.find((item) => item.key === sub);
    return row ? [...row.subCategories] : null;
  }
  if (area === "LANDSCAPING" && (sub === "LANDSCAPING" || !sub)) {
    return ["REGULAR_LANDSCAPING"];
  }
  return null;
}

/**
 * Prisma `where` for Projects directory chips.
 * Custom contract rows under Cleaning use REGULAR_CLEANING + catalog id —
 * Regular / General / Facade subchips exclude those custom catalog rows.
 */
export function projectWhereForDirectoryChips(
  chips: DirectoryChipState
): Prisma.ProjectWhereInput {
  const customAreaId = customChipId(chips.area);
  if (customAreaId) {
    const customSubId = chips.sub ? customChipId(chips.sub) : null;
    if (customSubId) {
      return { subcategoryCatalogId: customSubId };
    }
    return { areaCatalogId: customAreaId };
  }

  if (!isSystemTopChip(chips.area) || chips.area === "all") {
    return {};
  }

  const customSubId = chips.sub ? customChipId(chips.sub) : null;
  if (customSubId) {
    return { subcategoryCatalogId: customSubId };
  }

  if (chips.sub) {
    const subs = systemSubCategoriesForSubChip(chips.area, chips.sub);
    if (subs) {
      return {
        subCategory: { in: [...subs] },
        OR: [
          { subcategoryCatalogId: null },
          { subcategoryCatalog: { isSystem: true } },
        ],
      };
    }
  }

  const topSubs = systemSubCategoriesForTop(chips.area);
  if (!topSubs) return {};

  if (chips.area === "CLEANING") {
    return {
      OR: [
        {
          subCategory: { in: [...topSubs] },
          OR: [
            { subcategoryCatalogId: null },
            { subcategoryCatalog: { isSystem: true } },
          ],
        },
        {
          serviceArea: "CLEANING",
          subcategoryCatalog: { isSystem: false, billingKind: "CONTRACT" },
        },
      ],
    };
  }

  if (chips.area === "ONE_TIME") {
    return {
      OR: [
        {
          subCategory: { in: [...topSubs] },
          OR: [
            { subcategoryCatalogId: null },
            { subcategoryCatalog: { isSystem: true } },
          ],
        },
        {
          subcategoryCatalog: {
            isSystem: false,
            billingKind: "ONE_TIME",
            area: { allowsOneTime: true },
          },
        },
      ],
    };
  }

  if (chips.area === "LANDSCAPING") {
    return {
      subCategory: "REGULAR_LANDSCAPING",
      OR: [
        { subcategoryCatalogId: null },
        { subcategoryCatalog: { isSystem: true } },
      ],
    };
  }

  return { subCategory: { in: [...topSubs] } };
}

export type DirectorySectionKey =
  | "INTERNAL"
  | "ONE_TIME"
  | "CLEANING"
  | "SECURITY"
  | "PARKING"
  | "PAYROLL_MANAGEMENT"
  | "LANDSCAPING"
  | `custom:${string}`;

export const DIRECTORY_ALL_SECTION_ORDER: DirectorySectionKey[] = [
  "INTERNAL",
  "ONE_TIME",
  "CLEANING",
  "SECURITY",
  "PARKING",
  "PAYROLL_MANAGEMENT",
  "LANDSCAPING",
];

export function directorySectionForProject(opts: {
  subCategory: ProjectSubCategory | string;
  areaCatalogId?: string | null;
  subcategoryCatalogIsSystem?: boolean | null;
  subcategoryBillingKind?: "CONTRACT" | "ONE_TIME" | null;
  areaSystemArea?: string | null;
}): DirectorySectionKey {
  const customArea = opts.areaCatalogId && opts.areaSystemArea === "OTHER";
  if (customArea && opts.areaCatalogId) {
    return toCustomChip(opts.areaCatalogId);
  }
  if (
    opts.subcategoryCatalogIsSystem === false &&
    opts.subcategoryBillingKind === "ONE_TIME"
  ) {
    return "ONE_TIME";
  }
  const mapped = legacySubCategoryToChips(opts.subCategory);
  if (mapped?.area && mapped.area !== "all" && isSystemTopChip(mapped.area)) {
    return mapped.area;
  }
  return "CLEANING";
}
