"use client";

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
import {
  commercialTaxKindLabelKey,
  commercialTaxKindPickerOptions,
  isCommercialTaxKind,
  type CommercialTaxKind,
} from "@/lib/commercial-tax";
import { useT } from "@/lib/i18n/use-t";
import { formatTaxRatePercent } from "@/lib/tax-rate-codes";
import { cn } from "@/lib/utils";

type ExtraTaxType = {
  code: string;
  name: string;
  ratePercent: number;
};

type Props = {
  id: string;
  name?: string;
  value: CommercialTaxKind | "";
  taxRateCode?: string;
  extraTypes?: ExtraTaxType[];
  onChange: (value: CommercialTaxKind | "") => void;
  onTaxRateCodeChange?: (code: string) => void;
  label: string;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

function customValue(code: string) {
  return `CUSTOM:${code}`;
}

export default function CommercialTaxKindField({
  id,
  name,
  value,
  taxRateCode = "",
  extraTypes = [],
  onChange,
  onTaxRateCodeChange,
  label,
  hint,
  placeholder,
  disabled,
  required = true,
  className,
}: Props) {
  const { t } = useT();
  const selected = taxRateCode
    ? customValue(taxRateCode)
    : value || null;
  const selectedExtra = extraTypes.find((row) => row.code === taxRateCode);

  return (
    <div className={cn(employeeDialogFieldClass, className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {onTaxRateCodeChange ? (
        <input type="hidden" name="taxRateCode" value={taxRateCode} />
      ) : null}
      <label htmlFor={id} className={employeeDialogLabelClass}>
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </label>
      <Select
        value={selected}
        onValueChange={(next) => {
          if (!next) return;
          if (next.startsWith("CUSTOM:")) {
            onChange("OTHER");
            onTaxRateCodeChange?.(next.slice("CUSTOM:".length));
            return;
          }
          if (isCommercialTaxKind(next)) {
            onChange(next);
            onTaxRateCodeChange?.("");
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} className={cn(employeeSelectTriggerClass, "w-full")}>
          <SelectValue placeholder={placeholder ?? label}>
            {(current) => {
              if (typeof current === "string" && current.startsWith("CUSTOM:")) {
                const code = current.slice("CUSTOM:".length);
                const row = extraTypes.find((item) => item.code === code);
                return row
                  ? `${row.name} (${formatTaxRatePercent(row.ratePercent)})`
                  : current;
              }
              if (isCommercialTaxKind(current)) {
                return t(commercialTaxKindLabelKey(current));
              }
              return placeholder ?? label;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {commercialTaxKindPickerOptions(value).map((kind) => (
            <SelectItem key={kind} value={kind}>
              {t(commercialTaxKindLabelKey(kind))}
            </SelectItem>
          ))}
          {extraTypes.map((row) => (
            <SelectItem key={row.code} value={customValue(row.code)}>
              {`${row.name} (${formatTaxRatePercent(row.ratePercent)})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <p className={employeeDialogHintClass}>{hint}</p> : null}
      {selectedExtra ? (
        <p className={employeeDialogHintClass}>
          {t("pages.taxRates.currentRate", {
            percent: formatTaxRatePercent(selectedExtra.ratePercent),
          })}
        </p>
      ) : null}
    </div>
  );
}
