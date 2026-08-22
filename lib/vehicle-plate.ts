/** Company vehicle identity is the number plate, not an EQP-style asset code. */

import { jakartaYearMonth } from "@/lib/vat";

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
