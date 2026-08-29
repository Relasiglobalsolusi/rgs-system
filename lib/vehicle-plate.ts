/** Company vehicle identity is the number plate, not an EQP-style asset code. */

import { jakartaYearMonth } from "@/lib/vat";

/** Number plate - card or vehicle name - catalog vehicle code. */
export function formatVehicleIdentityLabel(parts: {
  plate?: string | null;
  name?: string | null;
  sku?: string | null;
  cardNumber?: string | null;
}): string {
  const plate = parts.plate?.trim() || "";
  const cardOrName = parts.cardNumber?.trim() || parts.name?.trim() || "";
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
