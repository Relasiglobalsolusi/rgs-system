/** Standard warehouse / purchase units of measure. */

export const INVENTORY_UNIT_CODES = [
  "pcs",
  "unit",
  "pair",
  "set",
  "roll",
  "box",
  "carton",
  "pack",
  "bag",
  "sack",
  "drum",
  "bottle",
  "can",
  "kg",
  "g",
  "ton",
  "l",
  "ml",
  "m",
  "cm",
  "m2",
] as const;

export type InventoryUnitCode = (typeof INVENTORY_UNIT_CODES)[number];

const PACK_UNITS = new Set<string>([
  "box",
  "carton",
  "pack",
  "bag",
  "sack",
  "drum",
]);

const DECIMAL_UNITS = new Set<string>([
  "kg",
  "g",
  "ton",
  "l",
  "ml",
  "m",
  "cm",
  "m2",
]);

const UNIT_ALIASES: Record<string, InventoryUnitCode> = {
  pcs: "pcs",
  pc: "pcs",
  piece: "pcs",
  pieces: "pcs",
  unit: "unit",
  units: "unit",
  pair: "pair",
  pairs: "pair",
  set: "set",
  sets: "set",
  roll: "roll",
  rolls: "roll",
  box: "box",
  boxes: "box",
  carton: "carton",
  cartons: "carton",
  pack: "pack",
  packs: "pack",
  package: "pack",
  bag: "bag",
  bags: "bag",
  sack: "sack",
  sacks: "sack",
  drum: "drum",
  drums: "drum",
  bottle: "bottle",
  bottles: "bottle",
  can: "can",
  cans: "can",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  kilo: "kg",
  kilos: "kg",
  g: "g",
  gram: "g",
  grams: "g",
  ton: "ton",
  tons: "ton",
  tonne: "ton",
  tonnes: "ton",
  l: "l",
  liter: "l",
  litre: "l",
  liters: "l",
  litres: "l",
  ml: "ml",
  milliliter: "ml",
  millilitre: "ml",
  m: "m",
  meter: "m",
  metre: "m",
  meters: "m",
  metres: "m",
  cm: "cm",
  centimeter: "cm",
  centimetre: "cm",
  m2: "m2",
  sqm: "m2",
  "m²": "m2",
};

export function isInventoryUnitCode(
  value: string
): value is InventoryUnitCode {
  return (INVENTORY_UNIT_CODES as readonly string[]).includes(value);
}

/** Map free-text / legacy units onto a standard code when possible. */
export function normalizeInventoryUnit(raw: string | null | undefined): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "pcs";
  const alias = UNIT_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  return trimmed;
}

export function isPackInventoryUnit(unit: string): boolean {
  return PACK_UNITS.has(normalizeInventoryUnit(unit));
}

export function allowsDecimalInventoryQty(unit: string): boolean {
  return DECIMAL_UNITS.has(normalizeInventoryUnit(unit));
}

export function defaultUnitForItemType(itemType: string): InventoryUnitCode {
  const normalized = itemType.trim().toLowerCase();
  if (normalized === "chemical") return "kg";
  if (normalized === "equipment") return "pcs";
  if (normalized === "vehicle") return "unit";
  return "pcs";
}

export function inventoryUnitMessageKey(unit: string): string {
  const code = normalizeInventoryUnit(unit);
  return isInventoryUnitCode(code)
    ? `pages.inventory.units.${code}`
    : "";
}

export function stockQuantityFromPurchase(options: {
  purchaseQty: number;
  packContents?: number | null;
}): number {
  const purchaseQty = options.purchaseQty;
  const packContents = options.packContents;
  if (
    packContents != null &&
    Number.isFinite(packContents) &&
    packContents > 0
  ) {
    return purchaseQty * packContents;
  }
  return purchaseQty;
}
