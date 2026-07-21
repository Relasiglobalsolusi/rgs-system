"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Banknote } from "lucide-react";

import { markInvoicePeriodPaid } from "@/app/projects/invoice-actions";
import BillingDocumentVerifyDialog from "@/components/billing/BillingDocumentVerifyDialog";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  projectName: string;
  movesToHistoryWhenFullyPaid?: boolean;
  onSuccess: (result: { movedToHistory: boolean }) => void;
};

export default function PaymentReceivedDialog({
  open,
  onOpenChange,
  periodId,
  projectName,
  movesToHistoryWhenFullyPaid = false,
  onSuccess,
}: Props) {
  const { t } = useT();
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setProofFile(null);
      setPending(false);
      setError(null);
    }
  }, [open]);

  const canSubmit = Boolean(proofFile && proofFile.size > 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!proofFile || proofFile.size <= 0) {
      setError(t("pages.billing.choosePaymentProof"));
      return;
    }

    setPending(true);
    try {
      const formData = new FormData();
      formData.set("periodId", periodId);
      formData.set("paymentProof", proofFile);
      const result = await markInvoicePeriodPaid(formData);
      onOpenChange(false);
      onSuccess(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("pages.billing.recordPaymentFailed")
      );
    } finally {
      setPending(false);
    }
  }

  const description = movesToHistoryWhenFullyPaid
    ? t("pages.billing.paymentReceivedDialogDescHistory")
    : t("pages.billing.paymentReceivedDialogDesc");

  return (
    <BillingDocumentVerifyDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Banknote}
      title={t("pages.billing.paymentReceivedDialogTitle")}
      description={description}
      contextLabel={t("pages.billing.documentVerifyContext")}
      contextValue={projectName}
      fileInputId={`payment-proof-${periodId}`}
      fileLabel={t("pages.billing.proofOfPayment")}
      fileName={proofFile?.name ?? null}
      onFilePick={setProofFile}
      callout={t("pages.billing.paymentVerifyHint")}
      error={error}
      pending={pending}
      canSubmit={canSubmit}
      confirmLabel={t("pages.billing.confirmPaymentReceived")}
      pendingLabel={t("pages.billing.paymentVerifyChecking")}
      onSubmit={handleSubmit}
    />
  );
}
