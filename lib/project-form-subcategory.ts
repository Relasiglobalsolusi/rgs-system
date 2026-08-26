import type { ProjectSubCategory, ServiceArea } from "@prisma/client";

/** UI-only pill — not stored. Resolves to a one-shot subcategory. */
export const ONE_TIME_FORM_VALUE = "ONE_TIME";

export type CleaningOneTimeType = "GENERAL_CLEANING" | "FACADE_CLEANING";

export function isCleaningOneTimeType(
  value: string | null | undefined
): value is CleaningOneTimeType {
  return (
    value === "GENERAL_CLEANING" || value === "FACADE_CLEANING"
  );
}

export function formSubcategoryFromStored(
  subCategory: ProjectSubCategory | string,
  serviceArea?: ServiceArea | string | null
): {
  uiSubcategory: string;
  oneTimeCleaningType: CleaningOneTimeType | "";
} {
  if (subCategory === "GENERAL_CLEANING") {
    return { uiSubcategory: "GENERAL_CLEANING", oneTimeCleaningType: "GENERAL_CLEANING" };
  }
  if (subCategory === "FACADE_CLEANING") {
    return { uiSubcategory: "FACADE_CLEANING", oneTimeCleaningType: "FACADE_CLEANING" };
  }
  if (subCategory === "ONE_TIME_LANDSCAPING") {
    return { uiSubcategory: ONE_TIME_FORM_VALUE, oneTimeCleaningType: "" };
  }
  if (subCategory === "ONE_TIME_SECURITY") {
    return { uiSubcategory: ONE_TIME_FORM_VALUE, oneTimeCleaningType: "" };
  }
  if (
    serviceArea === "SECURITY" &&
    subCategory === "SECURITY"
  ) {
    return { uiSubcategory: "SECURITY", oneTimeCleaningType: "" };
  }
  return { uiSubcategory: String(subCategory), oneTimeCleaningType: "" };
}

export function storedSubCategoryFromForm(opts: {
  serviceArea: string;
  uiSubcategory: string;
  oneTimeCleaningType?: string;
}): ProjectSubCategory | null {
  const { serviceArea, uiSubcategory, oneTimeCleaningType } = opts;

  if (serviceArea === "PARKING") return "PARKING";
  if (serviceArea === "PAYROLL_MANAGEMENT") return "PAYROLL_MANAGEMENT";

  if (uiSubcategory === ONE_TIME_FORM_VALUE) {
    if (serviceArea === "CLEANING") {
      return isCleaningOneTimeType(oneTimeCleaningType)
        ? oneTimeCleaningType
        : null;
    }
    if (serviceArea === "LANDSCAPING") return "ONE_TIME_LANDSCAPING";
    if (serviceArea === "SECURITY") return "ONE_TIME_SECURITY";
    return null;
  }

  if (serviceArea === "CLEANING") {
    if (uiSubcategory === "REGULAR_CLEANING") return "REGULAR_CLEANING";
    if (uiSubcategory === "GENERAL_CLEANING") return "GENERAL_CLEANING";
    if (uiSubcategory === "FACADE_CLEANING") return "FACADE_CLEANING";
    if (uiSubcategory === "CONTRACT_GENERAL_CLEANING") {
      return "CONTRACT_GENERAL_CLEANING";
    }
    if (uiSubcategory === "CONTRACT_FACADE_CLEANING") {
      return "CONTRACT_FACADE_CLEANING";
    }
    return null;
  }

  if (serviceArea === "LANDSCAPING") {
    if (uiSubcategory === "REGULAR_LANDSCAPING") return "REGULAR_LANDSCAPING";
    if (uiSubcategory === "ONE_TIME_LANDSCAPING") return "ONE_TIME_LANDSCAPING";
    return null;
  }

  if (serviceArea === "SECURITY") {
    if (uiSubcategory === "SECURITY") return "SECURITY";
    return null;
  }

  return null;
}
