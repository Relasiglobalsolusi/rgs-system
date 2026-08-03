/** Case-insensitive item-type match used by Stock / Issues / Write-Offs tables. */
export function matchInventoryItemType(itemType: string, target: string) {
  return itemType.trim().toLowerCase() === target;
}

export type InventoryItemTypeCategory =
  | "equipment"
  | "chemical"
  | "consumable"
  | "other";

export function inventoryItemTypeCategory(
  itemType: string
): InventoryItemTypeCategory {
  if (matchInventoryItemType(itemType, "equipment")) return "equipment";
  if (matchInventoryItemType(itemType, "chemical")) return "chemical";
  if (matchInventoryItemType(itemType, "consumable")) return "consumable";
  return "other";
}

export type InventoryItemTypePartitions<T> = {
  equipment: T[];
  chemical: T[];
  consumable: T[];
  other: T[];
};

function partitionByItemTypeGetter<T>(
  rows: T[],
  getItemType: (row: T) => string
): InventoryItemTypePartitions<T> {
  const equipment: T[] = [];
  const chemical: T[] = [];
  const consumable: T[] = [];
  const other: T[] = [];
  for (const row of rows) {
    switch (inventoryItemTypeCategory(getItemType(row))) {
      case "equipment":
        equipment.push(row);
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
  return { equipment, chemical, consumable, other };
}

/** Partition flat catalog/stock rows by itemType. */
export function partitionItemsByInventoryItemType<
  T extends { itemType: string },
>(rows: T[]): InventoryItemTypePartitions<T> {
  return partitionByItemTypeGetter(rows, (row) => row.itemType);
}

/** Partition helper for nested rows: Equipment / Chemicals / Consumables / Others. */
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
