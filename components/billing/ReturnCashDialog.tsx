"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Landmark } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  getCompanyCashAtHand,
  listTakeCashBankAccounts,
  returnCompanyCash,
} from "@/app/billing/cash-actions";
import CompanyBankAccountField from "@/components/company-details/CompanyBankAccountField";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { todayDateInput } from "@/lib/project-contract";

export default function ReturnCashDialog() {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(todayDateInput);
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccountOption[]>(
    []
  );
  const [bankAccountId, setBankAccountId] = useState("");
  const [cashAtHand, setCashAtHand] = useState(0);

  function reset() {
    setError(null);
    setAmount("");
    setOccurredAt(todayDateInput());
    setPending(false);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([listTakeCashBankAccounts(), getCompanyCashAtHand()])
      .then(([accounts, balance]) => {
        if (cancelled) return;
        setBankAccounts(accounts);
        setBankAccountId((current) => current || accounts[0]?.id || "");
        setCashAtHand(balance);
      })
      .catch(() => {
        if (cancelled) return;
        setBankAccounts([]);
        setCashAtHand(0);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("bankAccountId", bankAccountId);
    formData.set("amount", amount.trim());
    setPending(true);
    try {
      await returnCompanyCash(formData);
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pages.billing.returnCashAmountRequired")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="permissionsBadge" size="badgeFlex">
          <Landmark className="h-3.5 w-3.5" aria-hidden />
          {t("pages.billing.returnCash")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={Landmark}
        title={t("pages.billing.returnCashTitle")}
        description={t("pages.billing.returnCashDesc")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="return-cash-form"
              disabled={pending}
            >
              {t("pages.billing.returnCashConfirm")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
          </div>
        }
      >
        <form
          id="return-cash-form"
          onSubmit={handleSubmit}
          noValidate
          className={employeeDialogFormClass}
        >
          <p className={employeeDialogHintClass}>
            {t("pages.billing.takeCashBalance", {
              amount: formatContractPrice(cashAtHand),
            })}
          </p>
          <div className={employeeDialogFieldClass}>
            <label htmlFor="return-cash-amount" className={employeeDialogLabelClass}>
              {t("pages.billing.returnCashAmount")}
              <span className="text-red-400"> *</span>
            </label>
            <MoneyInput
              id="return-cash-amount"
              name="amount"
              required
              disabled={pending}
              value={amount}
              onValueChange={setAmount}
              className={employeeInputClass}
            />
          </div>
          <div className={employeeDialogFieldClass}>
            <label htmlFor="return-cash-date" className={employeeDialogLabelClass}>
              {t("pages.billing.returnCashDate")}
              <span className="text-red-400"> *</span>
            </label>
            <Input
              id="return-cash-date"
              name="occurredAt"
              type="date"
              required
              disabled={pending}
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              className={employeeInputClass}
            />
          </div>
          <CompanyBankAccountField
            accounts={bankAccounts}
            value={bankAccountId}
            onChange={setBankAccountId}
            label={t("pages.billing.returnCashBank")}
            disabled={pending}
          />
          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
