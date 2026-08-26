"use client";

import {
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Input } from "@/components/ui/input";
import YesNoChoiceCards, {
  type YesNoChoice,
} from "@/components/ui/YesNoChoiceCards";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import type {
  BankLoanKind,
  LoanCalculationMethod,
  LoanInterestBasis,
} from "@/lib/bank-loan";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type LoanVariableDraft = {
  dayCountYear: 360 | 365;
  interestRateBasis: LoanInterestBasis | "";
  annualRatePercent: string;
  commitmentFeeApplies: YesNoChoice;
  commitmentFeeRatePercent: string;
  calculationMethod: LoanCalculationMethod | "";
  tenorMonths: string;
};

type Props = {
  kind: BankLoanKind | "";
  showRate: boolean;
  disabled?: boolean;
  values: LoanVariableDraft;
  onChange: (patch: Partial<LoanVariableDraft>) => void;
};

function ChoiceRow<T extends string>({
  labelledBy,
  value,
  options,
  disabled,
  onChange,
}: {
  labelledBy: string;
  value: T | "";
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="flex flex-wrap gap-2"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex min-h-8 items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold tracking-wide transition",
            value === option.value && outlineChipTones.emeraldInteractive,
            value !== option.value &&
              "border border-border bg-elevated text-muted hover:border-border-strong hover:bg-card-hover hover:text-text"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function LoanCalculationVariablesTable({
  kind,
  showRate,
  disabled,
  values,
  onChange,
}: Props) {
  const { t } = useT();
  const isStandby = kind === "STANDBY";
  const isTerm = kind === "TERM";

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-border bg-strip text-xs text-muted">
          <tr>
            <th className="px-4 py-3 font-semibold">
              {t("pages.loans.variable")}
            </th>
            <th className="px-4 py-3 font-semibold">
              {t("pages.loans.value")}
            </th>
          </tr>
        </thead>
        <tbody>
          {showRate ? (
            <>
          <tr className="border-b border-border/70">
            <td className="px-4 py-3 align-top">
              <p id="loan-var-day-count" className={employeeDialogLabelClass}>
                {t("pages.loans.dayCountYear")}
              </p>
            </td>
            <td className="px-4 py-3">
              <ChoiceRow
                labelledBy="loan-var-day-count"
                value={String(values.dayCountYear)}
                options={[
                  { value: "360", label: "360" },
                  { value: "365", label: "365" },
                ]}
                disabled={disabled}
                onChange={(value) =>
                  onChange({ dayCountYear: value === "365" ? 365 : 360 })
                }
              />
              <p className={cn(employeeDialogHintClass, "mt-2")}>
                {t("pages.loans.dayCountActual", {
                  year: values.dayCountYear,
                })}
              </p>
            </td>
          </tr>
              <tr className="border-b border-border/70">
                <td className="px-4 py-3 align-top">
                  <p
                    id="loan-var-rate-basis"
                    className={employeeDialogLabelClass}
                  >
                    {t("pages.billing.loanInterestBasis")}
                    <span className="text-red-400"> *</span>
                  </p>
                </td>
                <td className="px-4 py-3">
                  <ChoiceRow
                    labelledBy="loan-var-rate-basis"
                    value={values.interestRateBasis}
                    options={[
                      {
                        value: "ANNUAL",
                        label: t("pages.billing.loanInterestBasisAnnual"),
                      },
                      {
                        value: "MONTHLY",
                        label: t("pages.billing.loanInterestBasisMonthly"),
                      },
                    ]}
                    disabled={disabled}
                    onChange={(value) =>
                      onChange({
                        interestRateBasis: value as LoanInterestBasis,
                      })
                    }
                  />
                </td>
              </tr>
              <tr className="border-b border-border/70">
                <td className="px-4 py-3 align-top">
                  <label
                    htmlFor="loan-var-rate"
                    className={employeeDialogLabelClass}
                  >
                    {values.interestRateBasis === "MONTHLY"
                      ? t("pages.billing.loanMonthlyRate")
                      : t("pages.billing.bankLoanAnnualRate")}
                    <span className="text-red-400"> *</span>
                  </label>
                </td>
                <td className="px-4 py-3">
                  <Input
                    id="loan-var-rate"
                    name="annualRatePercent"
                    inputMode="decimal"
                    disabled={disabled}
                    value={values.annualRatePercent}
                    onChange={(event) =>
                      onChange({ annualRatePercent: event.target.value })
                    }
                    placeholder={
                      values.interestRateBasis === "MONTHLY" ? "1" : "12"
                    }
                    className={employeeInputClass}
                  />
                  <p className={cn(employeeDialogHintClass, "mt-2")}>
                    {values.interestRateBasis === "MONTHLY"
                      ? t("pages.billing.loanMonthlyRateHint")
                      : t("pages.billing.bankLoanAnnualRateHint")}
                  </p>
                </td>
              </tr>
            </>
          ) : null}

          {isStandby ? (
            <>
              <tr className="border-b border-border/70">
                <td className="px-4 py-3 align-top">
                  <p
                    id="loan-var-commitment"
                    className={employeeDialogLabelClass}
                  >
                    {t("pages.loans.commitmentFeeApplies")}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <YesNoChoiceCards
                    id="loan-var-commitment"
                    labelledBy="loan-var-commitment"
                    value={values.commitmentFeeApplies}
                    onChange={(value) =>
                      onChange({ commitmentFeeApplies: value })
                    }
                    disabled={disabled}
                  />
                  <p className={cn(employeeDialogHintClass, "mt-2")}>
                    {t("pages.billing.loanCommitmentFeeHint")}
                  </p>
                </td>
              </tr>
              {values.commitmentFeeApplies === "Yes" ? (
                <tr className="border-b border-border/70">
                  <td className="px-4 py-3 align-top">
                    <label
                      htmlFor="loan-var-commitment-rate"
                      className={employeeDialogLabelClass}
                    >
                      {t("pages.billing.loanCommitmentFeeRate")}
                      <span className="text-red-400"> *</span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      id="loan-var-commitment-rate"
                      name="commitmentFeeRatePercent"
                      disabled={disabled}
                      value={values.commitmentFeeRatePercent}
                      onChange={(event) =>
                        onChange({
                          commitmentFeeRatePercent: event.target.value,
                        })
                      }
                      className={employeeInputClass}
                    />
                    <p className={cn(employeeDialogHintClass, "mt-2")}>
                      {t("pages.billing.loanCommitmentFeeRateHint")}
                    </p>
                  </td>
                </tr>
              ) : null}
            </>
          ) : null}

          {isTerm ? (
            <>
              <tr className={showRate ? "border-b border-border/70" : "border-b border-border/70 last:border-0"}>
                <td className="px-4 py-3 align-top">
                  <label
                    htmlFor="loan-var-tenor"
                    className={employeeDialogLabelClass}
                  >
                    {t("pages.billing.bankLoanTenorMonths")}
                    <span className="text-red-400"> *</span>
                  </label>
                </td>
                <td className="px-4 py-3">
                  <Input
                    id="loan-var-tenor"
                    name="tenorMonths"
                    inputMode="numeric"
                    disabled={disabled}
                    value={values.tenorMonths}
                    onChange={(event) =>
                      onChange({ tenorMonths: event.target.value })
                    }
                    className={employeeInputClass}
                  />
                </td>
              </tr>
              {showRate ? (
              <tr className="border-b border-border/70 last:border-0">
                <td className="px-4 py-3 align-top">
                  <p id="loan-var-method" className={employeeDialogLabelClass}>
                    {t("pages.billing.loanCalculationMethod")}
                    <span className="text-red-400"> *</span>
                  </p>
                </td>
                <td className="px-4 py-3">
                  <ChoiceRow
                    labelledBy="loan-var-method"
                    value={values.calculationMethod}
                    options={[
                      {
                        value: "FLAT",
                        label: t("pages.billing.loanCalculationMethodFlat"),
                      },
                      {
                        value: "EFFECTIVE",
                        label: t("pages.billing.loanCalculationMethodEffective"),
                      },
                      {
                        value: "ANNUITY",
                        label: t("pages.billing.loanCalculationMethodAnnuity"),
                      },
                    ]}
                    disabled={disabled}
                    onChange={(value) =>
                      onChange({
                        calculationMethod: value as LoanCalculationMethod,
                      })
                    }
                  />
                  {values.calculationMethod === "FLAT" ? (
                    <p className={cn(employeeDialogHintClass, "mt-2")}>
                      {t("pages.billing.loanCalculationMethodFlatHint")}
                    </p>
                  ) : null}
                  {values.calculationMethod === "EFFECTIVE" ? (
                    <p className={cn(employeeDialogHintClass, "mt-2")}>
                      {t("pages.billing.loanCalculationMethodEffectiveHint")}
                    </p>
                  ) : null}
                  {values.calculationMethod === "ANNUITY" ? (
                    <p className={cn(employeeDialogHintClass, "mt-2")}>
                      {t("pages.billing.loanCalculationMethodAnnuityHint")}
                    </p>
                  ) : null}
                </td>
              </tr>
              ) : null}
            </>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
