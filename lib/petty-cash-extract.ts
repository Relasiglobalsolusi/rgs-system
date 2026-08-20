import {
  callOpenAiJsonExtract,
  isPaymentDocumentVerifyConfigured,
  normalizeDocumentDate,
  normalizeExtractedAmount,
} from "@/lib/payment-document-verify";

export type ExtractPettyCashReceiptResult =
  | {
      ok: true;
      amount: number;
      merchantName: string | null;
      receiptDate: string | null;
    }
  | {
      ok: false;
      code: "not_configured" | "extract_failed" | "api_error";
    };

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Read the payable total from a lunch / cash bill so Finance can match
 * the typed amount before debiting petty cash.
 */
export async function extractPettyCashReceiptAmount(
  file: File
): Promise<ExtractPettyCashReceiptResult> {
  if (!isPaymentDocumentVerifyConfigured()) {
    return { ok: false, code: "not_configured" };
  }

  try {
    const json = await callOpenAiJsonExtract(
      file,
      [
        "This is a cash receipt, restaurant bill, store receipt, or simple proof of payment (Indonesian or general).",
        "It is NOT a Faktur Pajak and NOT a formal supplier invoice.",
        "Extract the grand total the customer actually paid in IDR. Use the final payable / total / jumlah / grand total line.",
        "If several totals appear, pick the amount that was paid (after tax and service).",
        "Do not invent a total. If the paid amount is unreadable, return null.",
        "- amount: paid total as a plain number in IDR.",
        "- merchantName: shop / restaurant / merchant name if printed; else null.",
        "- receiptDate: receipt date as YYYY-MM-DD when possible; else null.",
        'Return JSON: {"amount": number|null, "merchantName": string|null, "receiptDate": string|null}',
      ].join(" ")
    );

    const amount = normalizeExtractedAmount(json.amount);
    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      return { ok: false, code: "extract_failed" };
    }

    return {
      ok: true,
      amount: Math.round(amount),
      merchantName: asTrimmedString(json.merchantName),
      receiptDate: normalizeDocumentDate(json.receiptDate),
    };
  } catch {
    return { ok: false, code: "api_error" };
  }
}
