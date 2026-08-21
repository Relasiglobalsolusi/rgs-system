"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import TaxInvoiceSentDialog from "@/components/billing/TaxInvoiceSentDialog";
import { Button } from "@/components/ui/button";
import { flexibleBadgeChipClassName } from "@/components/ui/trash-action-buttons";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  periodId: string;
  projectName: string;
  periodLabel: string;
};

export default function TaxInvoiceDoneButton({
  periodId,
  projectName,
  periodLabel,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant="successBadge"
        size="badge"
        onClick={() => setDialogOpen(true)}
        className={cn(flexibleBadgeChipClassName, "whitespace-normal")}
      >
        {t("pages.billing.markTaxDone")}
      </Button>

      <TaxInvoiceSentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        periodId={periodId}
        projectName={projectName}
        periodLabel={periodLabel}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
