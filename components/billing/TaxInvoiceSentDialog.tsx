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
import {
  DEFAULT_PRODUCT_PPN_RATE_PERCENT,
  parsePpnRatePercent,
} from "@/lib/vat";

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
  defaultPpnRatePercent,
  showWithholdingSlip,
  onSuccess,
}: Props) {
  const { t } = useT();
  const [taxFile, setTaxFile] = useState<File | null>(null);
  const [withholdingFile, setWithholdingFile] = useState<File | null>(null);
  const serialAssist = useTaxInvoiceSerialAssist(taxFile);
  const [ppnRatePercent, setPpnRatePercent] = useState(
    String(defaultPpnRatePercent ?? DEFAULT_PRODUCT_PPN_RATE_PERCENT)
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTaxFile(null);
      setWithholdingFile(null);
      setPpnRatePercent(
        String(defaultPpnRatePercent ?? DEFAULT_PRODUCT_PPN_RATE_PERCENT)
      );
      setPending(false);
      setError(null);
    }
  }, [open, defaultPpnRatePercent]);

  const parsedRate = parsePpnRatePercent(ppnRatePercent);
  const canSubmit = Boolean(taxFile && taxFile.size > 0 && parsedRate != null);

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
    if (parsedRate == null) {
      setError(t("pages.billing.purchasePpnRateRequired"));
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
      formData.set("ppnRatePercent", String(parsedRate));
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
      <div className="space-y-2">
        <label
          htmlFor={`tax-ppn-rate-${periodId}`}
          className="text-sm font-semibold text-text"
        >
          {t("pages.billing.purchasePpnRate")}
          <span className="text-red-400"> *</span>
        </label>
        <Input
          id={`tax-ppn-rate-${periodId}`}
          name="ppnRatePercent"
          inputMode="decimal"
          disabled={pending}
          value={ppnRatePercent}
          onChange={(event) => setPpnRatePercent(event.target.value)}
          placeholder={t("pages.billing.purchasePpnRatePlaceholder")}
        />
        <p className="text-xs text-muted">
          {t("pages.billing.outputPpnRateHint")}
        </p>
      </div>
    </BillingDocumentVerifyDialog>
  );
}
