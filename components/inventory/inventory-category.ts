/** Case-insensitive item-type match used by Stock / Issues / Write-Offs tables. */
export function matchInventoryItemType(itemType: string, target: string) {
  return itemType.trim().toLowerCase() === target;
}

export type InventoryItemTypeCategory =
  | "equipment"
  | "vehicle"
  | "sparePart"
  | "chemical"
  | "consumable"
  | "other";

export function inventoryItemTypeCategory(
  itemType: string
): InventoryItemTypeCategory {
  if (matchInventoryItemType(itemType, "equipment")) return "equipment";
  if (matchInventoryItemType(itemType, "vehicle")) return "vehicle";
  if (matchInventoryItemType(itemType, "spare part")) return "sparePart";
  if (matchInventoryItemType(itemType, "chemical")) return "chemical";
  if (matchInventoryItemType(itemType, "consumable")) return "consumable";
  return "other";
}

export type InventoryItemTypePartitions<T> = {
  equipment: T[];
  vehicle: T[];
  sparePart: T[];
  chemical: T[];
  consumable: T[];
  other: T[];
};

export const INVENTORY_CATEGORY_TITLE_KEY: Record<
  InventoryItemTypeCategory,
  string
> = {
  equipment: "pages.inventory.overview.categoryEquipment",
  vehicle: "pages.inventory.overview.categoryVehicles",
  sparePart: "pages.inventory.overview.categorySpareParts",
  chemical: "pages.inventory.overview.categoryChemicals",
  consumable: "pages.inventory.overview.categoryConsumables",
  other: "pages.inventory.overview.categoryOthers",
};

export const INVENTORY_CATEGORY_DISPLAY_ORDER: InventoryItemTypeCategory[] = [
  "equipment",
  "vehicle",
  "sparePart",
  "chemical",
  "consumable",
  "other",
];

function partitionByItemTypeGetter<T>(
  rows: T[],
  getItemType: (row: T) => string
): InventoryItemTypePartitions<T> {
  const equipment: T[] = [];
  const vehicle: T[] = [];
  const sparePart: T[] = [];
  const chemical: T[] = [];
  const consumable: T[] = [];
  const other: T[] = [];
  for (const row of rows) {
    switch (inventoryItemTypeCategory(getItemType(row))) {
      case "equipment":
        equipment.push(row);
        break;
      case "vehicle":
        vehicle.push(row);
        break;
      case "sparePart":
        sparePart.push(row);
        break;
      case "chemical":
        chemical.push(row);
        break;
      case "consumable":
        consumable.push(row);
        break;
      default:
        other.push(row);
        break;
    }
  }
  return { equipment, vehicle, sparePart, chemical, consumable, other };
}

/** Partition flat catalog/stock rows by itemType. */
export function partitionItemsByInventoryItemType<
  T extends { itemType: string },
>(rows: T[]): InventoryItemTypePartitions<T> {
  return partitionByItemTypeGetter(rows, (row) => row.itemType);
}

/** Partition helper for nested rows: Equipment / Spare Parts / Chemicals / Consumables / Others. */
export function partitionByInventoryItemType<
  T extends { item: { itemType: string } },
>(rows: T[]): InventoryItemTypePartitions<T> {
  return partitionByItemTypeGetter(rows, (row) => row.item.itemType);
}

export function compareMovedAtDesc(
  a: { movedAt: string },
  b: { movedAt: string }
) {
  return b.movedAt.localeCompare(a.movedAt);
}
