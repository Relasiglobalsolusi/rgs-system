"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FileText } from "lucide-react";

import BillingDocumentVerifyDialog from "@/components/billing/BillingDocumentVerifyDialog";
import { showMissingRequiredFields } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  fileLabel: string;
  contextValue: string;
  confirmLabel?: string;
  onUpload: (file: File) => Promise<void>;
};

export default function TaxSupportingDocumentDialog({
  open,
  onOpenChange,
  title,
  description,
  fileLabel,
  contextValue,
  confirmLabel,
  onUpload,
}: Props) {
  const { t } = useT();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPending(false);
      setError(null);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!file || file.size <= 0) {
      showMissingRequiredFields(null, [fileLabel]);
      return;
    }
    setPending(true);
    try {
      await onUpload(file);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("pages.billing.taxDocumentUploadFailed")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <BillingDocumentVerifyDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={FileText}
      title={title}
      description={description}
      contextLabel={t("pages.billing.documentVerifyContext")}
      contextValue={contextValue}
      fileInputId="tax-supporting-document"
      fileLabel={fileLabel}
      fileName={file?.name ?? null}
      onFilePick={setFile}
      showServerBanner={false}
      error={error}
      pending={pending}
      canSubmit={Boolean(file && file.size > 0)}
      confirmLabel={confirmLabel ?? t("common.actions.upload")}
      pendingLabel={t("pages.billing.paymentVerifyChecking")}
      onSubmit={handleSubmit}
    />
  );
}
