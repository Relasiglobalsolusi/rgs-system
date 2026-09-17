"use client";

import { useEffect, useState, type FormEvent } from "react";
import { HandCoins } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  getCompanyCashAtHand,
  listTakeCashBankAccounts,
  takeCompanyCash,
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
import { Textarea } from "@/components/ui/textarea";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { todayDateInput } from "@/lib/project-contract";

export default function TakeCashDialog() {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(todayDateInput);
  const [note, setNote] = useState("");
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccountOption[]>(
    []
  );
  const [bankAccountId, setBankAccountId] = useState("");
  const [cashAtHand, setCashAtHand] = useState(0);

  function reset() {
    setError(null);
    setAmount("");
    setOccurredAt(todayDateInput());
    setNote("");
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
      await takeCompanyCash(formData);
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pages.billing.takeCashFailed")
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
          <HandCoins className="h-3.5 w-3.5" aria-hidden />
          {t("pages.billing.takeCash")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={HandCoins}
        title={t("pages.billing.takeCashTitle")}
        description={t("pages.billing.takeCashDesc")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="take-cash-form"
              disabled={pending}
            >
              {pending
                ? t("pages.billing.takeCashPending")
                : t("pages.billing.takeCashConfirm")}
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
          id="take-cash-form"
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
            <label htmlFor="take-cash-amount" className={employeeDialogLabelClass}>
              {t("pages.billing.takeCashAmount")}
              <span className="text-red-400"> *</span>
            </label>
            <MoneyInput
              id="take-cash-amount"
              name="amount"
              required
              disabled={pending}
              value={amount}
              onValueChange={setAmount}
              className={employeeInputClass}
            />
          </div>
          <div className={employeeDialogFieldClass}>
            <label htmlFor="take-cash-date" className={employeeDialogLabelClass}>
              {t("pages.billing.takeCashDate")}
              <span className="text-red-400"> *</span>
            </label>
            <Input
              id="take-cash-date"
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
            label={t("pages.billing.takeCashBank")}
            hint={t("pages.billing.takeCashBankHint")}
            disabled={pending}
          />
          <div className={employeeDialogFieldClass}>
            <label htmlFor="take-cash-note" className={employeeDialogLabelClass}>
              {t("pages.billing.takeCashNote")}
            </label>
            <Textarea
              id="take-cash-note"
              name="note"
              disabled={pending}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("pages.billing.takeCashNotePlaceholder")}
              className="min-h-20 rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-text shadow-none placeholder:text-subtle"
            />
            <p className={employeeDialogHintClass}>
              {t("pages.billing.takeCashNoteHint")}
            </p>
          </div>
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
