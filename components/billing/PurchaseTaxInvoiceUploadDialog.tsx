"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";

import { uploadPurchaseTaxInvoice } from "@/app/billing/purchase-invoices/actions";
import BillingDocumentVerifyDialog from "@/components/billing/BillingDocumentVerifyDialog";
import { showMissingRequiredFields } from "@/components/ui/rejection-notice";
import TaxInvoiceNumberFields, {
  useTaxInvoiceSerialAssist,
} from "@/components/billing/TaxInvoiceNumberFields";
import { FileDropField } from "@/components/ui/FileDropField";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseInvoiceId: string;
  supplierName: string;
  invoiceRef: string;
  showWithholdingSlip?: boolean;
};

export default function PurchaseTaxInvoiceUploadDialog({
  open,
  onOpenChange,
  purchaseInvoiceId,
  supplierName,
  invoiceRef,
  showWithholdingSlip,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [taxFile, setTaxFile] = useState<File | null>(null);
  const [withholdingFile, setWithholdingFile] = useState<File | null>(null);
  const serialAssist = useTaxInvoiceSerialAssist(taxFile);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTaxFile(null);
      setWithholdingFile(null);
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

    const formData = new FormData();
    formData.set("purchaseInvoiceId", purchaseInvoiceId);
    formData.set("taxInvoiceDocument", taxFile);
    formData.set("taxInvoiceSerial", serialAssist.serial);
    formData.set(
      "taxInvoiceSerialVerified",
      serialAssist.verified ? "true" : ""
    );
    if (withholdingFile) formData.set("withholdingSlip", withholdingFile);

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
      showServerBanner={false}
      error={error}
      pending={pending}
      canSubmit={canSubmit}
      confirmLabel={t("pages.billing.purchaseUploadTaxInvoiceConfirm")}
      pendingLabel={t("pages.billing.paymentVerifyChecking")}
      onSubmit={handleSubmit}
    >
      <TaxInvoiceNumberFields
        id={`purchase-tax-serial-${purchaseInvoiceId}`}
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
          id={`purchase-withholding-${purchaseInvoiceId}`}
          label={t("pages.billing.withholdingSlip")}
          fileName={withholdingFile?.name ?? null}
          onPick={setWithholdingFile}
          accept="image/*,application/pdf"
        />
      ) : null}
    </BillingDocumentVerifyDialog>
  );
}
