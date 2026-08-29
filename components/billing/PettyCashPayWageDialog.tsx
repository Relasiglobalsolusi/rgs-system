"use client";

import { useState, type FormEvent } from "react";
import { Banknote } from "lucide-react";
import { useRouter } from "next/navigation";

import { payPartTimeWage } from "@/app/billing/petty-cash/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogGridClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showMissingRequiredFields } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import type { UnpaidPartTimeWageView } from "@/lib/petty-cash-query";
import { formatContractPrice } from "@/lib/project-billing";
import { cn } from "@/lib/utils";

type EmployeeOption = {
  id: string;
  name: string;
};

export default function PettyCashPayWageDialog({
  open,
  onOpenChange,
  wage,
  employees,
  preferredPayerId = null,
  preferredPayerName = null,
  preferredPayerBalance = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wage: UnpaidPartTimeWageView | null;
  employees: EmployeeOption[];
  preferredPayerId?: string | null;
  preferredPayerName?: string | null;
  preferredPayerBalance?: number | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holderEmployeeId, setHolderEmployeeId] = useState(
    preferredPayerId ?? ""
  );

  const lockPayer = Boolean(preferredPayerId);
  const payerOptions = employees.filter(
    (employee) => employee.id !== wage?.employeeId
  );

  function reset() {
    setError(null);
    setHolderEmployeeId(preferredPayerId ?? "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!wage) return;
    setError(null);
    const payerId = lockPayer ? preferredPayerId : holderEmployeeId;
    const extraMissing: string[] = [];
    if (!payerId) extraMissing.push(t("pages.pettyCash.unpaidWagePayerRequired"));
    if (showMissingRequiredFields(event.currentTarget, extraMissing)) return;

    const formData = new FormData();
    formData.set("entryId", wage.id);
    if (payerId) formData.set("holderEmployeeId", payerId);

    setPending(true);
    try {
      await payPartTimeWage(formData);
      reset();
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pages.pettyCash.unpaidWageFailed")
      );
    } finally {
      setPending(false);
    }
  }

  const payerName = preferredPayerName ?? "";
  const payerBalance =
    preferredPayerBalance == null
      ? null
      : formatContractPrice(preferredPayerBalance);

  return (
    <Dialog
      open={open && Boolean(wage)}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <EmployeeDialogShell
        icon={Banknote}
        title={t("pages.pettyCash.unpaidWagePayTitle")}
        description={
          wage
            ? t("pages.pettyCash.unpaidWagePayDesc", {
                name: wage.employeeName,
                amount: formatContractPrice(wage.amount),
              })
            : ""
        }
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="petty-cash-pay-wage-form"
              disabled={pending || !wage}
            >
              {pending
                ? t("pages.pettyCash.spending")
                : t("pages.pettyCash.unpaidWagePay")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
          </div>
        }
      >
        <form
          id="petty-cash-pay-wage-form"
          onSubmit={handleSubmit}
          noValidate
          className={employeeDialogFormClass}
        >
          <div className={employeeDialogGridClass}>
            {lockPayer ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <p className={employeeDialogHintClass}>
                  {t("pages.pettyCash.unpaidWagePayerLockedHint", {
                    name: payerName,
                    amount: payerBalance ?? "",
                  })}
                </p>
                {preferredPayerBalance != null &&
                wage &&
                preferredPayerBalance < wage.amount ? (
                  <p className="text-sm text-danger">
                    {t("pages.pettyCash.unpaidWageNegativeWarning")}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.pettyCash.unpaidWagePayer")}
                  <span className="text-red-400"> *</span>
                </label>
                <Select
                  value={holderEmployeeId || undefined}
                  onValueChange={(value) => setHolderEmployeeId(value ?? "")}
                  disabled={pending}
                >
                  <SelectTrigger className={employeeSelectTriggerClass}>
                    <SelectValue
                      placeholder={t("pages.pettyCash.unpaidWagePayerPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {payerOptions.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className={employeeDialogHintClass}>
                  {t("pages.pettyCash.unpaidWagePayerHint")}
                </p>
              </div>
            )}
            {error ? (
              <p className="sm:col-span-2 text-sm text-danger">{error}</p>
            ) : null}
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
