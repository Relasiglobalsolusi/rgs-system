"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";

import { reverseInventoryWriteOff } from "@/app/inventory/actions";
import type { InventoryWriteOffRow } from "@/components/inventory/inventory-types";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { formatInventoryQtyWithUnit } from "@/lib/inventory";
import { formatDisplayDate } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  target: InventoryWriteOffRow | null;
  onOpenChange: (open: boolean) => void;
};

export default function InventoryReverseWriteOffDialog({
  target,
  onOpenChange,
}: Props) {
  const { t } = useT();
  const [reverseReason, setReverseReason] = useState("");
  const [pending, startTransition] = useTransition();

  function closeDialog() {
    onOpenChange(false);
    setReverseReason("");
  }

  function submitReverse() {
    if (!target) return;

    const formData = new FormData();
    formData.set("id", target.id);
    if (reverseReason.trim()) {
      formData.set("reverseReason", reverseReason.trim());
    }

    startTransition(async () => {
      try {
        await reverseInventoryWriteOff(formData);
        toast.success(t("pages.inventory.writeOffReversed"));
        closeDialog();
      } catch (error) {
        showRejectionFromError(error, t("pages.inventory.reverseWriteOffFailed"));
      }
    });
  }

  return (
    <Dialog
      open={target != null}
      onOpenChange={(open) => {
        if (!open) closeDialog();
      }}
    >
      <EmployeeDialogShell
        icon={Undo2}
        title={t("pages.inventory.reverseWriteOffTitle")}
        description={t("pages.inventory.reverseWriteOffDesc")}
        maxWidth="md"
        footer={
          <>
            <EmployeeSecondaryButton onClick={closeDialog} disabled={pending}>
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
            <EmployeePrimaryButton
              type="button"
              onClick={submitReverse}
              disabled={pending}
            >
              {pending
                ? t("common.actions.saving")
                : t("pages.inventory.reverseWriteOffConfirm")}
            </EmployeePrimaryButton>
          </>
        }
      >
        {target ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text">
              <p className="font-medium">{target.item.name}</p>
              <p className="text-xs text-subtle">{target.item.sku}</p>
              <p className="mt-2">
                {formatInventoryQtyWithUnit(target.quantity, target.item.unit)}{" "}
                · {formatDisplayDate(target.movedAt)}
              </p>
              {target.reason ? (
                <p className="mt-1 text-subtle">{target.reason}</p>
              ) : null}
            </div>

            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass} htmlFor="reverse-reason">
                {t("pages.inventory.form.reverseWriteOffReason")}
              </label>
              <textarea
                id="reverse-reason"
                value={reverseReason}
                onChange={(event) => setReverseReason(event.target.value)}
                rows={3}
                placeholder={t("pages.inventory.form.reverseWriteOffReasonPlaceholder")}
                className={`${employeeInputClass} h-auto min-h-[4.5rem] py-3`}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.inventory.form.reverseWriteOffReasonHint")}
              </p>
            </div>
          </div>
        ) : null}
      </EmployeeDialogShell>
    </Dialog>
  );
}
