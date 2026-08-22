"use client";

import Link from "next/link";

import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import type { LoanSource } from "@/lib/loan-facility";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { cn } from "@/lib/utils";

export type PurchaseLoanFacilityOption = {
  id: string;
  name: string;
  source: LoanSource;
  kind: "STANDBY" | "TERM";
  lenderName: string;
  outstanding: number;
  suggestedPayment: number;
  interestDue: number;
  principalDue: number;
  unusedLimit: number | null;
  chargesInterest: boolean;
};

type Props = {
  source: LoanSource | "";
  facilityId: string;
  facilities: PurchaseLoanFacilityOption[];
  onSourceChange: (source: LoanSource) => void;
  onFacilityChange: (facilityId: string) => void;
  disabled?: boolean;
};

export default function PurchaseLoanFields({
  source,
  facilityId,
  facilities,
  onSourceChange,
  onFacilityChange,
  disabled,
}: Props) {
  const { t } = useT();
  const filtered = facilities.filter((row) =>
    source ? row.source === source : false
  );
  const selected = filtered.find((row) => row.id === facilityId) ?? null;

  return (
    <div className={cn(employeeDialogFieldClass, "sm:col-span-2 space-y-3")}>
      <div>
        <label id="loan-source-label" className={employeeDialogLabelClass}>
          {t("pages.billing.loanSource")}
          <span className="text-red-400"> *</span>
        </label>
        <div
          role="radiogroup"
          aria-labelledby="loan-source-label"
          className="mt-2 grid grid-cols-2 gap-2"
        >
          {(
            [
              ["BANK", t("pages.billing.loanSourceBank")],
              ["SHAREHOLDER", t("pages.billing.loanSourceShareholder")],
            ] as const
          ).map(([value, label]) => {
            const active = source === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onSourceChange(value)}
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
          {t("pages.billing.loanSourceHint")}
        </p>
      </div>

      {source ? (
        filtered.length === 0 ? (
          <p className={employeeDialogHintClass} role="status">
            {t("pages.billing.loanFacilityEmpty")}{" "}
            <Link href="/billing/loans" className="font-semibold text-primary">
              {t("pages.loans.title")}
            </Link>
          </p>
        ) : (
          <div>
            <label htmlFor="loan-facility" className={employeeDialogLabelClass}>
              {t("pages.billing.loanFacility")}
              <span className="text-red-400"> *</span>
            </label>
            <Select
              value={facilityId || null}
              onValueChange={(value) => {
                if (!value) return;
                onFacilityChange(value);
              }}
              disabled={disabled}
            >
              <SelectTrigger
                id="loan-facility"
                className={cn(employeeSelectTriggerClass, "w-full")}
              >
                <SelectValue
                  placeholder={t("pages.billing.loanFacilityPlaceholder")}
                >
                  {(value) => {
                    if (!value) {
                      return t("pages.billing.loanFacilityPlaceholder");
                    }
                    return (
                      filtered.find((row) => row.id === value)?.name ?? null
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {filtered.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      ) : null}

      {selected ? (
        <div className="rounded-xl border border-border bg-elevated px-3 py-2.5 text-sm text-text">
          <p>
            {t("pages.billing.loanOutstanding")}:{" "}
            <span className="font-semibold tabular-nums">
              {formatContractPrice(selected.outstanding)}
            </span>
          </p>
          {selected.suggestedPayment > 0 ? (
            <>
              <p className="mt-1">
                {t("pages.billing.loanSuggestedPayment")}:{" "}
                <span className="font-semibold tabular-nums">
                  {formatContractPrice(selected.suggestedPayment)}
                </span>
              </p>
              <p className={cn(employeeDialogHintClass, "mt-1")}>
                {t("pages.billing.loanPaymentSplit", {
                  interest: formatContractPrice(selected.interestDue),
                  principal: formatContractPrice(selected.principalDue),
                })}
              </p>
            </>
          ) : (
            <p className={cn(employeeDialogHintClass, "mt-1")}>
              {t("pages.billing.bankLoanPaymentAmountHint")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
