/** Company vehicle identity is the number plate, not an EQP-style asset code. */

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
