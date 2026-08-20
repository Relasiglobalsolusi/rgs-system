import type { EmployeeType, EmploymentType, Placement } from "@prisma/client";

export function isHeadOfficePlacement(
  placement: Placement | null | undefined
): boolean {
  return placement === "HEAD_OFFICE";
}

/** Corporate / HO placement → HEAD_OFFICE employee type; else PROJECT_SITE. */
export function employeeTypeFromPlacement(
  placement: Placement | null | undefined
): EmployeeType {
  return isHeadOfficePlacement(placement) ? "HEAD_OFFICE" : "PROJECT_SITE";
}

/** Corporate (COR) and Warehouse (WRH) are site-based desk / facility departments. */
export function isHeadOfficeWorkforceDepartment(options: {
  categorySlug?: string | null;
  categoryPrefix?: string | null;
}): boolean {
  const slug = (options.categorySlug ?? "").trim().toLowerCase();
  const prefix = (options.categoryPrefix ?? "").trim().toUpperCase();
  return (
    slug === "corporate" ||
    slug === "warehouse" ||
    prefix === "COR" ||
    prefix === "WRH" ||
    prefix === "HO"
  );
}

/**
 * Soft-restore default placement:
 * Corporate / Warehouse → HEAD_OFFICE; everyone else → AVAILABLE.
 */
export function placementOnSoftRestore(options: {
  categorySlug?: string | null;
  categoryPrefix?: string | null;
}): Placement {
  if (isHeadOfficeWorkforceDepartment(options)) {
    return "HEAD_OFFICE";
  }
  return "AVAILABLE";
}

/**
 * Initial placement when creating an employee (no free Placement dropdown).
 * Corporate / Warehouse → HEAD_OFFICE; otherwise AVAILABLE (Assign sets ON_PROJECT / FIELD).
 */
export function initialPlacementForDepartment(options: {
  categorySlug?: string | null;
  categoryPrefix?: string | null;
}): Placement {
  return placementOnSoftRestore(options);
}

export function formatPlacementLabel(
  placement: Placement | null | undefined,
  locale: "en" | "id" = "en"
): string {
  if (!placement) return "-";
  if (locale === "id") {
    switch (placement) {
      case "AVAILABLE":
        return "Tersedia";
      case "ON_PROJECT":
        return "Di Proyek";
      case "HEAD_OFFICE":
        return "Kantor Pusat";
      case "FIELD":
        return "Lapangan";
      case "ON_LEAVE":
        return "Cuti";
      default:
        return placement;
    }
  }
  switch (placement) {
    case "AVAILABLE":
      return "Available";
    case "ON_PROJECT":
      return "On Project";
    case "HEAD_OFFICE":
      return "Head Office";
    case "FIELD":
      return "Field";
    case "ON_LEAVE":
      return "On Leave";
    default:
      return placement;
  }
}

export function formatEmploymentTypeLabel(
  type: EmploymentType | null | undefined,
  locale: "en" | "id" = "en"
): string {
  if (!type) return "-";
  if (locale === "id") {
    return type === "FULL_TIME" ? "Penuh Waktu" : "Paruh Waktu";
  }
  return type === "FULL_TIME" ? "Full Time" : "Part Time";
}
