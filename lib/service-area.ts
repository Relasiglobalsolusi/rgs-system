import type { ServiceArea } from "@prisma/client";

export const SERVICE_AREAS = [
  "CLEANING",
  "PARKING",
  "SECURITY",
] as const satisfies readonly ServiceArea[];

export type ServiceAreaValue = (typeof SERVICE_AREAS)[number];

const LABELS: Record<ServiceArea, string> = {
  CLEANING: "Cleaning",
  PARKING: "Parking",
  SECURITY: "Security",
};

/** Display order for Approval Areas / Service Area labels. */
export const SERVICE_AREA_ORDER: ServiceArea[] = [
  "CLEANING",
  "PARKING",
  "SECURITY",
];

export function serviceAreaLabel(area: ServiceArea): string {
  return LABELS[area] ?? area;
}

export function isServiceArea(value: string): value is ServiceArea {
  return (SERVICE_AREAS as readonly string[]).includes(value);
}

export function parseServiceArea(
  value: FormDataEntryValue | string | null | undefined,
  fallback: ServiceArea = "CLEANING"
): ServiceArea {
  const raw = String(value ?? "").trim().toUpperCase();
  return isServiceArea(raw) ? raw : fallback;
}

/** Operations Manager (Cleaning And Parking) style label. */
export function formatOperationsManagerLabel(areas: ServiceArea[]): string {
  const ordered = SERVICE_AREA_ORDER.filter((a) => areas.includes(a));
  if (ordered.length === 0) return "Operations Manager";
  const labels = ordered.map(serviceAreaLabel);
  if (labels.length === 1) {
    return `Operations Manager (${labels[0]})`;
  }
  if (labels.length === 2) {
    return `Operations Manager (${labels[0]} And ${labels[1]})`;
  }
  return `Operations Manager (${labels[0]}, ${labels[1]} And ${labels[2]})`;
}

export function parseOmApprovalAreas(formData: FormData): ServiceArea[] {
  const raw = formData.getAll("omApprovalAreas").map(String);
  const areas = SERVICE_AREA_ORDER.filter((a) =>
    raw.some((r) => r.trim().toUpperCase() === a)
  );
  return areas;
}
