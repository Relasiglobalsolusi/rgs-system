"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { uploadPurchaseTaxDocument } from "@/app/billing/purchase-invoices/actions";
import PurchaseTaxInvoiceUploadDialog from "@/components/billing/PurchaseTaxInvoiceUploadDialog";
import TaxFileActions, {
  type TaxFileSlot,
} from "@/components/billing/TaxFileActions";
import TaxSupportingDocumentDialog from "@/components/billing/TaxSupportingDocumentDialog";
import { useT } from "@/lib/i18n/use-t";

type UploadSlot = "tax" | "withholding" | "government" | "duties";

function isUploadSlot(id: string): id is UploadSlot {
  return (
    id === "tax" ||
    id === "withholding" ||
    id === "government" ||
    id === "duties"
  );
}

type Props = {
  purchaseInvoiceId: string;
  supplierName: string;
  invoiceRef: string;
  files: TaxFileSlot[];
  showWithholdingSlip?: boolean;
};

export default function PurchaseTaxDocumentsClient({
  purchaseInvoiceId,
  supplierName,
  invoiceRef,
  files,
  showWithholdingSlip,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [slot, setSlot] = useState<UploadSlot | null>(null);
  const contextValue = `${supplierName} · ${invoiceRef}`;

  const activeFile = files.find((file) => file.id === slot);

  return (
    <>
      <TaxFileActions
        files={files}
        onUpload={(file) => {
          if (isUploadSlot(file.id)) setSlot(file.id);
        }}
      />
      <PurchaseTaxInvoiceUploadDialog
        open={slot === "tax"}
        onOpenChange={(open) => {
          if (!open) setSlot(null);
        }}
        purchaseInvoiceId={purchaseInvoiceId}
        supplierName={supplierName}
        invoiceRef={invoiceRef}
        showWithholdingSlip={showWithholdingSlip}
      />
      <TaxSupportingDocumentDialog
        open={slot != null && slot !== "tax"}
        onOpenChange={(open) => {
          if (!open) setSlot(null);
        }}
        title={
          slot === "withholding"
            ? t("pages.billing.withholdingSlipUploadTitle")
            : t("pages.billing.taxDocumentUploadTitle")
        }
        description={
          slot === "withholding"
            ? t("pages.billing.withholdingSlipUploadDesc")
            : t("pages.billing.taxDocumentUploadDesc")
        }
        fileLabel={activeFile?.title ?? t("pages.vat.supportingTaxDocument")}
        contextValue={contextValue}
        confirmLabel={t("common.actions.upload")}
        onUpload={async (file) => {
          if (!slot || slot === "tax") return;
          const formData = new FormData();
          formData.set("purchaseInvoiceId", purchaseInvoiceId);
          formData.set("slot", slot);
          formData.set("document", file);
          await uploadPurchaseTaxDocument(formData);
          router.refresh();
        }}
      />
    </>
  );
}
