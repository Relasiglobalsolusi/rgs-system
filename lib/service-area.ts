import type { ServiceArea } from "@prisma/client";

/** Service areas used on projects (client sites). */
export const PROJECT_SERVICE_AREAS = [
  "CLEANING",
  "PARKING",
  "SECURITY",
  "PAYROLL_MANAGEMENT",
] as const satisfies readonly ServiceArea[];

export type ProjectServiceAreaValue = (typeof PROJECT_SERVICE_AREAS)[number];

/** All areas an Operations Manager may hold for approvals. */
export const OM_APPROVAL_AREAS = [
  "CLEANING",
  "PARKING",
  "SECURITY",
  "HEAD_OFFICE",
] as const satisfies readonly ServiceArea[];

const LABELS: Record<ServiceArea, string> = {
  CLEANING: "Cleaning",
  PARKING: "Parking",
  SECURITY: "Security",
  HEAD_OFFICE: "Head Office",
  PAYROLL_MANAGEMENT: "Payroll Management",
};

/** Display order for project Service Area labels. */
export const SERVICE_AREA_ORDER: ServiceArea[] = [
  "CLEANING",
  "PARKING",
  "SECURITY",
  "PAYROLL_MANAGEMENT",
];

/** Display order for OM Approval Areas checkboxes. */
export const OM_APPROVAL_AREA_ORDER: ServiceArea[] = [
  "CLEANING",
  "PARKING",
  "SECURITY",
  "HEAD_OFFICE",
];

export function serviceAreaLabel(area: ServiceArea): string {
  return LABELS[area] ?? area;
}

export function isProjectServiceArea(value: string): value is ProjectServiceAreaValue {
  return (PROJECT_SERVICE_AREAS as readonly string[]).includes(value);
}

export function parseServiceArea(
  value: FormDataEntryValue | string | null | undefined,
  fallback: ServiceArea = "CLEANING"
): ServiceArea {
  const raw = String(value ?? "").trim().toUpperCase();
  return isProjectServiceArea(raw) ? raw : fallback;
}

/** Narrow a stored ServiceArea to a project/site area (never Head Office). */
export function asProjectServiceArea(
  area: ServiceArea,
  fallback: ProjectServiceAreaValue = "CLEANING"
): ProjectServiceAreaValue {
  return isProjectServiceArea(area) ? area : fallback;
}

export function isOmApprovalArea(value: string): value is ServiceArea {
  return (OM_APPROVAL_AREAS as readonly string[]).includes(value);
}

/** Operations Manager (Cleaning And Parking) style label. */
export function formatOperationsManagerLabel(areas: ServiceArea[]): string {
  const ordered = OM_APPROVAL_AREA_ORDER.filter((a) => areas.includes(a));
  if (ordered.length === 0) return "Operations Manager";
  const labels = ordered.map(serviceAreaLabel);
  if (labels.length === 1) {
    return `Operations Manager (${labels[0]})`;
  }
  if (labels.length === 2) {
    return `Operations Manager (${labels[0]} And ${labels[1]})`;
  }
  if (labels.length === 3) {
    return `Operations Manager (${labels[0]}, ${labels[1]} And ${labels[2]})`;
  }
  return `Operations Manager (${labels.slice(0, -1).join(", ")} And ${labels[labels.length - 1]})`;
}

export function parseOmApprovalAreas(formData: FormData): ServiceArea[] {
  const raw = formData.getAll("omApprovalAreas").map(String);
  return OM_APPROVAL_AREA_ORDER.filter((a) =>
    raw.some((r) => r.trim().toUpperCase() === a)
  );
}
