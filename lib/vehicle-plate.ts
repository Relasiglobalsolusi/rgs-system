/** Company vehicle identity is the number plate, not an EQP-style asset code. */

import { jakartaYearMonth } from "@/lib/vat";

/** Number plate - year + type - catalog vehicle code. */
export function formatVehicleIdentityLabel(parts: {
  plate?: string | null;
  name?: string | null;
  sku?: string | null;
  year?: number | string | null;
  cardNumber?: string | null;
}): string {
  const plate = parts.plate?.trim() || "";
  const year =
    parts.year != null && String(parts.year).trim() !== ""
      ? String(parts.year).trim()
      : "";
  const typeName = parts.cardNumber?.trim() || parts.name?.trim() || "";
  const cardOrName = [year, typeName].filter(Boolean).join(" ");
  const sku = parts.sku?.trim() || "";
  return [plate, cardOrName, sku].filter(Boolean).join(" - ");
}

export function normalizeVehiclePlate(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRequiredVehiclePlate(raw: unknown): string {
  const plate = normalizeVehiclePlate(String(raw ?? ""));
  if (plate.length < 3) {
    throw new Error("Enter the vehicle number plate.");
  }
  return plate;
}

const MIN_VEHICLE_YEAR = 1980;

export type VehicleConditionValue = "NEW" | "USED";

export function parseVehicleCondition(raw: unknown): VehicleConditionValue {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "NEW" || value === "USED") return value;
  throw new Error("Choose whether this vehicle is new or used.");
}

export function parseRequiredVehicleYear(
  raw: unknown,
  now: Date = new Date()
): number {
  const year = Number(String(raw ?? "").trim());
  const maxYear = jakartaYearMonth(now).year + 1;
  if (!Number.isInteger(year) || year < MIN_VEHICLE_YEAR || year > maxYear) {
    throw new Error("Enter the vehicle year.");
  }
  return year;
}
