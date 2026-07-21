import type { EmployeeType, EmploymentType, Placement } from "@prisma/client";

export const PLACEMENTS = [
  "AVAILABLE",
  "ON_PROJECT",
  "HEAD_OFFICE",
  "FIELD",
] as const satisfies readonly Placement[];

export type PlacementCode = Placement;

/** Legacy Assignment Scope codes → Placement (for import aliases / docs). */
export const LEGACY_SCOPE_TO_PLACEMENT: Record<string, Placement> = {
  UNASSIGNED: "AVAILABLE",
  SITE_BASED: "ON_PROJECT",
  CORPORATE: "HEAD_OFFICE",
  FIELD_OPERATIONS: "FIELD",
  "SITE ASSIGNMENT": "ON_PROJECT",
  "HEAD OFFICE": "HEAD_OFFICE",
  "FIELD OPERATIONS": "FIELD",
  AVAILABLE: "AVAILABLE",
  "ON PROJECT": "ON_PROJECT",
  "ON_PROJECT": "ON_PROJECT",
  FIELD: "FIELD",
};

export function isAvailablePlacement(
  placement: Placement | null | undefined
): boolean {
  return placement === "AVAILABLE";
}

export function isOnProjectPlacement(
  placement: Placement | null | undefined
): boolean {
  return placement === "ON_PROJECT";
}

export function isHeadOfficePlacement(
  placement: Placement | null | undefined
): boolean {
  return placement === "HEAD_OFFICE";
}

export function isFieldPlacement(
  placement: Placement | null | undefined
): boolean {
  return placement === "FIELD";
}

/** Corporate / HO placement → HEAD_OFFICE employee type; else PROJECT_SITE. */
export function employeeTypeFromPlacement(
  placement: Placement | null | undefined
): EmployeeType {
  return isHeadOfficePlacement(placement) ? "HEAD_OFFICE" : "PROJECT_SITE";
}

/**
 * Soft-restore default placement:
 * Corporate department → HEAD_OFFICE; everyone else → AVAILABLE.
 */
export function placementOnSoftRestore(options: {
  categorySlug?: string | null;
  categoryPrefix?: string | null;
}): Placement {
  const slug = (options.categorySlug ?? "").trim().toLowerCase();
  const prefix = (options.categoryPrefix ?? "").trim().toUpperCase();
  if (slug === "corporate" || prefix === "COR" || prefix === "HO") {
    return "HEAD_OFFICE";
  }
  return "AVAILABLE";
}

/**
 * Initial placement when creating an employee (no free Placement dropdown).
 * Corporate → HEAD_OFFICE; otherwise AVAILABLE (Assign sets ON_PROJECT / FIELD).
 */
export function initialPlacementForDepartment(options: {
  categorySlug?: string | null;
  categoryPrefix?: string | null;
}): Placement {
  return placementOnSoftRestore(options);
}

export function parsePlacementImportValue(raw: string): Placement | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase().replace(/[\s-]+/g, "_");
  const spaced = trimmed.toUpperCase().replace(/\s+/g, " ");

  if ((PLACEMENTS as readonly string[]).includes(upper)) {
    return upper as Placement;
  }

  return (
    LEGACY_SCOPE_TO_PLACEMENT[upper] ??
    LEGACY_SCOPE_TO_PLACEMENT[spaced] ??
    null
  );
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

export function parseEmploymentTypeImportValue(
  raw: string
): EmploymentType | null {
  const value = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!value) return null;
  if (
    value === "full_time" ||
    value === "fulltime" ||
    value === "ft" ||
    value === "penuh_waktu" ||
    value === "penuhwaktu"
  ) {
    return "FULL_TIME";
  }
  if (
    value === "part_time" ||
    value === "parttime" ||
    value === "pt" ||
    value === "paruh_waktu" ||
    value === "paruhwaktu"
  ) {
    return "PART_TIME";
  }
  return null;
}

/** CICO / Progress: only when currently ON_PROJECT. */
export function canAccessSiteWorkModules(
  placement: Placement | null | undefined
): boolean {
  return isOnProjectPlacement(placement);
}

/** Leave / Sick: allowed when AVAILABLE. */
export function canRequestLeaveWhenAvailable(
  placement: Placement | null | undefined
): boolean {
  return isAvailablePlacement(placement);
}
