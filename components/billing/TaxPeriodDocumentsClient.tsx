"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import TaxFileActions, {
  type TaxFileSlot,
} from "@/components/billing/TaxFileActions";
import TaxInvoiceSentDialog from "@/components/billing/TaxInvoiceSentDialog";

type Props = {
  periodId: string;
  projectName: string;
  periodLabel: string;
  files: TaxFileSlot[];
  canUpload: boolean;
  defaultPpnRatePercent?: number | null;
};

export default function TaxPeriodDocumentsClient({
  periodId,
  projectName,
  periodLabel,
  files,
  canUpload,
  defaultPpnRatePercent,
}: Props) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <>
      <TaxFileActions
        files={files}
        showUpload={canUpload && files.some((file) => !file.href)}
        onUpload={() => setUploadOpen(true)}
      />
      <TaxInvoiceSentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        periodId={periodId}
        projectName={projectName}
        periodLabel={periodLabel}
        defaultPpnRatePercent={defaultPpnRatePercent}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
