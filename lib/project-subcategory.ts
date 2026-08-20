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
 * Parking / Payroll Management: CICO yes, progress no.
 */
export const PROGRESS_ELIGIBLE_PROJECT_SUB_CATEGORIES = [
  ...CLEANING_PROJECT_SUB_CATEGORIES,
  "SECURITY",
] as const satisfies readonly ProjectSubCategory[];

/** Assigned staff may check in here (includes jobs that do not use progress). */
export const FIELD_CICO_ELIGIBLE_PROJECT_SUB_CATEGORIES = [
  ...PROGRESS_ELIGIBLE_PROJECT_SUB_CATEGORIES,
  "PARKING",
  "PAYROLL_MANAGEMENT",
] as const satisfies readonly ProjectSubCategory[];

export function isFieldCicoEligibleProjectSubCategory(
  value: ProjectSubCategory | string | null | undefined
): boolean {
  return (
    typeof value === "string" &&
    (FIELD_CICO_ELIGIBLE_PROJECT_SUB_CATEGORIES as readonly string[]).includes(
      value
    )
  );
}

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

/** Select value for "All Projects" in project/subcategory filter dropdowns. */
export const PROJECT_FILTER_ALL = "all";
