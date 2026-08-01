/**
 * AP / purchase settlement helpers (Clients {@link lib/billing} counterpart).
 *
 * PurchaseInvoice has no payment status enum and no paidAt field in the schema.
 * Settlements and the purchase payments view derive open vs overdue from vendor
 * payment terms + invoice date only (see PurchaseInvoiceTable / settlements AP).
 *
 * Until paid / cancelled statuses exist, every linked PurchaseInvoice is treated
 * as an unsettled AP obligation for soft-delete and similar gates. When those
 * statuses land, narrow {@link isPurchaseInvoiceUnsettledAp} to unpaid/open only.
 */

/** True while the purchase still represents open AP (all rows today). */
export function isPurchaseInvoiceUnsettledAp(_invoice: {
  id: string;
}): boolean {
  return true;
}

/**
 * Input VAT (PPN Masukan) still missing — Clients-equivalent of pending tax
 * invoice acknowledgment on billed periods.
 */
export function isPurchaseTaxInvoicePending(invoice: {
  includesPpn: boolean;
  taxInvoiceFilePath: string | null;
}): boolean {
  return invoice.includesPpn && invoice.taxInvoiceFilePath == null;
}
