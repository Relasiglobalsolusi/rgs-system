import type { ProjectSubCategory } from "@prisma/client";

export type { ProjectSubCategory };

export const PROJECT_SUB_CATEGORIES = [
  "REGULAR_CLEANING",
  "GENERAL_CLEANING",
  "FACADE_CLEANING",
] as const satisfies readonly ProjectSubCategory[];

/** Cleaning project types that require field progress reports. */
export const CLEANING_PROJECT_SUB_CATEGORIES = PROJECT_SUB_CATEGORIES;

export const PROJECT_SUB_CATEGORY_LABELS: Record<ProjectSubCategory, string> = {
  REGULAR_CLEANING: "Regular Cleaning",
  GENERAL_CLEANING: "General Cleaning",
  FACADE_CLEANING: "Facade Cleaning",
};

export function isProjectSubCategory(
  value: string
): value is ProjectSubCategory {
  return (PROJECT_SUB_CATEGORIES as readonly string[]).includes(value);
}

export function isCleaningProjectSubCategory(
  value: ProjectSubCategory | string | null | undefined
): value is ProjectSubCategory {
  return (
    typeof value === "string" &&
    (CLEANING_PROJECT_SUB_CATEGORIES as readonly string[]).includes(value)
  );
}

export function getProjectSubCategoryLabel(
  value: ProjectSubCategory | string | null | undefined
): string {
  if (!value || !isProjectSubCategory(value)) return "-";
  return PROJECT_SUB_CATEGORY_LABELS[value];
}

/** Short filter/table label — Regular / General / Facade (fits fixed chip). */
export function getProjectSubCategoryShortLabel(
  value: ProjectSubCategory | string | null | undefined
): string {
  const full = getProjectSubCategoryLabel(value);
  if (full === "-") return full;
  return full.replace(" Cleaning", "");
}

/**
 * Two-line StatusBadge label for full cleaning type
 * (REGULAR / CLEANING) inside the fixed 7.5rem chip.
 */
export function getProjectSubCategoryChipLines(
  value: ProjectSubCategory | string | null | undefined
): readonly [string, string] | null {
  if (!value || !isProjectSubCategory(value)) return null;
  const short = getProjectSubCategoryShortLabel(value);
  return [short, "Cleaning"] as const;
}

/** Select value for "All Projects" in project/subcategory filter dropdowns. */
export const PROJECT_FILTER_ALL = "all";

/** Prefix for subcategory filter values, e.g. `sub:REGULAR_CLEANING`. */
export const PROJECT_FILTER_SUB_PREFIX = "sub:";

export function toProjectSubCategoryFilterValue(
  subCategory: ProjectSubCategory
): string {
  return `${PROJECT_FILTER_SUB_PREFIX}${subCategory}`;
}

export function getProjectFilterSelectValue(opts: {
  projectId?: string;
  subCategory?: ProjectSubCategory;
}): string {
  if (opts.projectId) return opts.projectId;
  if (opts.subCategory) {
    return toProjectSubCategoryFilterValue(opts.subCategory);
  }
  return PROJECT_FILTER_ALL;
}

export type ProjectFilterSelection =
  | { kind: "all" }
  | { kind: "subCategory"; subCategory: ProjectSubCategory }
  | { kind: "project"; projectId: string };

export function parseProjectFilterSelectValue(
  value: string | null | undefined
): ProjectFilterSelection {
  if (!value || value === PROJECT_FILTER_ALL) return { kind: "all" };
  if (value.startsWith(PROJECT_FILTER_SUB_PREFIX)) {
    const sub = value.slice(PROJECT_FILTER_SUB_PREFIX.length);
    if (isProjectSubCategory(sub)) {
      return { kind: "subCategory", subCategory: sub };
    }
  }
  return { kind: "project", projectId: value };
}
