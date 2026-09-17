"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";

import { financeToolbarPrimaryActionClass } from "@/components/billing/finance-toolbar";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";

export type ApBcaBillOption = {
  id: string;
  supplierName: string;
  invoiceRef: string;
  amountLabel: string;
};

const BULK_TRANSFER_BANKS = ["bca"] as const;

export default function ApBcaTransferDialog({
  bills,
}: {
  bills: ApBcaBillOption[];
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bank, setBank] = useState<(typeof BULK_TRANSFER_BANKS)[number]>("bca");
  const [error, setError] = useState<string | null>(null);

  const chosenIds = useMemo(
    () => Object.entries(selected).filter(([, on]) => on).map(([id]) => id),
    [selected]
  );

  function download() {
    setError(null);
    if (chosenIds.length === 0) {
      setError(t("pages.billing.apBcaSelectRequired"));
      return;
    }
    const params = new URLSearchParams({
      ids: chosenIds.join(","),
      bank,
    });
    window.location.href = `/api/billing/ap-bca-transfer?${params.toString()}`;
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(financeToolbarPrimaryActionClass, "gap-2")}
        >
          <FileSpreadsheet size={16} aria-hidden />
          {t("pages.billing.apBcaDownload")}
        </button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={FileSpreadsheet}
        title={t("pages.billing.apBcaTitle")}
        description={t("pages.billing.apBcaDesc")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton type="button" onClick={download}>
              {t("pages.billing.apBcaConfirm")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton onClick={() => setOpen(false)}>
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
          </div>
        }
      >
        {bills.length === 0 ? (
          <p className={employeeDialogHintClass}>{t("pages.billing.apBcaEmpty")}</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {bills.map((bill) => (
              <li key={bill.id}>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={Boolean(selected[bill.id])}
                    onChange={(event) =>
                      setSelected((current) => ({
                        ...current,
                        [bill.id]: event.target.checked,
                      }))
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{bill.supplierName}</span>
                    <span className="block text-xs text-muted">
                      {bill.invoiceRef} · {bill.amountLabel}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className={employeeDialogFieldClass}>
          <label className={employeeDialogLabelClass} htmlFor="ap-bulk-bank">
            {t("pages.billing.apBcaBank")}
          </label>
          <Select
            value={bank}
            onValueChange={(value) => {
              if (value === "bca") setBank(value);
            }}
          >
            <SelectTrigger
              id="ap-bulk-bank"
              className={employeeSelectTriggerClass}
            >
              <SelectValue>
                {t("pages.billing.apBcaBankBca")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BULK_TRANSFER_BANKS.map((id) => (
                <SelectItem key={id} value={id}>
                  {t("pages.billing.apBcaBankBca")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className={employeeDialogHintClass}>
            {t("pages.billing.apBcaBankHint")}
          </p>
        </div>
        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </EmployeeDialogShell>
    </Dialog>
  );
}
