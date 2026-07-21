"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import TaxInvoiceSentDialog from "@/components/billing/TaxInvoiceSentDialog";
import { Button } from "@/components/ui/button";
import { StackedChipLabel } from "@/components/ui/StatusBadge";
import { flexibleBadgeChipClassName } from "@/components/ui/trash-action-buttons";
import { localizeBillingChipLines } from "@/lib/i18n/labels";
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
  const { t, locale } = useT();
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
        <StackedChipLabel
          lines={localizeBillingChipLines("taxInvoiceDone", locale)}
        />
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
