import type {
  InventoryCatalogItem,
  InventoryProjectOption,
  InventoryVendorOption,
} from "@/components/inventory/inventory-types";

/** Trigger + list label: SKU and name. */
export function formatCatalogItemLabel(item: InventoryCatalogItem): string {
  return `${item.sku} — ${item.name}`;
}

/** Issue / write-off list rows include available stock. */
export function formatCatalogItemStockLabel(item: InventoryCatalogItem): string {
  return `${item.sku} — ${item.name} — ${item.currentStock} ${item.unit}`;
}

export function formatVendorLabel(vendor: InventoryVendorOption): string {
  return `${vendor.name} (${vendor.shortCode})`;
}

export function formatProjectLabel(project: InventoryProjectOption): string {
  return project.name;
}
