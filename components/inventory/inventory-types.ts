export type InventoryCatalogItem = {
  id: string;
  sku: string;
  name: string;
  itemType: string;
  description: string | null;
  unit: string;
  minStock: number;
  currentStock: number;
  lastUnitCost: number | null;
  avgUnitCost: number | null;
  active: boolean;
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
    itemType: string;
  };
  project: {
    id: string;
    name: string;
    status: string;
  } | null;
};

export type InventoryAuditUser = {
  id: string;
  name: string | null;
  username: string | null;
};

export type InventoryWriteOffRow = {
  id: string;
  movedAt: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  reason: string;
  createdBy: InventoryAuditUser | null;
  item: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    itemType: string;
  };
};

export type InventorySoldOffAsset = {
  id: string;
  assetCode: string;
  serialNo: string | null;
};

export type InventorySoldOffRow = {
  id: string;
  soldAt: string;
  quantity: number;
  /** Pre-tax (ex-PPN) unit sale price. */
  unitPrice: number;
  /** Tax-inclusive sale total (subtotal + tax). */
  totalPrice: number;
  /** Pre-tax sale total (DPP). */
  subtotal: number;
  taxAmount: number;
  taxRatePercent: number | null;
  /** Inventory cost basis from the linked SOLD_OFF movement. */
  costBasis: number;
  /** Pre-tax sale − cost basis. */
  gainLoss: number;
  buyer: string | null;
  buyerType: "INDIVIDUAL" | "COMPANY" | null;
  /** Person-in-charge name (company buyers). */
  buyerPicName: string | null;
  /** Buyer / PIC contact phone. */
  buyerPhone: string | null;
  /** Buyer's National ID (KTP/NIK). Individual-only. */
  buyerIdNumber: string | null;
  buyerTaxId: string | null;
  buyerRegistration: string | null;
  buyerIdentityDocUrl: string | null;
  invoiceUrl: string | null;
  paymentProofUrl: string | null;
  paidAt: string | null;
  clientId: string | null;
  clientName: string | null;
  notes: string | null;
  createdBy: InventoryAuditUser | null;
  /** Equipment units retired with this sold-off (when applicable). */
  assets: InventorySoldOffAsset[];
  item: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    itemType: string;
  };
};

export type InventorySaleClientOption = {
  id: string;
  name: string;
  shortCode: string;
  clientType: "INDIVIDUAL" | "COMPANY";
  npwp: string | null;
  phone: string | null;
  contactPersonName: string | null;
  contactPersonPhone: string | null;
};

export type InventoryOverviewAssetRow = {
  id: string;
  assetCode: string;
  status: "AVAILABLE" | "ON_PROJECT" | "IN_TRANSIT" | "AT_FACTORY" | "RETIRED";
  unitCost: number | null;
  serialNo: string | null;
  notes: string | null;
  assignedAt: string | null;
  writeOffMovementId: string | null;
  soldOffMovementId: string | null;
  soldBuyer: string | null;
  soldAt: string | null;
  vehicleYear: number | null;
  createdAt: string;
  item: { id: string; sku: string; name: string; itemType: string } | null;
  project: { id: string; name: string } | null;
};

export type InventoryFactoryReturnRow = {
  id: string;
  sentAt: string;
  originalIntent: "REFUND" | "REPAIR" | "REPLACE";
  status: "WAITING" | "REPAIRED" | "REPLACED" | "REFUNDED";
  reason: string;
  quantity: number;
  refundAmount: number | null;
  refundedAt: string | null;
  receivedAt: string | null;
  vendorName: string | null;
  assetCode: string | null;
  item: { id: string; sku: string; name: string };
  createdBy: InventoryAuditUser | null;
};

export type InventoryVendorOption = {
  id: string;
  name: string;
  shortCode: string;
};

export type InventoryUncodedSaleRow = {
  id: string;
  soldAt: string;
  quantity: number;
  buyer: string | null;
};

export type InventoryTab =
  | "assetList"
  | "vehicles"
  | "stock"
  | "purchases"
  | "issues"
  | "writeOffs"
  | "factoryReturns";
