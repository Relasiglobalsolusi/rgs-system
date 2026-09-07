"use client";

import { useState, useTransition } from "react";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";

import { addPayrollDeduction } from "@/app/billing/payroll-actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  year: number;
  month: number;
};

export default function PayrollOvertimeDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  year,
  month,
}: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  function reset() {
    setAmount("");
    setReason("");
  }

  function submit() {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("employeeId", employeeId);
        formData.set("year", String(year));
        formData.set("month", String(month));
        formData.set("type", "OVERTIME");
        formData.set("amount", amount);
        formData.set("reason", reason);
        await addPayrollDeduction(formData);
        toast.success(t("pages.payroll.overtimeSaved"));
        reset();
        onOpenChange(false);
      } catch (error) {
        showRejectionFromError(error, t("pages.payroll.errors.saveFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={PlusCircle}
        title={t("pages.payroll.addOvertime")}
        description={t("pages.payroll.addOvertimeDesc", { name: employeeName })}
        maxWidth="md"
        footer={
          <EmployeePrimaryButton
            type="button"
            disabled={pending}
            onClick={submit}
          >
            {pending ? t("common.actions.saving") : t("pages.payroll.saveOvertime")}
          </EmployeePrimaryButton>
        }
      >
        <div className="flex flex-col gap-5">
          <div className={employeeDialogFieldClass}>
            <label className="text-sm font-semibold text-text">
              {t("pages.payroll.deductionAmount")}
            </label>
            <MoneyInput
              className={employeeInputClass}
              value={amount}
              onValueChange={setAmount}
              placeholder="0"
            />
            <p className={employeeDialogHintClass}>
              {t("pages.payroll.overtimeAmountHint")}
            </p>
          </div>

          <div className={employeeDialogFieldClass}>
            <label className="text-sm font-semibold text-text">
              {t("pages.payroll.deductionReason")}
            </label>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
            />
          </div>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
