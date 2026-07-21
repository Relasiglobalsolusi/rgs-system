import type { AppLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import type { PaymentVerifyFailureCode } from "@/lib/payment-document-verify";
import { formatContractPrice } from "@/lib/project-billing";

export type PaymentVerifyFailureDetails = {
  expectedAmount?: number;
  proofAmount?: number | null;
  expectedNpwp?: string;
  extractedNpwp?: string | null;
  expectedBuyerName?: string;
  extractedBuyerName?: string | null;
  expectedSellerName?: string;
  extractedSellerName?: string | null;
  taxSerial?: string | null;
  taxIssuedDate?: string | null;
  expectedRecipientAccount?: string;
  extractedRecipientAccount?: string | null;
  invoiceIssuedDate?: string;
  proofTransferDate?: string | null;
  proofStatus?: string | null;
  expectedPayerName?: string;
  extractedPayerName?: string | null;
  expectedReference?: string;
  extractedReference?: string | null;
};

/**
 * Localized one-line message for a payment/tax document verify failure code.
 */
export function paymentVerifyFailureMessage(
  locale: AppLocale,
  code: PaymentVerifyFailureCode,
  details?: PaymentVerifyFailureDetails
): string {
  const expected =
    details?.expectedAmount != null
      ? formatContractPrice(details.expectedAmount)
      : "—";
  const proof =
    details?.proofAmount != null
      ? formatContractPrice(details.proofAmount)
      : "—";

  switch (code) {
    case "not_configured":
      return translate(locale, "pages.billing.paymentVerifyNotConfigured");
    case "invoice_amount_missing":
      return translate(
        locale,
        "pages.billing.paymentVerifyInvoiceAmountMissing"
      );
    case "invoice_date_missing":
      return translate(locale, "pages.billing.paymentVerifyInvoiceDateMissing");
    case "company_bank_missing":
      return translate(locale, "pages.billing.paymentVerifyCompanyBankMissing");
    case "client_npwp_missing":
      return translate(locale, "pages.billing.paymentVerifyClientNpwpMissing");
    case "client_name_missing":
      return translate(locale, "pages.billing.paymentVerifyClientNameMissing");
    case "supplier_name_missing":
      return translate(locale, "pages.billing.paymentVerifySupplierNameMissing");
    case "proof_amount_mismatch":
      return translate(locale, "pages.billing.paymentVerifyProofAmountMismatch", {
        expected,
        found: proof,
      });
    case "proof_recipient_mismatch":
      return translate(
        locale,
        "pages.billing.paymentVerifyProofRecipientMismatch",
        {
          expected: details?.expectedRecipientAccount || "—",
          found: details?.extractedRecipientAccount || "—",
        }
      );
    case "proof_recipient_unclear":
      return translate(
        locale,
        "pages.billing.paymentVerifyProofRecipientUnclear",
        {
          expected: details?.expectedRecipientAccount || "—",
          found: details?.extractedRecipientAccount || "—",
        }
      );
    case "proof_date_before_invoice":
      return translate(
        locale,
        "pages.billing.paymentVerifyProofDateBeforeInvoice",
        {
          invoiceDate: details?.invoiceIssuedDate || "—",
          proofDate: details?.proofTransferDate || "—",
        }
      );
    case "proof_status_not_success":
      return translate(
        locale,
        "pages.billing.paymentVerifyProofStatusNotSuccess",
        { status: details?.proofStatus || "—" }
      );
    case "proof_payer_name_mismatch":
      return translate(
        locale,
        "pages.billing.paymentVerifyProofPayerNameMismatch",
        {
          expected: details?.expectedPayerName || "—",
          found: details?.extractedPayerName || "—",
        }
      );
    case "proof_reference_mismatch":
      return translate(
        locale,
        "pages.billing.paymentVerifyProofReferenceMismatch",
        {
          expected: details?.expectedReference || "—",
          found: details?.extractedReference || "—",
        }
      );
    case "tax_amount_mismatch":
      return translate(locale, "pages.billing.paymentVerifyTaxAmountMismatch", {
        expected,
      });
    case "tax_npwp_mismatch":
      return translate(locale, "pages.billing.paymentVerifyTaxNpwpMismatch", {
        expected: details?.expectedNpwp || "—",
        found: details?.extractedNpwp || "—",
      });
    case "tax_buyer_name_mismatch":
      return translate(
        locale,
        "pages.billing.paymentVerifyTaxBuyerNameMismatch",
        {
          expected: details?.expectedBuyerName || "—",
          found: details?.extractedBuyerName || "—",
        }
      );
    case "tax_buyer_is_company":
      return translate(locale, "pages.billing.paymentVerifyTaxBuyerIsCompany", {
        found: details?.extractedBuyerName || "—",
      });
    case "tax_seller_is_client":
      return translate(locale, "pages.billing.paymentVerifyTaxSellerIsClient", {
        found: details?.extractedSellerName || "—",
        client: details?.expectedBuyerName || "—",
      });
    case "tax_buyer_is_supplier":
      return translate(locale, "pages.billing.paymentVerifyTaxBuyerIsSupplier", {
        found: details?.extractedBuyerName || "—",
        supplier: details?.expectedSellerName || "—",
      });
    case "tax_seller_is_company":
      return translate(locale, "pages.billing.paymentVerifyTaxSellerIsCompany", {
        found: details?.extractedSellerName || "—",
      });
    case "tax_seller_name_mismatch":
      return translate(
        locale,
        "pages.billing.paymentVerifyTaxSellerNameMismatch",
        {
          expected: details?.expectedSellerName || "—",
          found: details?.extractedSellerName || "—",
        }
      );
    case "tax_serial_missing":
      return translate(locale, "pages.billing.paymentVerifyTaxSerialMissing");
    case "tax_serial_duplicate":
      return translate(locale, "pages.billing.paymentVerifyTaxSerialDuplicate", {
        serial: details?.taxSerial || "—",
      });
    case "tax_document_duplicate":
      return translate(
        locale,
        "pages.billing.paymentVerifyTaxDocumentDuplicate"
      );
    case "tax_date_reuse":
      return translate(locale, "pages.billing.paymentVerifyTaxDateReuse", {
        date: details?.taxIssuedDate || "—",
      });
    case "extract_failed":
      return translate(locale, "pages.billing.paymentVerifyExtractFailed");
    case "api_error":
      return translate(locale, "pages.billing.paymentVerifyApiError");
    default:
      return translate(locale, "pages.billing.paymentVerifyRejected");
  }
}
