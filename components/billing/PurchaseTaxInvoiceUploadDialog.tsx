"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Receipt } from "lucide-react";

import { uploadPurchaseTaxInvoice } from "@/app/billing/purchase-invoices/actions";
import BillingDocumentVerifyDialog from "@/components/billing/BillingDocumentVerifyDialog";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseInvoiceId: string;
  supplierName: string;
  invoiceRef: string;
};

export default function PurchaseTaxInvoiceUploadDialog({
  open,
  onOpenChange,
  purchaseInvoiceId,
  supplierName,
  invoiceRef,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [taxFile, setTaxFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTaxFile(null);
      setPending(false);
      setError(null);
    }
  }, [open]);

  const canSubmit = Boolean(taxFile && taxFile.size > 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!taxFile || taxFile.size <= 0) {
      setError(t("pages.billing.purchaseChooseTaxInvoice"));
      return;
    }

    const formData = new FormData();
    formData.set("purchaseInvoiceId", purchaseInvoiceId);
    formData.set("taxInvoiceDocument", taxFile);

    setPending(true);
    try {
      await uploadPurchaseTaxInvoice(formData);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("pages.billing.purchaseUploadTaxInvoiceFailed")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <BillingDocumentVerifyDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Receipt}
      title={t("pages.billing.purchaseUploadTaxInvoiceTitle")}
      description={t("pages.billing.purchaseUploadTaxInvoiceDesc")}
      contextLabel={t("pages.billing.documentVerifyContext")}
      contextValue={`${supplierName} · ${invoiceRef}`}
      fileInputId={`purchase-tax-${purchaseInvoiceId}`}
      fileLabel={t("pages.billing.purchaseTaxInvoice")}
      fileName={taxFile?.name ?? null}
      onFilePick={setTaxFile}
      callout={t("pages.billing.purchaseTaxInvoiceVerifyHint")}
      calloutIcon={FileText}
      error={error}
      pending={pending}
      canSubmit={canSubmit}
      confirmLabel={t("pages.billing.purchaseUploadTaxInvoiceConfirm")}
      pendingLabel={t("pages.billing.paymentVerifyChecking")}
      onSubmit={handleSubmit}
    />
  );
}
