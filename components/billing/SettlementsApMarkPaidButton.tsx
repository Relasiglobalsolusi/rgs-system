"use client";

import { useState } from "react";
import { Banknote } from "lucide-react";

import PurchaseMarkPaidDialog from "@/components/billing/PurchaseMarkPaidDialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  purchaseInvoiceId: string;
  supplierName: string;
  invoiceRef: string;
};

export default function SettlementsApMarkPaidButton({
  purchaseInvoiceId,
  supplierName,
  invoiceRef,
}: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Banknote className="h-3.5 w-3.5" aria-hidden />
        {t("pages.billing.purchaseMarkPaid")}
      </Button>
      <PurchaseMarkPaidDialog
        open={open}
        onOpenChange={setOpen}
        purchaseInvoiceId={purchaseInvoiceId}
        supplierName={supplierName}
        invoiceRef={invoiceRef}
      />
    </>
  );
}
