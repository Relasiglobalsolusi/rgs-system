"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";

import { reviewLeaveRequest } from "@/app/leaves/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  choiceGridClassForCount,
  employeeDialogFormClass,
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  type: string;
};

type DeductionChoice = "none" | "deduct";

export default function ApprovalActions({ id, type }: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [approveOpen, setApproveOpen] = useState(false);
  const [choice, setChoice] = useState<DeductionChoice>("none");
  const [deductAmount, setDeductAmount] = useState("");
  const isSick = type === "SICK";

  function resetApproveDialog() {
    setApproveOpen(false);
    setChoice("none");
    setDeductAmount("");
  }

  function handleReview(approved: boolean, amount?: number) {
    startTransition(async () => {
      try {
        await reviewLeaveRequest(
          id,
          approved,
          undefined,
          amount != null ? { deductAmount: amount } : undefined
        );
        resetApproveDialog();
      } catch (error) {
        showRejectionFromError(error, t("common.errors.generic"));
      }
    });
  }

  function handleApproveClick() {
    if (isSick) {
      setApproveOpen(true);
      return;
    }
    handleReview(true);
  }

  function handleConfirmApprove() {
    if (choice === "none") {
      handleReview(true);
      return;
    }
    const amount = Number(deductAmount.replace(/[^\d]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      showRejection({
        reasons: t("pages.leaves.errors.deductAmountRequired"),
      });
      return;
    }
    handleReview(true, amount);
  }

  return (
    <>
      <div className="flex items-center justify-center gap-2 whitespace-nowrap">
        <Button
          size="badgeFlex"
          variant="successBadge"
          disabled={pending}
          onClick={handleApproveClick}
        >
          {t("common.actions.approve")}
        </Button>
        <Button
          size="badgeFlex"
          variant="destructiveBadge"
          disabled={pending}
          onClick={() => handleReview(false)}
        >
          {t("common.actions.reject")}
        </Button>
      </div>

      {isSick ? (
        <Dialog
          open={approveOpen}
          onOpenChange={(open) => {
            if (pending) return;
            if (!open) {
              resetApproveDialog();
              return;
            }
            setApproveOpen(true);
          }}
        >
          <EmployeeDialogShell
            icon={Check}
            title={t("pages.approvals.approveSickTitle")}
            description={t("pages.approvals.approveSickDescription")}
            maxWidth="sm"
            footer={
              <div className="flex w-full flex-col gap-3">
                <EmployeePrimaryButton
                  type="button"
                  disabled={
                    pending || (choice === "deduct" && !deductAmount)
                  }
                  onClick={handleConfirmApprove}
                >
                  {pending
                    ? t("pages.leaves.saving")
                    : t("common.actions.approve")}
                </EmployeePrimaryButton>
                <EmployeeSecondaryButton
                  disabled={pending}
                  onClick={resetApproveDialog}
                >
                  {t("common.actions.cancel")}
                </EmployeeSecondaryButton>
              </div>
            }
          >
            <div className={employeeDialogFormClass}>
              <div className={employeeDialogFieldClass}>
                <span className={employeeDialogLabelClass}>
                  {t("pages.approvals.deductionChoice")}
                </span>
                <div className={choiceGridClassForCount(2)}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setChoice("none");
                      setDeductAmount("");
                    }}
                    className={cn(
                      "inline-flex min-h-8 items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold",
                      choice === "none"
                        ? outlineChipTones.emeraldInteractive
                        : "border border-border bg-elevated text-muted"
                    )}
                  >
                    {t("pages.approvals.noDeduction")}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setChoice("deduct")}
                    className={cn(
                      "inline-flex min-h-8 items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold",
                      choice === "deduct"
                        ? outlineChipTones.warningInteractive
                        : "border border-border bg-elevated text-muted"
                    )}
                  >
                    {t("pages.approvals.sickDeduct")}
                  </button>
                </div>
              </div>

              {choice === "deduct" ? (
                <div className={employeeDialogFieldClass}>
                  <label
                    htmlFor={`sick-deduct-${id}`}
                    className={employeeDialogLabelClass}
                  >
                    {t("pages.approvals.deductAmount")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <MoneyInput
                    id={`sick-deduct-${id}`}
                    required
                    disabled={pending}
                    value={deductAmount}
                    onValueChange={setDeductAmount}
                    className={employeeInputClass}
                  />
                  <p className={employeeDialogHintClass}>
                    {t("pages.approvals.deductHint")}
                  </p>
                </div>
              ) : (
                <p className={employeeDialogHintClass}>
                  {t("pages.approvals.noDeductionHint")}
                </p>
              )}
            </div>
          </EmployeeDialogShell>
        </Dialog>
      ) : null}
    </>
  );
}
