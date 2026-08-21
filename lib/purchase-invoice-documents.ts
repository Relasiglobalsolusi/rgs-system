export type PurchaseDocumentKind =
  | "factory"
  | "invoice"
  | "government"
  | "tax"
  | "duties"
  | "handling"
  | "handlingTax"
  | "paymentProof";

export type PurchaseDocumentSlot = {
  kind: PurchaseDocumentKind;
  titleKey: string;
  hintKey?: string;
  href: string | null;
};

type PurchaseDocumentSource = {
  origin?: "LOCAL" | "IMPORT" | null;
  purchaseCategory?: string | null;
  filePath?: string | null;
  taxInvoiceFilePath?: string | null;
  importDutiesFilePath?: string | null;
  handlingInvoicePath?: string | null;
  paymentProofPath?: string | null;
  hasHandling?: boolean;
  hasInvoice?: boolean;
  hasCustomsFees?: boolean;
};

function pathOrNull(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

/** Every document that belongs on this expense. Empty href = not attached yet. */
export function listPurchaseDocumentSlots(
  source: PurchaseDocumentSource
): PurchaseDocumentSlot[] {
  const filePath = pathOrNull(source.filePath);
  const taxPath = pathOrNull(source.taxInvoiceFilePath);
  const dutiesPath = pathOrNull(source.importDutiesFilePath);
  const handlingPath = pathOrNull(source.handlingInvoicePath);
  const proofPath = pathOrNull(source.paymentProofPath);
  const isImport = source.origin === "IMPORT";
  const isGovernment = source.purchaseCategory === "GOVERNMENT";
  const showInvoice = source.hasInvoice !== false;
  const showDuties = isImport || source.hasCustomsFees === true;

  const slots: PurchaseDocumentSlot[] = [];

  if (isGovernment) {
    slots.push({
      kind: "government",
      titleKey: "pages.billing.governmentDocument",
      href: filePath,
    });
  } else if (isImport) {
    if (showInvoice) {
      slots.push({
        kind: "factory",
        titleKey: "pages.billing.purchaseFactoryInvoice",
        hintKey: "pages.billing.purchaseFactoryInvoiceHint",
        href: filePath,
      });
    }
    if (showDuties) {
      slots.push({
        kind: "duties",
        titleKey: "pages.billing.importDutiesDocument",
        hintKey: "pages.billing.importDutiesDocumentCreditHint",
        href: dutiesPath,
      });
    }
    if (source.hasHandling || handlingPath || taxPath) {
      slots.push({
        kind: "handling",
        titleKey: "pages.billing.handlingFeeInvoice",
        hintKey: "pages.billing.handlingFeeInvoiceHint",
        href: handlingPath,
      });
      slots.push({
        kind: "handlingTax",
        titleKey: "pages.billing.handlingFeeTaxInvoice",
        hintKey: "pages.billing.handlingFeeTaxInvoiceHint",
        href: taxPath,
      });
    }
  } else {
    if (showInvoice) {
      slots.push({
        kind: "invoice",
        titleKey: "pages.billing.purchaseInvoice",
        href: filePath,
      });
    }
    if (source.hasCustomsFees === true) {
      slots.push({
        kind: "duties",
        titleKey: "pages.billing.importDutiesDocument",
        hintKey: "pages.billing.importDutiesDocumentCreditHint",
        href: dutiesPath,
      });
    }
    if (source.purchaseCategory !== "PETTY_CASH" && showInvoice) {
      slots.push({
        kind: "tax",
        titleKey: "pages.billing.purchaseTaxInvoice",
        hintKey: "pages.billing.purchaseTaxInvoiceHint",
        href: taxPath,
      });
    }
  }

  slots.push({
    kind: "paymentProof",
    titleKey: "pages.billing.proofOfPayment",
    href: proofPath,
  });

  return slots;
}
