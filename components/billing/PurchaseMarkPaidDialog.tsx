"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";

import { markPurchaseInvoicePaid } from "@/app/billing/purchase-invoices/actions";
import BillingDocumentVerifyDialog from "@/components/billing/BillingDocumentVerifyDialog";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseInvoiceId: string;
  supplierName: string;
  invoiceRef: string;
  onSuccess?: () => void;
};

export default function PurchaseMarkPaidDialog({
  open,
  onOpenChange,
  purchaseInvoiceId,
  supplierName,
  invoiceRef,
  onSuccess,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setProofFile(null);
      setReason("");
      setPending(false);
      setError(null);
    }
  }, [open]);

  const canSubmit = Boolean(proofFile && proofFile.size > 0 && reason.trim());

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!proofFile || proofFile.size <= 0) {
      setError(t("pages.billing.choosePaymentProof"));
      return;
    }

    const formData = new FormData();
    formData.set("purchaseInvoiceId", purchaseInvoiceId);
    formData.set("paymentProof", proofFile);
    formData.set("manualReason", reason);

    setPending(true);
    try {
      await markPurchaseInvoicePaid(formData);
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("pages.billing.purchaseMarkPaidFailed")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <BillingDocumentVerifyDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Banknote}
      title={t("pages.billing.purchaseMarkPaidTitle")}
      description={t("pages.billing.purchaseMarkPaidDesc")}
      contextLabel={t("pages.billing.documentVerifyContext")}
      contextValue={`${supplierName} · ${invoiceRef}`}
      fileInputId={`purchase-paid-${purchaseInvoiceId}`}
      fileLabel={t("pages.billing.proofOfPayment")}
      fileName={proofFile?.name ?? null}
      onFilePick={setProofFile}
      requireReason
      reasonValue={reason}
      onReasonChange={setReason}
      callout={t("pages.billing.purchaseMarkPaidHint")}
      error={error}
      pending={pending}
      canSubmit={canSubmit}
      confirmLabel={t("pages.billing.purchaseMarkPaidConfirm")}
      pendingLabel={t("pages.billing.purchaseMarkPaidPending")}
      onSubmit={handleSubmit}
    />
  );
}
