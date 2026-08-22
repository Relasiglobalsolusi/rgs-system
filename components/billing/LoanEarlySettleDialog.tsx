"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Ban } from "lucide-react";
import { useRouter } from "next/navigation";

import { settleEarlyLoanAction } from "@/app/billing/loans/actions";
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
import {
  earlySettlementPenalty,
  runningInterestToDate,
} from "@/lib/bank-loan";
import { parseDateInput } from "@/lib/invoice-period";
import type { LoanFacilitySnapshot } from "@/lib/loan-facility-query";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { todayDateInput } from "@/lib/project-contract";
import { cn } from "@/lib/utils";

export default function LoanEarlySettleDialog({
  facility,
  bankAccounts,
}: {
  facility: LoanFacilitySnapshot;
  bankAccounts: CompanyBankAccountOption[];
}) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movementDate, setMovementDate] = useState(todayDateInput);
  const [penaltyPercent, setPenaltyPercent] = useState("3");
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [adminFee, setAdminFee] = useState("");
  const [transferFee, setTransferFee] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [notes, setNotes] = useState("");
  const [bankAccountId, setBankAccountId] = useState(
    facility.bankAccountId ?? bankAccounts[0]?.id ?? ""
  );
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const preview = useMemo(() => {
    let settleDate = new Date();
    try {
      settleDate = parseDateInput(movementDate);
    } catch {
      settleDate = new Date();
    }
    const from = facility.lastRepaymentDate ?? facility.startDate;
    const running = runningInterestToDate({
      outstanding: facility.outstanding,
      ratePercent: facility.annualRatePercent,
      basis: facility.interestRateBasis,
      chargesInterest: facility.chargesInterest,
      from,
      to: settleDate,
    });
    const percent = Number(String(penaltyPercent).replace(",", ".")) || 0;
    const typedPenalty = Number(penaltyAmount.replace(/[^\d]/g, ""));
    const penalty =
      penaltyAmount.trim() && Number.isFinite(typedPenalty)
        ? typedPenalty
        : earlySettlementPenalty(facility.outstanding, percent);
    const admin = Number(adminFee.replace(/[^\d]/g, "")) || 0;
    const fee = Number(transferFee.replace(/[^\d]/g, "")) || 0;
    return {
      running,
      penalty,
      admin,
      fee,
      total: facility.outstanding + running + penalty + admin + fee,
    };
  }, [
    adminFee,
    facility.annualRatePercent,
    facility.chargesInterest,
    facility.interestRateBasis,
    facility.lastRepaymentDate,
    facility.outstanding,
    facility.startDate,
    movementDate,
    penaltyAmount,
    penaltyPercent,
    transferFee,
  ]);

  function reset() {
    setError(null);
    setMovementDate(todayDateInput());
    setPenaltyPercent("3");
    setPenaltyAmount("");
    setAdminFee("");
    setTransferFee("");
    setInvoiceRef("");
    setNotes("");
    setBankAccountId(facility.bankAccountId ?? bankAccounts[0]?.id ?? "");
    setDocumentFile(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!documentFile || documentFile.size === 0) {
      setError(t("pages.loans.proofRequired"));
      return;
    }
    const formData = new FormData(event.currentTarget);
    formData.set("facilityId", facility.id);
    formData.set("bankAccountId", bankAccountId);
    formData.set("document", documentFile);
    if (preview.penalty > 0 && !formData.get("penaltyAmount")) {
      formData.set("penaltyAmount", String(preview.penalty));
    }
    setPending(true);
    try {
      await settleEarlyLoanAction(formData);
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.loans.failed"));
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
          <Ban className="h-3.5 w-3.5" aria-hidden />
          {t("pages.loans.settleEarly")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={Ban}
        title={t("pages.loans.settleEarlyTitle")}
        description={t("pages.loans.settleEarlyDesc")}
        maxWidth="lg"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="loan-early-settle-form"
              disabled={pending || !documentFile}
            >
              {pending ? t("pages.loans.saving") : t("pages.loans.settleEarlyConfirm")}
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
          id="loan-early-settle-form"
          className={employeeDialogFormClass}
          onSubmit={handleSubmit}
        >
          <div className={employeeDialogGridClass}>
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <p className="text-sm text-text">
                {t("pages.loans.remainingPrincipal")}:{" "}
                <span className="font-semibold tabular-nums">
                  {formatContractPrice(facility.outstanding)}
                </span>
              </p>
              <p className="mt-1 text-sm text-text">
                {t("pages.loans.runningInterest")}:{" "}
                <span className="font-semibold tabular-nums">
                  {formatContractPrice(preview.running)}
                </span>
              </p>
              <p className={cn(employeeDialogHintClass, "mt-1")}>
                {t("pages.loans.dayCountHint")}
              </p>
            </div>

            <div className={employeeDialogFieldClass}>
              <label htmlFor="loan-settle-date" className={employeeDialogLabelClass}>
                {t("pages.loans.startDate")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                id="loan-settle-date"
                name="movementDate"
                type="date"
                required
                disabled={pending}
                value={movementDate}
                onChange={(event) => setMovementDate(event.target.value)}
                className={employeeInputClass}
              />
            </div>

            {facility.source !== "SHAREHOLDER" ? (
            <div className={employeeDialogFieldClass}>
              <label htmlFor="loan-settle-ref" className={employeeDialogLabelClass}>
                {t("pages.loans.reference")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                id="loan-settle-ref"
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

            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="loan-settle-penalty-pct"
                className={employeeDialogLabelClass}
              >
                {t("pages.loans.penaltyPercent")}
              </label>
              <Input
                id="loan-settle-penalty-pct"
                name="penaltyPercent"
                inputMode="decimal"
                disabled={pending}
                value={penaltyPercent}
                onChange={(event) => {
                  setPenaltyPercent(event.target.value);
                  setPenaltyAmount("");
                }}
                className={employeeInputClass}
              />
            </div>

            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="loan-settle-penalty"
                className={employeeDialogLabelClass}
              >
                {t("pages.loans.penaltyAmount")}
              </label>
              <MoneyInput
                id="loan-settle-penalty"
                name="penaltyAmount"
                disabled={pending}
                value={penaltyAmount || String(preview.penalty || "")}
                onValueChange={setPenaltyAmount}
                className={employeeInputClass}
              />
            </div>

            <div className={employeeDialogFieldClass}>
              <label htmlFor="loan-settle-admin" className={employeeDialogLabelClass}>
                {t("pages.loans.adminFee")}
              </label>
              <MoneyInput
                id="loan-settle-admin"
                name="adminFeeAmount"
                disabled={pending}
                value={adminFee}
                onValueChange={setAdminFee}
                className={employeeInputClass}
              />
            </div>

            <div className={employeeDialogFieldClass}>
              <label htmlFor="loan-settle-fee" className={employeeDialogLabelClass}>
                {t("pages.billing.purchaseTransferFee")}
              </label>
              <MoneyInput
                id="loan-settle-fee"
                name="transferFeeIdr"
                disabled={pending}
                value={transferFee}
                onValueChange={setTransferFee}
                className={employeeInputClass}
              />
            </div>

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <p className="text-sm font-semibold text-text">
                {t("pages.loans.settleEarlyTotal")}:{" "}
                <span className="tabular-nums">
                  {formatContractPrice(preview.total)}
                </span>
              </p>
            </div>

            <CompanyBankAccountField
              className="sm:col-span-2"
              accounts={bankAccounts}
              value={bankAccountId}
              onChange={setBankAccountId}
              label={t("pages.loans.bankAccount")}
              hint={t("pages.loans.bankAccountHint")}
              disabled={pending}
            />

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <BillingDocumentFilePick
                id="loan-settle-proof"
                label={t("pages.loans.proof")}
                required
                fileName={documentFile?.name ?? null}
                onPick={setDocumentFile}
                disabled={pending}
              />
            </div>

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label htmlFor="loan-settle-notes" className={employeeDialogLabelClass}>
                {t("pages.loans.notes")}
              </label>
              <Textarea
                id="loan-settle-notes"
                name="notes"
                disabled={pending}
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-[4.5rem] rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-text shadow-none placeholder:text-subtle"
              />
            </div>
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
