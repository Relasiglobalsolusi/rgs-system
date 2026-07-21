/**
 * Client-safe types/helpers for purchase invoice soft-fill UI.
 * Keep server/OpenAI code out of this module.
 */

export type PurchaseInvoiceExtractFields = {
  supplierName: string | null;
  invoiceRef: string | null;
  invoiceDate: string | null;
  amount: number | null;
  dpp: number | null;
  ppn: number | null;
  /**
   * Set only when the model is confident enough to flip Includes PPN.
   * `null` means leave the user's current choice alone.
   */
  includesPpn: boolean | null;
};

export type ExtractPurchaseInvoiceResult =
  | {
      ok: true;
      fields: PurchaseInvoiceExtractFields;
      /** Best fuzzy vendor id when similarity ≥ threshold; else null → manual entry. */
      matchedVendorId: string | null;
    }
  | {
      ok: false;
      code: "not_configured" | "extract_failed" | "api_error";
    };

/** Format extracted IDR amount for a plain number input (no thousand separators). */
export function formatExtractedAmountForInput(
  amount: number | null | undefined
): string {
  if (amount == null || !Number.isFinite(amount)) return "";
  if (Number.isInteger(amount)) return String(amount);
  return String(amount);
}
