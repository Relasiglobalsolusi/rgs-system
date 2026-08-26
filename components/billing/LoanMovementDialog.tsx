"use client";

import { useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  recordLoanDrawAction,
  recordLoanRepaymentAction,
} from "@/app/billing/loans/actions";
import { BillingDocumentFilePick } from "@/components/billing/BillingDocumentVerifyDialog";
import CompanyBankAccountField from "@/components/company-details/CompanyBankAccountField";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
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
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Textarea } from "@/components/ui/textarea";
import { formatDisplayDate } from "@/lib/format-date";
import type { LoanFacilitySnapshot } from "@/lib/loan-facility-query";
import { closingStandbySlicePreview } from "@/lib/loan-interest";
import { showMissingRequiredFields } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { todayDateInput } from "@/lib/project-contract";
import { cn } from "@/lib/utils";

type Mode = "DRAW" | "RETURN_PRINCIPAL";

export default function LoanMovementDialog({
  mode,
  facility,
  bankAccounts,
}: {
  mode: Mode;
  facility: LoanFacilitySnapshot;
  bankAccounts: CompanyBankAccountOption[];
}) {
  const { t } = useT();
  const router = useRouter();
  const isDraw = mode === "DRAW";
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [movementDate, setMovementDate] = useState(todayDateInput);
  const [invoiceRef, setInvoiceRef] = useState("");
  const [notes, setNotes] = useState("");
  const [transferFee, setTransferFee] = useState("");
  const [bankAccountId, setBankAccountId] = useState(
    facility.bankAccountId ?? bankAccounts[0]?.id ?? ""
  );
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const closingSlice =
    mode === "RETURN_PRINCIPAL" && facility.kind === "STANDBY"
      ? closingStandbySlicePreview({
          sliceFrom:
            facility.usageSlices.find((row) => row.open)?.from ??
            facility.startDate,
          returnDate: /^\d{4}-\d{2}-\d{2}$/.test(movementDate)
            ? movementDate
            : facility.startDate,
          outstanding: facility.outstanding,
          ratePercent: facility.annualRatePercent,
          basis: facility.interestRateBasis,
          chargesInterest: facility.chargesInterest,
          dayCountYear: facility.dayCountYear,
        })
      : null;

  function reset() {
    setError(null);
    setAmount("");
    setMovementDate(todayDateInput());
    setInvoiceRef("");
    setNotes("");
    setTransferFee("");
    setBankAccountId(facility.bankAccountId ?? bankAccounts[0]?.id ?? "");
    setDocumentFile(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const extraMissing: string[] = [];
    if (!isDraw && (!documentFile || documentFile.size === 0)) {
      extraMissing.push(t("pages.loans.proof"));
    }
    if (showMissingRequiredFields(event.currentTarget, extraMissing)) {
      return;
    }
    const formData = new FormData(event.currentTarget);
    formData.set("facilityId", facility.id);
    formData.set("bankAccountId", bankAccountId);
    if (mode === "RETURN_PRINCIPAL") {
      formData.set("standbyPaymentKind", "PRINCIPAL");
    }
    if (documentFile) formData.set("document", documentFile);
    setPending(true);
    try {
      if (isDraw) {
        await recordLoanDrawAction(formData);
      } else {
        await recordLoanRepaymentAction(formData);
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.loans.failed"));
    } finally {
      setPending(false);
    }
  }

  const Icon = isDraw ? ArrowDownLeft : ArrowUpRight;

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
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {isDraw
            ? t("pages.loans.recordDraw")
            : t("pages.loans.recordReturn")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={Icon}
        title={
          isDraw
            ? t("pages.loans.recordDrawTitle")
            : t("pages.loans.recordReturnTitle")
        }
        description={
          isDraw
            ? t("pages.loans.recordDrawDesc")
            : t("pages.loans.recordReturnDesc")
        }
        maxWidth="lg"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form={`loan-movement-${mode}-form`}
              disabled={pending || !amount.trim() || (!isDraw && !documentFile)}
            >
              {pending
                ? t("pages.loans.saving")
                : isDraw
                  ? t("pages.loans.recordDrawConfirm")
                  : t("pages.loans.recordReturnConfirm")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        }
      >
        <form
          id={`loan-movement-${mode}-form`}
          className={employeeDialogFormClass}
          onSubmit={handleSubmit}
        >
          <div className={employeeDialogGridClass}>
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <p className="text-sm text-text">
                {t("pages.billing.loanOutstanding")}:{" "}
                <span className="font-semibold tabular-nums">
                  {formatContractPrice(facility.outstanding)}
                </span>
              </p>
              {closingSlice ? (
                <div className="mt-2">
                  <p className="text-sm text-text">
                    {t("pages.loans.recordReturnSliceInterest")}:{" "}
                    <span className="font-semibold tabular-nums">
                      {formatContractPrice(closingSlice.interest)}
                    </span>
                  </p>
                  <p className={cn(employeeDialogHintClass, "mt-1")}>
                    {t("pages.loans.recordReturnSliceRange", {
                      from: formatDisplayDate(closingSlice.from, {
                        timeZone: "UTC",
                      }),
                      to: formatDisplayDate(closingSlice.to, {
                        timeZone: "UTC",
                      }),
                      days: closingSlice.days,
                    })}
                  </p>
                  <p className={cn(employeeDialogHintClass, "mt-1")}>
                    {t("pages.loans.recordReturnSliceHint")}
                  </p>
                </div>
              ) : null}
            </div>

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                htmlFor={`loan-amount-${mode}`}
                className={employeeDialogLabelClass}
              >
                {isDraw
                  ? t("pages.billing.bankLoanDrawnAmount")
                  : t("pages.billing.loanPrincipalReturned")}
                <span className="text-red-400"> *</span>
              </label>
              <MoneyInput
                id={`loan-amount-${mode}`}
                name="amount"
                required
                disabled={pending}
                value={amount}
                onValueChange={setAmount}
                className={employeeInputClass}
              />
            </div>

            <div className={employeeDialogFieldClass}>
              <label
                htmlFor={`loan-date-${mode}`}
                className={employeeDialogLabelClass}
              >
                {t("pages.loans.startDate")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                id={`loan-date-${mode}`}
                name="movementDate"
                type="date"
                required
                disabled={pending}
                value={movementDate}
                onChange={(event) => setMovementDate(event.target.value)}
                className={employeeInputClass}
              />
            </div>

            {!isDraw && facility.source !== "SHAREHOLDER" ? (
              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor={`loan-ref-${mode}`}
                  className={employeeDialogLabelClass}
                >
                  {t("pages.loans.reference")}
                  <span className="text-red-400"> *</span>
                </label>
                <Input
                  id={`loan-ref-${mode}`}
                  name="invoiceRef"
                  required
                  disabled={pending}
                  value={invoiceRef}
                  onChange={(event) => setInvoiceRef(event.target.value)}
                  placeholder={t("pages.loans.referencePlaceholder")}
                  className={employeeInputClass}
                />
              </div>
            ) : null}

            <CompanyBankAccountField
              className="sm:col-span-2"
              accounts={bankAccounts}
              value={bankAccountId}
              onChange={setBankAccountId}
              label={t("pages.loans.bankAccount")}
              hint={t("pages.loans.bankAccountHint")}
              disabled={pending}
            />

            {!isDraw ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label
                  htmlFor={`loan-fee-${mode}`}
                  className={employeeDialogLabelClass}
                >
                  {t("pages.billing.purchaseTransferFee")}
                </label>
                <MoneyInput
                  id={`loan-fee-${mode}`}
                  name="transferFeeIdr"
                  disabled={pending}
                  value={transferFee}
                  onValueChange={setTransferFee}
                  placeholder={t("pages.billing.purchaseTransferFeePlaceholder")}
                  className={employeeInputClass}
                />
              </div>
            ) : null}

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <BillingDocumentFilePick
                id={`loan-proof-${mode}`}
                label={t("pages.loans.proof")}
                required={!isDraw}
                fileName={documentFile?.name ?? null}
                onPick={setDocumentFile}
                disabled={pending}
              />
            </div>

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                htmlFor={`loan-notes-${mode}`}
                className={employeeDialogLabelClass}
              >
                {t("pages.loans.notes")}
              </label>
              <Textarea
                id={`loan-notes-${mode}`}
                name="notes"
                disabled={pending}
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t("pages.loans.notesPlaceholder")}
                className="min-h-[4.5rem] rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-text shadow-none placeholder:text-subtle"
              />
            </div>
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
