export type InventoryCatalogItem = {
  id: string;
  sku: string;
  name: string;
  itemType: string;
  category: string | null;
  description: string | null;
  unit: string;
  minStock: number;
  currentStock: number;
  lastUnitCost: number | null;
  avgUnitCost: number | null;
  active: boolean;
};

export type InventoryVendorOption = {
  id: string;
  name: string;
  shortCode: string;
};

export type InventoryProjectOption = {
  id: string;
  name: string;
  status: string;
};

export type InventoryPurchaseRow = {
  id: string;
  purchasedAt: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  invoiceNo: string | null;
  receiptUrl: string | null;
  notes: string | null;
  item: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    itemType: string;
  };
  vendor: {
    id: string;
    name: string;
    shortCode: string;
  };
};

export type InventoryIssueRow = {
  id: string;
  movedAt: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes: string | null;
  item: {
    id: string;
    sku: string;
    name: string;
    unit: string;
  };
  project: {
    id: string;
    name: string;
    status: string;
  } | null;
};

export type InventoryTab = "items" | "purchases" | "issues" | "stock";
