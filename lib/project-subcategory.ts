import type { ProjectSubCategory, ServiceArea } from "@prisma/client";

export type { ProjectSubCategory };

/** Commercial + Internal + non-cleaning services — full enum set used in the app. */
export const PROJECT_SUB_CATEGORIES = [
  "REGULAR_CLEANING",
  "GENERAL_CLEANING",
  "FACADE_CLEANING",
  "INTERNAL",
  "SECURITY",
  "PARKING",
  "PAYROLL_MANAGEMENT",
] as const satisfies readonly ProjectSubCategory[];

/** Client-facing cleaning types (directory filters / create dialog pills). */
export const COMMERCIAL_PROJECT_SUB_CATEGORIES = [
  "REGULAR_CLEANING",
  "GENERAL_CLEANING",
  "FACADE_CLEANING",
] as const satisfies readonly ProjectSubCategory[];

/**
 * Non-cleaning client service projects (Security / Parking / Payroll Management).
 * Parking + Payroll Management stay commercial-terms stubs (no invoice periods).
 * Security uses Regular-like monthly periods — see `usesInvoicePeriods`.
 */
export const SERVICE_PROJECT_SUB_CATEGORIES = [
  "SECURITY",
  "PARKING",
  "PAYROLL_MANAGEMENT",
] as const satisfies readonly ProjectSubCategory[];

/** All client-facing project types (cleaning commercial + service). */
export const CLIENT_PROJECT_SUB_CATEGORIES = [
  ...COMMERCIAL_PROJECT_SUB_CATEGORIES,
  ...SERVICE_PROJECT_SUB_CATEGORIES,
] as const satisfies readonly ProjectSubCategory[];

/**
 * Types that support field-style CICO + progress when staff are assigned.
 * Includes Internal (HO/Warehouse cleaning crew).
 */
export const CLEANING_PROJECT_SUB_CATEGORIES = [
  ...COMMERCIAL_PROJECT_SUB_CATEGORIES,
  "INTERNAL",
] as const satisfies readonly ProjectSubCategory[];

/**
 * Projects where assigned field staff may submit progress photos.
 * Cleaning (+ Internal) and Security. No forced interval / SOP scheduler —
 * staff may report whenever; managers set expectations offline.
 *
 * Parking / Payroll Management: not progress-eligible.
 */
export const PROGRESS_ELIGIBLE_PROJECT_SUB_CATEGORIES = [
  ...CLEANING_PROJECT_SUB_CATEGORIES,
  "SECURITY",
] as const satisfies readonly ProjectSubCategory[];

export const PROJECT_SUB_CATEGORY_LABELS: Record<ProjectSubCategory, string> = {
  REGULAR_CLEANING: "Regular Cleaning",
  GENERAL_CLEANING: "General Cleaning",
  FACADE_CLEANING: "Facade Cleaning",
  INTERNAL: "Internal Project",
  SECURITY: "Security",
  PARKING: "Parking",
  PAYROLL_MANAGEMENT: "Payroll Management",
};

export function isProjectSubCategory(
  value: string
): value is ProjectSubCategory {
  return (PROJECT_SUB_CATEGORIES as readonly string[]).includes(value);
}

export function isInternalProjectSubCategory(
  value: ProjectSubCategory | string | null | undefined
): boolean {
  return value === "INTERNAL";
}

export function isCommercialProjectSubCategory(
  value: ProjectSubCategory | string | null | undefined
): value is ProjectSubCategory {
  return (
    typeof value === "string" &&
    (COMMERCIAL_PROJECT_SUB_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isServiceProjectSubCategory(
  value: ProjectSubCategory | string | null | undefined
): value is ProjectSubCategory {
  return (
    typeof value === "string" &&
    (SERVICE_PROJECT_SUB_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isCleaningProjectSubCategory(
  value: ProjectSubCategory | string | null | undefined
): value is ProjectSubCategory {
  return (
    typeof value === "string" &&
    (CLEANING_PROJECT_SUB_CATEGORIES as readonly string[]).includes(value)
  );
}

/** True when field staff may submit progress reports (no cadence scheduler). */
export function isProgressEligibleProjectSubCategory(
  value: ProjectSubCategory | string | null | undefined
): boolean {
  return (
    typeof value === "string" &&
    (PROGRESS_ELIGIBLE_PROJECT_SUB_CATEGORIES as readonly string[]).includes(
      value
    )
  );
}

/** Subcategory locked to a non-cleaning service area (1:1). */
export function subCategoryForServiceArea(
  area: ServiceArea | string | null | undefined
): ProjectSubCategory | null {
  switch (area) {
    case "SECURITY":
      return "SECURITY";
    case "PARKING":
      return "PARKING";
    case "PAYROLL_MANAGEMENT":
      return "PAYROLL_MANAGEMENT";
    default:
      return null;
  }
}

/** Canonical service area for a subcategory (Internal → Head Office). */
export function serviceAreaForSubCategory(
  subCategory: ProjectSubCategory | string | null | undefined
): ServiceArea {
  switch (subCategory) {
    case "SECURITY":
      return "SECURITY";
    case "PARKING":
      return "PARKING";
    case "PAYROLL_MANAGEMENT":
      return "PAYROLL_MANAGEMENT";
    case "INTERNAL":
      return "HEAD_OFFICE";
    default:
      return "CLEANING";
  }
}

export function getProjectSubCategoryLabel(
  value: ProjectSubCategory | string | null | undefined
): string {
  if (!value || !isProjectSubCategory(value)) return "-";
  return PROJECT_SUB_CATEGORY_LABELS[value];
}

/** Short filter/table label — Regular / General / Facade / Internal / Security / … */
export function getProjectSubCategoryShortLabel(
  value: ProjectSubCategory | string | null | undefined
): string {
  if (isInternalProjectSubCategory(value)) return "Internal";
  if (value === "PAYROLL_MANAGEMENT") return "Payroll";
  if (value === "SECURITY" || value === "PARKING") {
    return getProjectSubCategoryLabel(value);
  }
  const full = getProjectSubCategoryLabel(value);
  if (full === "-") return full;
  return full.replace(" Cleaning", "").replace(" Project", "");
}

/**
 * Two-line StatusBadge label
 * (REGULAR / CLEANING) or (INTERNAL / PROJECT) / (SECURITY / SERVICE) inside the fixed chip.
 */
export function getProjectSubCategoryChipLines(
  value: ProjectSubCategory | string | null | undefined
): readonly [string, string] | null {
  if (!value || !isProjectSubCategory(value)) return null;
  if (isInternalProjectSubCategory(value)) {
    return ["Internal", "Project"] as const;
  }
  if (isServiceProjectSubCategory(value)) {
    if (value === "PAYROLL_MANAGEMENT") {
      return ["Payroll", "Mgmt"] as const;
    }
    return [getProjectSubCategoryShortLabel(value), "Service"] as const;
  }
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
