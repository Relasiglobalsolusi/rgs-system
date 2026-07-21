"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Receipt } from "lucide-react";

import { markTaxInvoiceDone } from "@/app/projects/invoice-actions";
import BillingDocumentVerifyDialog from "@/components/billing/BillingDocumentVerifyDialog";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  projectName: string;
  periodLabel: string;
  onSuccess: () => void;
};

export default function TaxInvoiceSentDialog({
  open,
  onOpenChange,
  periodId,
  projectName,
  periodLabel,
  onSuccess,
}: Props) {
  const { t } = useT();
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

  const displayLabel =
    periodLabel &&
    periodLabel !== t("pages.billing.billingPeriod") &&
    !projectName.includes(periodLabel)
      ? `${projectName} (${periodLabel})`
      : projectName;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!taxFile || taxFile.size <= 0) {
      setError(t("pages.billing.chooseTaxInvoiceDocument"));
      return;
    }

    setPending(true);
    try {
      const formData = new FormData();
      formData.set("periodId", periodId);
      formData.set("taxInvoiceDocument", taxFile);
      await markTaxInvoiceDone(formData);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("pages.billing.markTaxSentFailed")
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
      title={t("pages.billing.taxInvoiceSentDialogTitle")}
      description={t("pages.billing.taxInvoiceSentDialogDesc")}
      contextLabel={t("pages.billing.documentVerifyContext")}
      contextValue={displayLabel}
      fileInputId={`tax-invoice-${periodId}`}
      fileLabel={t("pages.billing.taxInvoiceDocument")}
      fileName={taxFile?.name ?? null}
      onFilePick={setTaxFile}
      callout={t("pages.billing.taxInvoiceVerifyHint")}
      error={error}
      pending={pending}
      canSubmit={canSubmit}
      confirmLabel={t("pages.billing.confirmTaxInvoiceSent")}
      pendingLabel={t("pages.billing.paymentVerifyChecking")}
      onSubmit={handleSubmit}
    />
  );
}
