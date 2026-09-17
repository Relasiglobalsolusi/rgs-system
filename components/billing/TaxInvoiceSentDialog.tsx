"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Receipt } from "lucide-react";

import { markTaxInvoiceDone } from "@/app/projects/invoice-actions";
import BillingDocumentVerifyDialog from "@/components/billing/BillingDocumentVerifyDialog";
import TaxInvoiceNumberFields, {
  useTaxInvoiceSerialAssist,
} from "@/components/billing/TaxInvoiceNumberFields";
import { FileDropField } from "@/components/ui/FileDropField";
import { Input } from "@/components/ui/input";
import { showMissingRequiredFields } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import { todayDateInput } from "@/lib/project-contract";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  projectName: string;
  periodLabel: string;
  /** Prefill from period when already stored; otherwise product default. */
  defaultPpnRatePercent?: number | null;
  showWithholdingSlip?: boolean;
  onSuccess: () => void;
};

export default function TaxInvoiceSentDialog({
  open,
  onOpenChange,
  periodId,
  projectName,
  periodLabel,
  showWithholdingSlip,
  onSuccess,
}: Props) {
  const { t } = useT();
  const [taxFile, setTaxFile] = useState<File | null>(null);
  const [withholdingFile, setWithholdingFile] = useState<File | null>(null);
  const serialAssist = useTaxInvoiceSerialAssist(taxFile);
  const [issuedAt, setIssuedAt] = useState(todayDateInput);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTaxFile(null);
      setWithholdingFile(null);
      setIssuedAt(todayDateInput());
      setPending(false);
      setError(null);
    }
  }, [open]);

  const canSubmit = Boolean(taxFile && taxFile.size > 0 && issuedAt);

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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedAt)) {
      setError(t("pages.billing.taxInvoiceIssuedAtRequired"));
      return;
    }
    if (
      showMissingRequiredFields(null, [
        ...(!serialAssist.serial.trim()
          ? [t("pages.vat.columns.taxInvoiceNumber")]
          : []),
        ...(!serialAssist.verified
          ? [t("pages.vat.taxInvoiceNumberVerify")]
          : []),
      ])
    ) {
      return;
    }

    setPending(true);
    try {
      const formData = new FormData();
      formData.set("periodId", periodId);
      formData.set("taxInvoiceDocument", taxFile);
      formData.set("taxInvoiceIssuedAt", issuedAt);
      formData.set("taxInvoiceSerial", serialAssist.serial);
      formData.set(
        "taxInvoiceSerialVerified",
        serialAssist.verified ? "true" : ""
      );
      if (withholdingFile) formData.set("withholdingSlip", withholdingFile);
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
      showServerBanner={false}
      error={error}
      pending={pending}
      canSubmit={canSubmit}
      confirmLabel={t("pages.billing.confirmTaxInvoiceSent")}
      pendingLabel={t("pages.billing.paymentVerifyChecking")}
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <label
          htmlFor={`tax-issued-at-${periodId}`}
          className="text-sm font-semibold text-text"
        >
          {t("pages.billing.taxInvoiceIssuedAt")}
          <span className="text-red-400"> *</span>
        </label>
        <Input
          id={`tax-issued-at-${periodId}`}
          type="date"
          disabled={pending}
          value={issuedAt}
          onChange={(event) => setIssuedAt(event.target.value)}
        />
        <p className="text-xs text-muted">
          {t("pages.billing.taxInvoiceIssuedAtHint")}
        </p>
      </div>
      <TaxInvoiceNumberFields
        id={`tax-serial-${periodId}`}
        serial={serialAssist.serial}
        onSerialChange={serialAssist.setSerial}
        verified={serialAssist.verified}
        onVerifiedChange={serialAssist.setVerified}
        detected={serialAssist.detected}
        reading={serialAssist.reading}
        disabled={pending}
      />
      {showWithholdingSlip ? (
        <FileDropField
          id={`withholding-slip-${periodId}`}
          label={t("pages.billing.withholdingSlip")}
          fileName={withholdingFile?.name ?? null}
          onPick={setWithholdingFile}
          accept="image/*,application/pdf"
        />
      ) : null}
      <p className="text-xs text-muted">{t("pages.taxRates.followsTable")}</p>
    </BillingDocumentVerifyDialog>
  );
}
