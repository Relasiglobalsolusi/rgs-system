"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarClock } from "lucide-react";
import { useRouter } from "next/navigation";

import { extendLoanFacilityAction } from "@/app/billing/loans/actions";
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
import {
  remainingTenorMonths,
  termMonthlyInstallment,
} from "@/lib/bank-loan";
import type { LoanFacilitySnapshot } from "@/lib/loan-facility-query";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { cn } from "@/lib/utils";

export default function LoanExtendDialog({
  facility,
}: {
  facility: LoanFacilitySnapshot;
}) {
  const { t } = useT();
  const router = useRouter();
  const isStandby = facility.kind === "STANDBY";
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facilityLimit, setFacilityLimit] = useState(
    facility.facilityLimit != null ? String(facility.facilityLimit) : ""
  );
  const [annualRatePercent, setAnnualRatePercent] = useState(
    facility.annualRatePercent != null ? String(facility.annualRatePercent) : ""
  );

  const remainingMonths =
    facility.tenorMonths != null
      ? remainingTenorMonths(facility.startDate, facility.tenorMonths)
      : 0;
  const rateNumber = Number(String(annualRatePercent).replace(",", ".")) || 0;
  const installmentPreview = useMemo(() => {
    if (isStandby || facility.outstanding <= 0 || remainingMonths <= 0) return 0;
    return termMonthlyInstallment(
      facility.outstanding,
      rateNumber,
      remainingMonths,
      facility.interestRateBasis
    );
  }, [
    facility.interestRateBasis,
    facility.outstanding,
    isStandby,
    rateNumber,
    remainingMonths,
  ]);

  function reset() {
    setError(null);
    setFacilityLimit(
      facility.facilityLimit != null ? String(facility.facilityLimit) : ""
    );
    setAnnualRatePercent(
      facility.annualRatePercent != null ? String(facility.annualRatePercent) : ""
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("facilityId", facility.id);
    setPending(true);
    try {
      await extendLoanFacilityAction(formData);
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pages.loans.extendFailed")
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
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          {t("pages.loans.extendLoan")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={CalendarClock}
        title={t("pages.loans.extendLoanTitle")}
        description={
          isStandby
            ? t("pages.loans.extendLoanStandbyDesc")
            : t("pages.loans.extendLoanTermDesc")
        }
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="loan-extend-form"
              disabled={
                pending ||
                (isStandby
                  ? !facilityLimit.trim()
                  : !annualRatePercent.trim())
              }
            >
              {pending ? t("pages.loans.saving") : t("pages.loans.extendLoanConfirm")}
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
          id="loan-extend-form"
          className={employeeDialogFormClass}
          onSubmit={handleSubmit}
        >
          <div className={employeeDialogGridClass}>
            {isStandby ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label htmlFor="loan-extend-ceiling" className={employeeDialogLabelClass}>
                  {t("pages.loans.newCeiling")}
                  <span className="text-red-400"> *</span>
                </label>
                <MoneyInput
                  id="loan-extend-ceiling"
                  name="facilityLimit"
                  disabled={pending}
                  value={facilityLimit}
                  onValueChange={setFacilityLimit}
                  className={employeeInputClass}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.loans.newCeilingHint")}
                </p>
              </div>
            ) : (
              <>
                <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                  <label htmlFor="loan-extend-rate" className={employeeDialogLabelClass}>
                    {facility.interestRateBasis === "MONTHLY"
                      ? t("pages.billing.loanMonthlyRate")
                      : t("pages.billing.bankLoanAnnualRate")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <Input
                    id="loan-extend-rate"
                    name="annualRatePercent"
                    inputMode="decimal"
                    disabled={pending}
                    value={annualRatePercent}
                    onChange={(event) => setAnnualRatePercent(event.target.value)}
                    className={employeeInputClass}
                  />
                  <p className={employeeDialogHintClass}>
                    {t("pages.loans.newInterestRateHint")}
                  </p>
                </div>
                {installmentPreview > 0 ? (
                  <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                    <p className="text-sm text-text">
                      {t("pages.billing.loanPaymentThisMonthShouldBe")}:{" "}
                      <span className="font-semibold tabular-nums">
                        {formatContractPrice(installmentPreview)}
                      </span>
                    </p>
                    <p className={employeeDialogHintClass}>
                      {t("pages.loans.extendTermInstallmentHint", {
                        months: String(remainingMonths),
                      })}
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
