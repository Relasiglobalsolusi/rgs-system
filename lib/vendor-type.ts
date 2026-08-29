const VENDOR_TYPES = ["COMPANY", "INDIVIDUAL", "OVERSEAS"] as const;

export type VendorTypeValue = (typeof VENDOR_TYPES)[number];

export function parseVendorTypeValue(raw: string | null | undefined): VendorTypeValue {
  const value = String(raw ?? "COMPANY").trim().toUpperCase();
  if (value === "INDIVIDUAL") return "INDIVIDUAL";
  if (value === "OVERSEAS" || value === "INTERNATIONAL") return "OVERSEAS";
  return "COMPANY";
}

export function isOverseasVendor(type: string | null | undefined): boolean {
  return parseVendorTypeValue(type) === "OVERSEAS";
}

/** Factory supplier: import uses Overseas only; local uses Company or Individual. */
export function vendorMatchesPurchaseOrigin(
  type: string | null | undefined,
  origin: "LOCAL" | "IMPORT"
): boolean {
  return origin === "IMPORT" ? isOverseasVendor(type) : !isOverseasVendor(type);
}

export function vendorRequiresIndonesianTaxId(
  type: string | null | undefined
): boolean {
  return !isOverseasVendor(type);
}
