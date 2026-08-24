"use client";

import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { useT } from "@/lib/i18n/use-t";

function moneyDefault(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(Math.round(value));
}

export default function ExclusiveContractPriceField({
  name = "contractPrice",
  id,
  defaultValue,
  required = true,
}: {
  name?: string;
  id?: string;
  defaultValue?: number | null;
  required?: boolean;
}) {
  const { t } = useT();

  return (
    <div className={employeeDialogFieldClass}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {t("pages.billing.contractPrice")}
        {required ? <span className="text-red-400"> *</span> : null}
      </label>
      <MoneyInput
        id={id}
        name={name}
        required={required}
        defaultValue={moneyDefault(defaultValue)}
        className={employeeInputClass}
      />
      <p className={employeeDialogHintClass}>
        {t("pages.billing.contractPriceMonthlyHint")}
      </p>
    </div>
  );
}
