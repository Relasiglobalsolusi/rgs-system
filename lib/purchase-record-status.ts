/**
 * Expense record completeness — factory order can be saved before
 * vendor payment proof and (for imports) Jakarta duties / related costs.
 */

export type PurchaseRecordStatusKey =
  | "complete"
  | "record_not_completed"
  | "awaiting_import_duties"
  | "awaiting_vendor_payment"
  | "awaiting_handling"
  | "awaiting_shipping";

export type PurchaseRecordStatus = {
  key: PurchaseRecordStatusKey;
  complete: boolean;
};

export function isImportArrivalComplete(invoice: {
  origin?: string | null;
  importFulfillment?: string | null;
  importDutiesBillingId?: string | null;
  importDutiesFilePath?: string | null;
  importDutiesPaidAt?: Date | string | null;
  hasCustomsFees?: boolean | null;
  handlingVendorId?: string | null;
  handlingFeeIdr?: unknown;
  handlingFeeTaxInvoicePath?: string | null;
}): boolean {
  if (invoice.origin !== "IMPORT") return true;
  if (invoice.importFulfillment === "OUTSOURCED") {
    return Boolean(
      invoice.handlingVendorId && invoice.handlingFeeTaxInvoicePath
    );
  }
  const dutiesNeeded =
    invoice.importFulfillment === "INTERNAL" || Boolean(invoice.hasCustomsFees);
  if (!dutiesNeeded) return true;
  return Boolean(
    invoice.importDutiesBillingId &&
      (invoice.importDutiesPaidAt || invoice.importDutiesFilePath)
  );
}

export function isImportShippingRecorded(invoice: {
  freightIncludedInInvoice?: boolean | null;
  freightIdr?: unknown;
  freightForeignAmount?: unknown;
  shippingIdr?: unknown;
}): boolean {
  if (invoice.freightIncludedInInvoice !== false) return true;
  const freight =
    Number(invoice.freightIdr ?? 0) || Number(invoice.freightForeignAmount ?? 0);
  const shipping = Number(invoice.shippingIdr ?? 0);
  return freight > 0 || shipping > 0;
}

export function getPurchaseRecordChips(invoice: {
  origin?: string | null;
  importFulfillment?: string | null;
  importDutiesBillingId?: string | null;
  importDutiesFilePath?: string | null;
  importDutiesPaidAt?: Date | string | null;
  hasCustomsFees?: boolean | null;
  handlingVendorId?: string | null;
  handlingFeeIdr?: unknown;
  handlingFeeTaxInvoicePath?: string | null;
  paidAt?: Date | string | null;
  freeOfCharge?: boolean | null;
  reversedAt?: Date | string | null;
  freightIncludedInInvoice?: boolean | null;
  freightIdr?: unknown;
  freightForeignAmount?: unknown;
  shippingIdr?: unknown;
}): PurchaseRecordStatusKey[] {
  if (invoice.reversedAt) return [];
  const chips: PurchaseRecordStatusKey[] = [];
  const arrivalComplete = isImportArrivalComplete(invoice);
  const vendorSettled = Boolean(invoice.freeOfCharge || invoice.paidAt);
  if (invoice.origin === "IMPORT" && !isImportShippingRecorded(invoice)) {
    chips.push("awaiting_shipping");
  }
  if (!arrivalComplete && invoice.origin === "IMPORT") {
    chips.push(
      invoice.importFulfillment === "OUTSOURCED"
        ? "awaiting_handling"
        : "awaiting_import_duties"
    );
  }
  if (!vendorSettled) {
    chips.push("awaiting_vendor_payment");
  }
  if (chips.length === 0 && !arrivalComplete) {
    chips.push("record_not_completed");
  }
  return chips;
}

export function getPurchaseRecordStatus(invoice: {
  origin?: string | null;
  importFulfillment?: string | null;
  importDutiesBillingId?: string | null;
  importDutiesFilePath?: string | null;
  importDutiesPaidAt?: Date | string | null;
  hasCustomsFees?: boolean | null;
  handlingVendorId?: string | null;
  handlingFeeIdr?: unknown;
  handlingFeeTaxInvoicePath?: string | null;
  paidAt?: Date | string | null;
  freeOfCharge?: boolean | null;
  reversedAt?: Date | string | null;
  freightIncludedInInvoice?: boolean | null;
  freightIdr?: unknown;
  freightForeignAmount?: unknown;
  shippingIdr?: unknown;
}): PurchaseRecordStatus {
  if (invoice.reversedAt) {
    return { key: "complete", complete: true };
  }

  const chips = getPurchaseRecordChips(invoice);
  if (chips.length === 0) {
    return { key: "complete", complete: true };
  }
  return { key: chips[0]!, complete: false };
}

export function purchaseRecordStatusLabelKey(
  key: PurchaseRecordStatusKey
): string {
  switch (key) {
    case "awaiting_import_duties":
      return "pages.billing.purchaseStatusAwaitingImportDuties";
    case "awaiting_vendor_payment":
      return "pages.billing.purchaseStatusAwaitingVendorPayment";
    case "awaiting_handling":
      return "pages.billing.purchaseStatusAwaitingHandling";
    case "awaiting_shipping":
      return "pages.billing.purchaseStatusAwaitingShipping";
    case "record_not_completed":
      return "pages.billing.purchaseStatusRecordNotCompleted";
    default:
      return "pages.billing.purchaseStatusComplete";
  }
}
