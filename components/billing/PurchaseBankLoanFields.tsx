"use client";

import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import {
  previewBankLoan,
  type BankLoanKind,
} from "@/lib/bank-loan";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { cn } from "@/lib/utils";

export type PurchaseBankLoanDraft = {
  kind: BankLoanKind | "";
  facilityLimit: string;
  drawnAmount: string;
  principal: string;
  annualRatePercent: string;
  tenorMonths: string;
};

export function emptyBankLoanDraft(): PurchaseBankLoanDraft {
  return {
    kind: "",
    facilityLimit: "",
    drawnAmount: "",
    principal: "",
    annualRatePercent: "",
    tenorMonths: "60",
  };
}

function moneyNumber(raw: string): number {
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function bankLoanSuggestedPayment(
  draft: PurchaseBankLoanDraft
): number | null {
  const preview = previewBankLoan({
    kind: draft.kind,
    drawnAmount: moneyNumber(draft.drawnAmount),
    principal: moneyNumber(draft.principal),
    annualPercent: Number(String(draft.annualRatePercent).replace(",", ".")),
    tenorMonths: Number(draft.tenorMonths),
  });
  if (!preview || preview.suggestedPayment <= 0) return null;
  return preview.suggestedPayment;
}

type Props = {
  draft: PurchaseBankLoanDraft;
  onChange: (draft: PurchaseBankLoanDraft) => void;
  disabled?: boolean;
};

export default function PurchaseBankLoanFields({
  draft,
  onChange,
  disabled,
}: Props) {
  const { t } = useT();
  const annualPercent = Number(
    String(draft.annualRatePercent).replace(",", ".")
  );
  const preview = previewBankLoan({
    kind: draft.kind,
    drawnAmount: moneyNumber(draft.drawnAmount),
    principal: moneyNumber(draft.principal),
    annualPercent: Number.isFinite(annualPercent) ? annualPercent : 0,
    tenorMonths: Number(draft.tenorMonths),
  });

  return (
    <div className={cn(employeeDialogFieldClass, "sm:col-span-2 space-y-3")}>
      <div>
        <label
          id="bank-loan-kind-label"
          className={employeeDialogLabelClass}
        >
          {t("pages.billing.bankLoanKind")}
          <span className="text-red-400"> *</span>
        </label>
        <div
          role="radiogroup"
          aria-labelledby="bank-loan-kind-label"
          className="mt-2 grid grid-cols-2 gap-2"
        >
          {(
            [
              ["STANDBY", t("pages.billing.bankLoanKindStandby")],
              ["TERM", t("pages.billing.bankLoanKindTerm")],
            ] as const
          ).map(([value, label]) => {
            const active = draft.kind === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onChange({ ...draft, kind: value })}
                className={cn(
                  "inline-flex min-h-8 w-full items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold tracking-wide transition",
                  active && outlineChipTones.emeraldInteractive,
                  !active &&
                    "border border-border bg-elevated text-muted hover:border-border-strong hover:bg-card-hover hover:text-text"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className={employeeDialogHintClass}>
          {draft.kind === "TERM"
            ? t("pages.billing.bankLoanKindTermHint")
            : draft.kind === "STANDBY"
              ? t("pages.billing.bankLoanKindStandbyHint")
              : t("pages.billing.bankLoanKindHint")}
        </p>
      </div>

      {draft.kind === "STANDBY" ? (
        <>
          <div>
            <label
              htmlFor="bank-loan-facility"
              className={employeeDialogLabelClass}
            >
              {t("pages.billing.bankLoanFacilityLimit")}
            </label>
            <MoneyInput
              id="bank-loan-facility"
              disabled={disabled}
              value={draft.facilityLimit}
              onValueChange={(value) =>
                onChange({ ...draft, facilityLimit: value })
              }
              className={employeeInputClass}
            />
            <p className={employeeDialogHintClass}>
              {t("pages.billing.bankLoanFacilityLimitHint")}
            </p>
          </div>
          <div>
            <label
              htmlFor="bank-loan-drawn"
              className={employeeDialogLabelClass}
            >
              {t("pages.billing.bankLoanDrawnAmount")}
              <span className="text-red-400"> *</span>
            </label>
            <MoneyInput
              id="bank-loan-drawn"
              disabled={disabled}
              value={draft.drawnAmount}
              onValueChange={(value) =>
                onChange({ ...draft, drawnAmount: value })
              }
              className={employeeInputClass}
            />
            <p className={employeeDialogHintClass}>
              {t("pages.billing.bankLoanDrawnAmountHint")}
            </p>
          </div>
        </>
      ) : null}

      {draft.kind === "TERM" ? (
        <>
          <div>
            <label
              htmlFor="bank-loan-principal"
              className={employeeDialogLabelClass}
            >
              {t("pages.billing.bankLoanPrincipal")}
              <span className="text-red-400"> *</span>
            </label>
            <MoneyInput
              id="bank-loan-principal"
              disabled={disabled}
              value={draft.principal}
              onValueChange={(value) =>
                onChange({ ...draft, principal: value })
              }
              className={employeeInputClass}
            />
            <p className={employeeDialogHintClass}>
              {t("pages.billing.bankLoanPrincipalHint")}
            </p>
          </div>
          <div>
            <label
              htmlFor="bank-loan-tenor"
              className={employeeDialogLabelClass}
            >
              {t("pages.billing.bankLoanTenorMonths")}
              <span className="text-red-400"> *</span>
            </label>
            <Input
              id="bank-loan-tenor"
              inputMode="numeric"
              disabled={disabled}
              value={draft.tenorMonths}
              onChange={(event) =>
                onChange({ ...draft, tenorMonths: event.target.value })
              }
              placeholder="60"
              className={employeeInputClass}
            />
            <p className={employeeDialogHintClass}>
              {t("pages.billing.bankLoanTenorMonthsHint")}
            </p>
          </div>
        </>
      ) : null}

      {draft.kind ? (
        <div>
          <label
            htmlFor="bank-loan-rate"
            className={employeeDialogLabelClass}
          >
            {t("pages.billing.bankLoanAnnualRate")}
            <span className="text-red-400"> *</span>
          </label>
          <Input
            id="bank-loan-rate"
            inputMode="decimal"
            disabled={disabled}
            value={draft.annualRatePercent}
            onChange={(event) =>
              onChange({ ...draft, annualRatePercent: event.target.value })
            }
            placeholder="12"
            className={employeeInputClass}
          />
          <p className={employeeDialogHintClass}>
            {t("pages.billing.bankLoanAnnualRateHint")}
          </p>
        </div>
      ) : null}

      {preview && preview.suggestedPayment > 0 ? (
        <div className="rounded-xl border border-border bg-elevated px-3 py-2.5 text-sm text-text">
          {preview.kind === "STANDBY" ? (
            <p>
              {t("pages.billing.bankLoanMonthlyInterest")}:{" "}
              <span className="font-semibold tabular-nums">
                {formatContractPrice(preview.monthlyInterest ?? 0)}
              </span>
            </p>
          ) : (
            <>
              <p>
                {t("pages.billing.bankLoanMonthlyInstallment")}:{" "}
                <span className="font-semibold tabular-nums">
                  {formatContractPrice(preview.monthlyInstallment ?? 0)}
                </span>
              </p>
              <p className={cn(employeeDialogHintClass, "mt-1")}>
                {t("pages.billing.bankLoanFirstMonthSplit", {
                  interest: formatContractPrice(preview.firstMonthInterest ?? 0),
                  principal: formatContractPrice(
                    preview.firstMonthPrincipal ?? 0
                  ),
                })}
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
