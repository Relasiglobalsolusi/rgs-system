import {
  callOpenAiJsonExtract,
  isPaymentDocumentVerifyConfigured,
  normalizeDocumentDate,
  normalizeExtractedAmount,
  normalizePartyName,
  partyNameSimilarity,
} from "@/lib/payment-document-verify";
import type {
  ExtractPurchaseInvoiceResult,
  PurchaseInvoiceExtractFields,
} from "@/lib/purchase-invoice-extract-client";

export type {
  ExtractPurchaseInvoiceResult,
  PurchaseInvoiceExtractFields,
} from "@/lib/purchase-invoice-extract-client";

/** Soft-fill confidence floor for Includes-PPN toggle (0–1). */
const INCLUDES_PPN_CONFIDENCE_THRESHOLD = 0.75;
/** Fuzzy vendor dropdown match floor (0–1). */
export const PURCHASE_VENDOR_MATCH_THRESHOLD = 0.85;

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeConfidence(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = value > 1 ? value / 100 : value;
    return clamp01(n);
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (!Number.isFinite(n)) return null;
    return clamp01(n > 1 ? n / 100 : n);
  }
  return null;
}

function asBooleanFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no") return false;
  }
  return null;
}

function hasUsefulExtractFields(fields: PurchaseInvoiceExtractFields): boolean {
  return Boolean(
    fields.supplierName ||
      fields.invoiceRef ||
      fields.invoiceDate ||
      fields.amount != null ||
      fields.dpp != null ||
      fields.ppn != null ||
      fields.includesPpn != null
  );
}

/**
 * Soft-fill Includes PPN only when confidence is high, or when a clear
 * PPN line amount is present (implies tax-inclusive commercial invoice).
 */
function resolveIncludesPpn(input: {
  includesPpn: boolean | null;
  includesPpnConfidence: number | null;
  ppn: number | null;
}): boolean | null {
  if (input.ppn != null && Number.isFinite(input.ppn) && input.ppn > 0) {
    return true;
  }
  if (input.includesPpn == null) return null;
  const confidence = input.includesPpnConfidence;
  if (confidence == null || confidence < INCLUDES_PPN_CONFIDENCE_THRESHOLD) {
    return null;
  }
  return input.includesPpn;
}

/**
 * AI/OCR soft-fill for a supplier commercial invoice (not a Faktur Pajak).
 * Prefer fill + let the user edit; never blocks save.
 */
export async function extractPurchaseInvoiceFields(
  file: File,
  vendors: Array<{ id: string; name: string }> = []
): Promise<ExtractPurchaseInvoiceResult> {
  if (!isPaymentDocumentVerifyConfigured()) {
    return { ok: false, code: "not_configured" };
  }

  try {
    const json = await callOpenAiJsonExtract(
      file,
      [
        "This is a supplier commercial purchase invoice / bill (Indonesian or general), NOT a Faktur Pajak tax invoice.",
        "RGS / PT Relasi Global Solusi is typically the buyer (pembeli). The supplier/vendor is the seller (penjual).",
        "Extract these fields carefully. If a field is unreadable or uncertain, use null — do not invent values.",
        "- supplierName: supplier / vendor / penjual / from company legal name (NOT the buyer/RGS).",
        "- invoiceRef: invoice number / nomor faktur / No. Invoice / reference printed on the bill.",
        "- invoiceDate: invoice issue date as YYYY-MM-DD when possible.",
        "- amount: grand total payable in IDR (including tax if the bill is tax-inclusive); plain number.",
        "- dpp: taxable base / Dasar Pengenaan Pajak / subtotal before PPN if printed; else null.",
        "- ppn: PPN / VAT amount if printed as a separate line; else null.",
        "- includesPpn: true if the bill clearly includes PPN/VAT (PPN line, 'termasuk PPN', DPP+PPN, etc.); false if clearly excluding tax; null if unclear.",
        "- includesPpnConfidence: 0–1 how sure you are about includesPpn.",
        'Return JSON: {"supplierName": string|null, "invoiceRef": string|null, "invoiceDate": string|null, "amount": number|null, "dpp": number|null, "ppn": number|null, "includesPpn": boolean|null, "includesPpnConfidence": number|null}',
      ].join(" ")
    );

    const dpp = normalizeExtractedAmount(json.dpp);
    const ppn = normalizeExtractedAmount(json.ppn);
    const fields: PurchaseInvoiceExtractFields = {
      supplierName: asTrimmedString(json.supplierName),
      invoiceRef: asTrimmedString(json.invoiceRef),
      invoiceDate: normalizeDocumentDate(json.invoiceDate),
      amount: normalizeExtractedAmount(json.amount),
      dpp,
      ppn,
      includesPpn: resolveIncludesPpn({
        includesPpn: asBooleanFlag(json.includesPpn),
        includesPpnConfidence: normalizeConfidence(json.includesPpnConfidence),
        ppn,
      }),
    };

    if (!hasUsefulExtractFields(fields)) {
      return { ok: false, code: "extract_failed" };
    }

    const matched = matchVendorByExtractedName(fields.supplierName, vendors);

    return {
      ok: true,
      fields,
      matchedVendorId: matched?.id ?? null,
    };
  } catch {
    return { ok: false, code: "api_error" };
  }
}

export type PurchaseVendorMatch = {
  id: string;
  name: string;
  similarity: number;
};

/**
 * Pick the best fuzzy vendor match for an extracted supplier name.
 * Returns null when nothing clears PURCHASE_VENDOR_MATCH_THRESHOLD.
 */
export function matchVendorByExtractedName(
  extractedName: string | null | undefined,
  vendors: Array<{ id: string; name: string }>,
  threshold = PURCHASE_VENDOR_MATCH_THRESHOLD
): PurchaseVendorMatch | null {
  const needle = normalizePartyName(extractedName);
  if (!needle || vendors.length === 0) return null;

  let best: PurchaseVendorMatch | null = null;
  for (const vendor of vendors) {
    const similarity = partyNameSimilarity(extractedName, vendor.name);
    if (similarity < threshold) continue;
    if (!best || similarity > best.similarity) {
      best = { id: vendor.id, name: vendor.name, similarity };
    }
  }
  return best;
}
