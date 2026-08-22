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
import type { BankLoanKind } from "@/lib/bank-loan";
import {
  isLoanFeePurpose,
  type LoanPaymentPurpose,
  type LoanSource,
} from "@/lib/loan-facility";
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
  monthlyInstallment?: number | null;
  chargesInterest: boolean;
};

type Props = {
  source: LoanSource | "";
  kind: BankLoanKind | "";
  paymentPurpose: LoanPaymentPurpose | "";
  facilityId: string;
  facilities: PurchaseLoanFacilityOption[];
  onSourceChange: (source: LoanSource) => void;
  onKindChange: (kind: BankLoanKind) => void;
  onPaymentPurposeChange: (purpose: LoanPaymentPurpose) => void;
  onFacilityChange: (facilityId: string) => void;
  disabled?: boolean;
};

export default function PurchaseLoanFields({
  source,
  kind,
  paymentPurpose,
  facilityId,
  facilities,
  onSourceChange,
  onKindChange,
  onPaymentPurposeChange,
  onFacilityChange,
  disabled,
}: Props) {
  const { t } = useT();
  const isBank = source === "BANK";
  const showPaymentFor = isBank;
  const feePurpose = isLoanFeePurpose(paymentPurpose);
  const showKind = source === "SHAREHOLDER" || (isBank && feePurpose);
  const filtered = facilities.filter((row) => {
    if (!source || row.source !== source) return false;
    if (kind) return row.kind === kind;
    return false;
  });
  const canPickFacility = Boolean(source) && Boolean(kind);
  const selected = filtered.find((row) => row.id === facilityId) ?? null;
  const paymentThisMonth =
    selected?.kind === "TERM"
      ? selected.monthlyInstallment ?? selected.suggestedPayment
      : 0;

  return (
    <div className={cn(employeeDialogFieldClass, "sm:col-span-2 gap-2")}>
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

      {showPaymentFor ? (
        <div>
          <label id="loan-payment-for-label" className={employeeDialogLabelClass}>
            {t("pages.billing.loanPaymentFor")}
            <span className="text-red-400"> *</span>
          </label>
          <div
            role="radiogroup"
            aria-labelledby="loan-payment-for-label"
            className="mt-2 grid grid-cols-2 gap-2"
          >
            {(
              [
                ["INTEREST", t("pages.billing.loanPaymentForInterest")],
                ["INSTALLMENT", t("pages.billing.loanPaymentForInstallment")],
                ["PROVISION", t("pages.billing.loanPaymentForProvision")],
                ["ADMIN_FEE", t("pages.billing.loanPaymentForAdminFee")],
              ] as const
            ).map(([value, label]) => {
              const active = paymentPurpose === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  onClick={() => onPaymentPurposeChange(value)}
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
            {t("pages.billing.loanPaymentForHint")}
          </p>
        </div>
      ) : null}

      {showKind && source ? (
        <div>
          <label id="loan-kind-label" className={employeeDialogLabelClass}>
            {t("pages.billing.bankLoanKind")}
            <span className="text-red-400"> *</span>
          </label>
          <div
            role="radiogroup"
            aria-labelledby="loan-kind-label"
            className="mt-2 grid grid-cols-2 gap-2"
          >
            {(
              [
                ["STANDBY", t("pages.billing.bankLoanKindStandby")],
                ["TERM", t("pages.billing.bankLoanKindTerm")],
              ] as const
            ).map(([value, label]) => {
              const active = kind === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  onClick={() => onKindChange(value)}
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
            {kind === "STANDBY"
              ? t("pages.billing.loanExpenseStandbyHint")
              : kind === "TERM"
                ? t("pages.billing.loanExpenseTermHint")
                : t("pages.billing.bankLoanKindHint")}
          </p>
        </div>
      ) : null}

      {canPickFacility && source ? (
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
                    {" · "}
                    {row.kind === "TERM"
                      ? t("pages.billing.bankLoanKindTerm")
                      : t("pages.billing.bankLoanKindStandby")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      ) : null}

      {selected ? (
        <div className="rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text">
          <p>
            {t("pages.billing.loanOutstanding")}:{" "}
            <span className="font-semibold tabular-nums">
              {formatContractPrice(selected.outstanding)}
            </span>
          </p>
          {selected.kind === "TERM" && paymentThisMonth > 0 ? (
            <p className="mt-1">
              {t("pages.billing.loanPaymentThisMonthShouldBe")}:{" "}
              <span className="font-semibold tabular-nums">
                {formatContractPrice(paymentThisMonth)}
              </span>
            </p>
          ) : null}
          <p className={cn(employeeDialogHintClass, "mt-1")}>
            {isLoanFeePurpose(paymentPurpose)
              ? paymentPurpose === "PROVISION"
                ? t("pages.billing.loanExpenseProvisionHint")
                : t("pages.billing.loanExpenseAdminFeeHint")
              : selected.kind === "STANDBY"
                ? t("pages.billing.loanExpenseStandbyHint")
                : t("pages.billing.loanExpenseTermHint")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
