"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { uploadPeriodWithholdingSlip } from "@/app/projects/invoice-actions";
import TaxFileActions, {
  type TaxFileSlot,
} from "@/components/billing/TaxFileActions";
import TaxInvoiceSentDialog from "@/components/billing/TaxInvoiceSentDialog";
import TaxSupportingDocumentDialog from "@/components/billing/TaxSupportingDocumentDialog";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  periodId: string;
  projectName: string;
  periodLabel: string;
  files: TaxFileSlot[];
  canUpload: boolean;
  defaultPpnRatePercent?: number | null;
  showWithholdingSlip?: boolean;
};

export default function TaxPeriodDocumentsClient({
  periodId,
  projectName,
  periodLabel,
  files,
  canUpload,
  defaultPpnRatePercent,
  showWithholdingSlip,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [taxOpen, setTaxOpen] = useState(false);
  const [withholdingOpen, setWithholdingOpen] = useState(false);
  const displayLabel =
    periodLabel &&
    periodLabel !== t("pages.billing.billingPeriod") &&
    !projectName.includes(periodLabel)
      ? `${projectName} (${periodLabel})`
      : projectName;
  const slots = files.map((file) => ({
    ...file,
    canUpload: canUpload && !file.href,
  }));

  return (
    <>
      <TaxFileActions
        files={slots}
        onUpload={(file) => {
          if (file.id === "withholding-slip") {
            setWithholdingOpen(true);
            return;
          }
          setTaxOpen(true);
        }}
      />
      <TaxInvoiceSentDialog
        open={taxOpen}
        onOpenChange={setTaxOpen}
        periodId={periodId}
        projectName={projectName}
        periodLabel={periodLabel}
        defaultPpnRatePercent={defaultPpnRatePercent}
        showWithholdingSlip={
          showWithholdingSlip &&
          !files.some((file) => file.id === "withholding-slip" && file.href)
        }
        onSuccess={() => router.refresh()}
      />
      <TaxSupportingDocumentDialog
        open={withholdingOpen}
        onOpenChange={setWithholdingOpen}
        title={t("pages.billing.withholdingSlipUploadTitle")}
        description={t("pages.billing.withholdingSlipUploadDesc")}
        fileLabel={t("pages.billing.withholdingSlip")}
        contextValue={displayLabel}
        confirmLabel={t("common.actions.upload")}
        onUpload={async (file) => {
          const formData = new FormData();
          formData.set("periodId", periodId);
          formData.set("withholdingSlip", file);
          await uploadPeriodWithholdingSlip(formData);
          router.refresh();
        }}
      />
    </>
  );
}
