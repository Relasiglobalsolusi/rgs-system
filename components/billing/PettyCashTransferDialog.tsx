"use client";

import { useState, type FormEvent } from "react";
import { ArrowRightLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { transferPettyCash } from "@/app/billing/petty-cash/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogGridClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showMissingRequiredFields } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import { todayDateInput } from "@/lib/project-contract";
import { formatContractPrice } from "@/lib/project-billing";
import { cn } from "@/lib/utils";

type EmployeeOption = {
  id: string;
  name: string;
};

export default function PettyCashTransferDialog({
  open,
  onOpenChange,
  fromEmployeeId,
  fromName,
  fromBalance,
  employees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromEmployeeId: string;
  fromName: string;
  fromBalance: number;
  employees: EmployeeOption[];
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toEmployeeId, setToEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayDateInput());
  const [note, setNote] = useState("");
  const typedAmount = Number(amount.replace(/[^\d]/g, ""));

  function reset() {
    setError(null);
    setToEmployeeId("");
    setAmount("");
    setEntryDate(todayDateInput());
    setNote("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const extraMissing: string[] = [];
    if (!toEmployeeId) extraMissing.push(t("pages.pettyCash.transferToRequired"));
    if (showMissingRequiredFields(event.currentTarget, extraMissing)) return;
    if (!toEmployeeId) return;

    const formData = new FormData();
    formData.set("fromEmployeeId", fromEmployeeId);
    formData.set("toEmployeeId", toEmployeeId);
    formData.set("amount", String(Math.round(typedAmount)));
    formData.set("entryDate", entryDate);
    formData.set("description", note.trim());

    setPending(true);
    try {
      await transferPettyCash(formData);
      reset();
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pages.pettyCash.transferFailed")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <EmployeeDialogShell
        icon={ArrowRightLeft}
        title={t("pages.pettyCash.transferTitle")}
        description={t("pages.pettyCash.transferDesc", {
          name: fromName,
          amount: formatContractPrice(fromBalance),
        })}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="petty-cash-transfer-form"
              disabled={pending}
            >
              {pending
                ? t("pages.pettyCash.spending")
                : t("pages.pettyCash.transferConfirm")}
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
          id="petty-cash-transfer-form"
          onSubmit={handleSubmit}
          noValidate
          className={employeeDialogFormClass}
        >
          <div className={employeeDialogGridClass}>
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label className={employeeDialogLabelClass}>
                {t("pages.pettyCash.transferTo")}
                <span className="text-red-400"> *</span>
              </label>
              <Select
                value={toEmployeeId || undefined}
                onValueChange={(value) => setToEmployeeId(value ?? "")}
                disabled={pending}
              >
                <SelectTrigger className={employeeSelectTriggerClass}>
                  <SelectValue
                    placeholder={t("pages.pettyCash.transferToPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter((employee) => employee.id !== fromEmployeeId)
                    .map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.pettyCash.enteredAmount")}
                <span className="text-red-400"> *</span>
              </label>
              <MoneyInput
                required
                disabled={pending}
                value={amount}
                onValueChange={setAmount}
                placeholder={t("pages.pettyCash.amountPlaceholder")}
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.pettyCash.date")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                type="date"
                required
                disabled={pending}
                value={entryDate}
                onChange={(event) => setEntryDate(event.target.value)}
                className={employeeInputClass}
              />
            </div>
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label className={employeeDialogLabelClass}>
                {t("pages.pettyCash.transferNote")}
              </label>
              <Input
                disabled={pending}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("pages.pettyCash.transferNotePlaceholder")}
                className={employeeInputClass}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.pettyCash.transferHint")}
              </p>
            </div>
            {error ? (
              <p className="sm:col-span-2 text-sm text-danger">{error}</p>
            ) : null}
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
