"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Scale } from "lucide-react";

import { reconcileInvoicePeriod } from "@/app/projects/invoice-actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { flexibleBadgeChipClassName } from "@/components/ui/trash-action-buttons";
import { formatContractPrice } from "@/lib/project-billing";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  periodId: string;
  periodLabel: string;
  suggestedAmount: number | null;
  disabled?: boolean;
};

export default function ReconcilePeriodDialog({
  periodId,
  periodLabel,
  suggestedAmount,
  disabled = false,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"keep" | "adjust">("keep");
  const [adjustedAmount, setAdjustedAmount] = useState(
    suggestedAmount != null ? String(Math.round(suggestedAmount)) : ""
  );

  function submit() {
    if (mode === "adjust") {
      const n = Number(adjustedAmount.replace(/[^\d.]/g, ""));
      if (!Number.isFinite(n) || n <= 0) {
        showRejection({
          reasons: t("pages.billing.adjustAmountInvalid"),
        });
        return;
      }
    }

    const formData = new FormData();
    formData.set("periodId", periodId);
    formData.set("amountMode", mode);
    if (mode === "adjust") {
      formData.set("adjustedAmount", adjustedAmount);
    }

    startTransition(async () => {
      try {
        await reconcileInvoicePeriod(formData);
        setOpen(false);
        router.refresh();
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.billing.reconcilePeriodFailed")
        );
      }
    });
  }

  return (
    <>
      <Button
        size="badge"
        variant="warningBadge"
        className={cn(flexibleBadgeChipClassName, "whitespace-normal")}
        disabled={disabled || pending}
        onClick={() => {
          setMode("keep");
          setAdjustedAmount(
            suggestedAmount != null ? String(Math.round(suggestedAmount)) : ""
          );
          setOpen(true);
        }}
      >
        {pending
          ? t("pages.billing.reconciling")
          : t("pages.billing.reconcile")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <EmployeeDialogShell
          icon={Scale}
          title={t("pages.billing.reconcileDialogTitle")}
          description={t("pages.billing.confirmReconcilePeriod", {
            label: periodLabel,
          })}
          maxWidth="md"
          footer={
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <EmployeeSecondaryButton
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                {t("common.actions.cancel")}
              </EmployeeSecondaryButton>
              <EmployeePrimaryButton
                type="button"
                disabled={pending}
                onClick={submit}
              >
                {pending
                  ? t("pages.billing.reconciling")
                  : mode === "adjust"
                    ? t("pages.billing.confirmReconcileAdjust")
                    : t("pages.billing.confirmReconcileKeep")}
              </EmployeePrimaryButton>
            </div>
          }
        >
          <div className={employeeDialogFormClass}>
            <p className="text-xs text-subtle">
              {t("pages.billing.reconcileAmountHelp")}
            </p>
            {suggestedAmount != null ? (
              <p className="text-sm text-muted">
                {t("pages.billing.contractPrice")}:{" "}
                <span className="font-medium text-text">
                  {formatContractPrice(suggestedAmount)}
                </span>
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "keep" ? "default" : "outline"}
                disabled={pending}
                onClick={() => setMode("keep")}
              >
                {t("pages.billing.keepAmount")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "adjust" ? "default" : "outline"}
                disabled={pending}
                onClick={() => setMode("adjust")}
              >
                {t("pages.billing.adjustAmount")}
              </Button>
            </div>

            {mode === "adjust" ? (
              <div className={employeeDialogFieldClass}>
                <label className="text-sm font-medium text-text">
                  {t("pages.billing.adjustAmountLabel")}
                </label>
                <Input
                  type="number"
                  min={1}
                  step="1"
                  value={adjustedAmount}
                  onChange={(e) => setAdjustedAmount(e.target.value)}
                  className={employeeInputClass}
                  required
                />
              </div>
            ) : null}
          </div>
        </EmployeeDialogShell>
      </Dialog>
    </>
  );
}
