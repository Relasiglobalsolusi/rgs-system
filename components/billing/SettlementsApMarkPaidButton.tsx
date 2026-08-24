"use client";

import { useState } from "react";
import { Banknote } from "lucide-react";

import PurchaseMarkPaidDialog from "@/components/billing/PurchaseMarkPaidDialog";
import { Button } from "@/components/ui/button";
import { financeListStatusChipClassName } from "@/components/ui/FinanceRecordRow";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  purchaseInvoiceId: string;
  supplierName: string;
  invoiceRef: string;
  needsImportBankRate?: boolean;
  invoiceCurrency?: string | null;
  invoiceForeignAmount?: number | null;
  bookingRate?: number | null;
};

export default function SettlementsApMarkPaidButton({
  purchaseInvoiceId,
  supplierName,
  invoiceRef,
  needsImportBankRate = false,
  invoiceCurrency = null,
  invoiceForeignAmount = null,
  bookingRate = null,
}: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="success"
        className={cn(financeListStatusChipClassName, "gap-1.5")}
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
        needsImportBankRate={needsImportBankRate}
        invoiceCurrency={invoiceCurrency}
        invoiceForeignAmount={invoiceForeignAmount}
        bookingRate={bookingRate}
      />
    </>
  );
}
