"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";

import { verifyInvoicePeriodPayment } from "@/app/projects/invoice-actions";
import BillingDocumentVerifyDialog from "@/components/billing/BillingDocumentVerifyDialog";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  projectName: string;
  onSuccess: (result: { movedToHistory: boolean }) => void;
};

export default function InHouseVerifyPaymentDialog({
  open,
  onOpenChange,
  periodId,
  projectName,
  onSuccess,
}: Props) {
  const { t } = useT();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason("");
      setPending(false);
      setError(null);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!reason.trim()) {
      setError(t("pages.billing.inHouseReasonRequired"));
      return;
    }

    setPending(true);
    try {
      const formData = new FormData();
      formData.set("periodId", periodId);
      formData.set("manualReason", reason);
      const result = await verifyInvoicePeriodPayment(formData);
      onOpenChange(false);
      onSuccess(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("pages.projects.verifyPaymentFailed")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <BillingDocumentVerifyDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={ShieldCheck}
      title={t("pages.billing.inHouseVerifyTitle")}
      description={t("pages.billing.inHouseVerifyDesc")}
      contextLabel={t("pages.billing.documentVerifyContext")}
      contextValue={projectName}
      showFilePick={false}
      requireReason
      reasonValue={reason}
      onReasonChange={setReason}
      error={error}
      pending={pending}
      canSubmit={Boolean(reason.trim())}
      confirmLabel={t("pages.billing.inHouseVerifyConfirm")}
      pendingLabel={t("common.actions.saving")}
      onSubmit={handleSubmit}
    />
  );
}
