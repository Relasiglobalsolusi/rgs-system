"use client";

import type { ChangeEvent } from "react";

import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import {
  PAYMENT_TERMS_DAYS_OPTIONS,
  paymentTermsMonthCount,
} from "@/lib/invoice-period";
import { useT } from "@/lib/i18n/use-t";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

type Props = {
  name?: string;
  id?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (days: number) => void;
  disabled?: boolean;
  required?: boolean;
  labelKey?: MessageKey;
  hintKey?: MessageKey;
  className?: string;
};

function termsValue(value: string | number | undefined): string {
  if (value == null || value === "") return "14";
  return String(value);
}

export default function PaymentTermsField({
  name = "paymentTermsDays",
  id,
  value,
  defaultValue = 14,
  onChange,
  disabled = false,
  required = true,
  labelKey = "pages.projects.serviceCommercial.paymentTermsDays",
  hintKey = "pages.projects.serviceCommercial.paymentTermsDaysHint",
  className,
}: Props) {
  const { t } = useT();
  const controlled = value != null;

  return (
    <div className={cn(employeeDialogFieldClass, className)}>
      <label htmlFor={id ?? name} className={employeeDialogLabelClass}>
        {t(labelKey)}
        {required ? <span className="text-red-400"> *</span> : null}
      </label>
      <select
        id={id ?? name}
        name={name}
        disabled={disabled}
        required={required}
        {...(controlled
          ? {
              value: termsValue(value),
              onChange: (event: ChangeEvent<HTMLSelectElement>) => {
                onChange?.(Number(event.target.value));
              },
            }
          : {
              defaultValue: termsValue(defaultValue),
              onChange: (event: ChangeEvent<HTMLSelectElement>) => {
                onChange?.(Number(event.target.value));
              },
            })}
        className={employeeInputClass}
      >
        {PAYMENT_TERMS_DAYS_OPTIONS.map((days) => {
          const months = paymentTermsMonthCount(days);
          return (
            <option key={days} value={days}>
              {days === 0
                ? t("common.paymentTerms.cash")
                : months != null
                  ? t("common.paymentTerms.netMonths", { days, months })
                  : t("common.paymentTerms.net", { days })}
            </option>
          );
        })}
      </select>
      <p className={employeeDialogHintClass}>{t(hintKey)}</p>
    </div>
  );
}
