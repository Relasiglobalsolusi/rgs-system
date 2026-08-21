import type { ProjectSubCategory, ServiceArea } from "@prisma/client";

export type { ProjectSubCategory };

/** Commercial + Internal + non-cleaning services — full enum set used in the app. */
export const PROJECT_SUB_CATEGORIES = [
  "REGULAR_CLEANING",
  "GENERAL_CLEANING",
  "FACADE_CLEANING",
  "CONTRACT_GENERAL_CLEANING",
  "CONTRACT_FACADE_CLEANING",
  "REGULAR_LANDSCAPING",
  "ONE_TIME_LANDSCAPING",
  "INTERNAL",
  "SECURITY",
  "ONE_TIME_SECURITY",
  "PARKING",
  "PAYROLL_MANAGEMENT",
] as const satisfies readonly ProjectSubCategory[];

/** Cleaning → Regular / General / Facade (contract, not One Time). */
export const CLEANING_CONTRACT_SUB_CATEGORIES = [
  "REGULAR_CLEANING",
  "CONTRACT_GENERAL_CLEANING",
  "CONTRACT_FACADE_CLEANING",
] as const satisfies readonly ProjectSubCategory[];

/** Cleaning → One Time → General Cleaning | Facade Cleaning. */
export const CLEANING_ONE_TIME_SUB_CATEGORIES = [
  "GENERAL_CLEANING",
  "FACADE_CLEANING",
] as const satisfies readonly ProjectSubCategory[];

/** Client-facing cleaning types (directory / commercial guards). */
export const CLEANING_COMMERCIAL_SUB_CATEGORIES = [
  ...CLEANING_CONTRACT_SUB_CATEGORIES,
  ...CLEANING_ONE_TIME_SUB_CATEGORIES,
] as const satisfies readonly ProjectSubCategory[];

/** Client-facing landscaping types. */
export const LANDSCAPING_COMMERCIAL_SUB_CATEGORIES = [
  "REGULAR_LANDSCAPING",
  "ONE_TIME_LANDSCAPING",
] as const satisfies readonly ProjectSubCategory[];

/** Client-facing cleaning + landscaping types (directory filters / commercial guards). */
export const COMMERCIAL_PROJECT_SUB_CATEGORIES = [
  ...CLEANING_COMMERCIAL_SUB_CATEGORIES,
  ...LANDSCAPING_COMMERCIAL_SUB_CATEGORIES,
] as const satisfies readonly ProjectSubCategory[];

/**
 * Non-cleaning client service projects (Security / Parking / Payroll Management).
 * Parking + Payroll Management stay commercial-terms stubs (no invoice periods).
 * Security contract uses Regular-like monthly periods — see `usesInvoicePeriods`.
 */
export const SERVICE_PROJECT_SUB_CATEGORIES = [
  "SECURITY",
  "PARKING",
  "PAYROLL_MANAGEMENT",
] as const satisfies readonly ProjectSubCategory[];

/** All client-facing project types (cleaning + landscaping + service + one-time security). */
export const CLIENT_PROJECT_SUB_CATEGORIES = [
  ...COMMERCIAL_PROJECT_SUB_CATEGORIES,
  ...SERVICE_PROJECT_SUB_CATEGORIES,
  "ONE_TIME_SECURITY",
] as const satisfies readonly ProjectSubCategory[];

/**
 * Types that support field-style CICO + progress when staff are assigned.
 * Includes Internal (HO/Warehouse cleaning crew).
 */
export const CLEANING_PROJECT_SUB_CATEGORIES = [
  ...CLEANING_COMMERCIAL_SUB_CATEGORIES,
  "INTERNAL",
] as const satisfies readonly ProjectSubCategory[];

export const LANDSCAPING_PROJECT_SUB_CATEGORIES = [
  ...LANDSCAPING_COMMERCIAL_SUB_CATEGORIES,
] as const satisfies readonly ProjectSubCategory[];

/**
 * Projects where assigned field staff may submit progress photos.
 * Cleaning (+ Internal), Landscaping, and Security. No forced interval / SOP scheduler —
 * staff may report whenever; managers set expectations offline.
 *
 * Parking / Payroll Management: CICO yes, progress no.
 */
export const PROGRESS_ELIGIBLE_PROJECT_SUB_CATEGORIES = [
  ...CLEANING_PROJECT_SUB_CATEGORIES,
  ...LANDSCAPING_PROJECT_SUB_CATEGORIES,
  "SECURITY",
  "ONE_TIME_SECURITY",
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

export function isClientProjectSubCategory(
  value: ProjectSubCategory | string | null | undefined
): value is ProjectSubCategory {
  return (
    typeof value === "string" &&
    (CLIENT_PROJECT_SUB_CATEGORIES as readonly string[]).includes(value)
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

export function isLandscapingProjectSubCategory(
  value: ProjectSubCategory | string | null | undefined
): value is ProjectSubCategory {
  return (
    typeof value === "string" &&
    (LANDSCAPING_PROJECT_SUB_CATEGORIES as readonly string[]).includes(value)
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

/**
 * Subcategory locked to a 1:1 service area.
 * Security is no longer locked — it has Regular (contract) and One Time.
 */
export function subCategoryForServiceArea(
  area: ServiceArea | string | null | undefined
): ProjectSubCategory | null {
  switch (area) {
    case "PARKING":
      return "PARKING";
    case "PAYROLL_MANAGEMENT":
      return "PAYROLL_MANAGEMENT";
    default:
      return null;
  }
}

export function allowedSubCategoriesForServiceArea(
  area: ServiceArea | string | null | undefined
): readonly ProjectSubCategory[] {
  switch (area) {
    case "CLEANING":
      return CLEANING_COMMERCIAL_SUB_CATEGORIES;
    case "LANDSCAPING":
      return LANDSCAPING_COMMERCIAL_SUB_CATEGORIES;
    case "SECURITY":
      return ["SECURITY", "ONE_TIME_SECURITY"];
    case "PARKING":
      return ["PARKING"];
    case "PAYROLL_MANAGEMENT":
      return ["PAYROLL_MANAGEMENT"];
    default:
      return [];
  }
}

/** Canonical service area for a subcategory (Internal → Head Office). */
export function serviceAreaForSubCategory(
  subCategory: ProjectSubCategory | string | null | undefined
): ServiceArea {
  switch (subCategory) {
    case "SECURITY":
    case "ONE_TIME_SECURITY":
      return "SECURITY";
    case "PARKING":
      return "PARKING";
    case "PAYROLL_MANAGEMENT":
      return "PAYROLL_MANAGEMENT";
    case "INTERNAL":
      return "HEAD_OFFICE";
    case "REGULAR_LANDSCAPING":
    case "ONE_TIME_LANDSCAPING":
      return "LANDSCAPING";
    default:
      return "CLEANING";
  }
}

/** Select value for "All Projects" in project/subcategory filter dropdowns. */
export const PROJECT_FILTER_ALL = "all";
