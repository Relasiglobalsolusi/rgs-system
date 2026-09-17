"use client";

import {
  employeeDialogChoiceChipClass,
  employeeDialogChoiceGridClass,
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
} from "@/components/employees/employee-dialog-ui";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import type { PurchasePaymentMethod } from "@/lib/company-cash";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { cn } from "@/lib/utils";

type Props = {
  value: PurchasePaymentMethod;
  onChange: (value: PurchasePaymentMethod) => void;
  cashAtHand: number;
  disabled?: boolean;
};

export default function PurchasePaymentMethodField({
  value,
  onChange,
  cashAtHand,
  disabled = false,
}: Props) {
  const { t } = useT();
  const options: Array<[PurchasePaymentMethod, string]> = [
    ["BANK", t("pages.billing.purchasePaymentMethodBank")],
    ["CASH", t("pages.billing.purchasePaymentMethodCash")],
  ];

  return (
    <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
      <label
        id="purchase-payment-method-label"
        className={employeeDialogLabelClass}
      >
        {t("pages.billing.purchasePaymentMethod")}
        <span className="text-red-400"> *</span>
      </label>
      <div
        role="radiogroup"
        aria-labelledby="purchase-payment-method-label"
        className={employeeDialogChoiceGridClass}
      >
        {options.map(([method, label]) => {
          const active = value === method;
          return (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(method)}
              className={cn(
                employeeDialogChoiceChipClass,
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
        {value === "CASH"
          ? t("pages.billing.purchasePaymentMethodCashHint", {
              amount: formatContractPrice(cashAtHand),
            })
          : t("pages.billing.purchasePaymentMethodBankHint")}
      </p>
    </div>
  );
}
