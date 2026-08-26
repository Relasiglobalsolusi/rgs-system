"use client";

import { useState, type FormEvent } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";

import { updateLoanFacilityVariables } from "@/app/billing/loans/actions";
import LoanCalculationVariablesTable, {
  type LoanVariableDraft,
} from "@/components/billing/LoanCalculationVariablesTable";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import type { LoanFacilitySnapshot } from "@/lib/loan-facility-query";
import { useT } from "@/lib/i18n/use-t";

function draftFromFacility(facility: LoanFacilitySnapshot): LoanVariableDraft {
  return {
    dayCountYear: facility.dayCountYear === 365 ? 365 : 360,
    interestRateBasis: facility.interestRateBasis,
    annualRatePercent:
      facility.annualRatePercent != null
        ? String(facility.annualRatePercent)
        : "",
    commitmentFeeApplies: facility.commitmentFeeApplies ? "Yes" : "No",
    commitmentFeeRatePercent:
      facility.commitmentFeeRatePercent != null
        ? String(facility.commitmentFeeRatePercent)
        : "",
    calculationMethod: facility.calculationMethod ?? "",
    tenorMonths:
      facility.tenorMonths != null ? String(facility.tenorMonths) : "",
  };
}

export default function LoanFacilityVariablesDialog({
  facility,
}: {
  facility: LoanFacilitySnapshot;
}) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<LoanVariableDraft>(() =>
    draftFromFacility(facility)
  );

  const showRate =
    facility.kind === "STANDBY" ||
    facility.kind === "TERM" ||
    facility.chargesInterest;

  function reset() {
    setError(null);
    setValues(draftFromFacility(facility));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (showRate && !values.interestRateBasis) {
      setError(t("pages.billing.loanInterestBasisRequired"));
      return;
    }
    if (showRate && !values.annualRatePercent.trim()) {
      setError(
        values.interestRateBasis === "MONTHLY"
          ? t("pages.billing.loanMonthlyRateRequired")
          : t("pages.billing.bankLoanAnnualRateRequired")
      );
      return;
    }
    if (facility.kind === "TERM" && !values.calculationMethod) {
      setError(t("pages.billing.loanCalculationMethodRequired"));
      return;
    }
    if (
      facility.kind === "STANDBY" &&
      values.commitmentFeeApplies === "Yes" &&
      !values.commitmentFeeRatePercent.trim()
    ) {
      setError(t("pages.billing.loanCommitmentFeeRateRequired"));
      return;
    }
    const formData = new FormData();
    formData.set("facilityId", facility.id);
    formData.set("dayCountYear", String(values.dayCountYear));
    if (values.interestRateBasis) {
      formData.set("interestRateBasis", values.interestRateBasis);
    }
    formData.set("annualRatePercent", values.annualRatePercent);
    formData.set(
      "commitmentFeeApplies",
      values.commitmentFeeApplies === "Yes" ? "true" : "false"
    );
    formData.set("commitmentFeeRatePercent", values.commitmentFeeRatePercent);
    if (values.calculationMethod) {
      formData.set("calculationMethod", values.calculationMethod);
    }
    formData.set("tenorMonths", values.tenorMonths);
    setPending(true);
    try {
      await updateLoanFacilityVariables(formData);
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pages.loans.editVariablesFailed")
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
        <Button type="button" variant="outline" size="badgeFlex">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          {t("pages.loans.editVariables")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={SlidersHorizontal}
        title={t("pages.loans.editVariablesTitle")}
        description={t("pages.loans.editVariablesDesc")}
        maxWidth="lg"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="loan-facility-variables-form"
              disabled={pending}
            >
              {pending
                ? t("pages.loans.saving")
                : t("pages.loans.editVariablesSave")}
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
          id="loan-facility-variables-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <LoanCalculationVariablesTable
            kind={facility.kind}
            showRate={showRate}
            disabled={pending}
            values={values}
            onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          />
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
