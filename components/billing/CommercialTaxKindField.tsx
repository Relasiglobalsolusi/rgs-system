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
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  name?: string;
  value: CommercialTaxKind | "";
  onChange: (value: CommercialTaxKind | "") => void;
  label: string;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

export default function CommercialTaxKindField({
  id,
  name,
  value,
  onChange,
  label,
  hint,
  placeholder,
  disabled,
  required = true,
  className,
}: Props) {
  const { t } = useT();

  return (
    <div className={cn(employeeDialogFieldClass, className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <label htmlFor={id} className={employeeDialogLabelClass}>
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </label>
      <Select
        value={value || undefined}
        onValueChange={(next) => {
          if (isCommercialTaxKind(next)) onChange(next);
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} className={cn(employeeSelectTriggerClass, "w-full")}>
          <SelectValue placeholder={placeholder ?? label}>
            {(selected) =>
              isCommercialTaxKind(selected)
                ? t(commercialTaxKindLabelKey(selected))
                : (placeholder ?? label)
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {commercialTaxKindPickerOptions(value).map((kind) => (
            <SelectItem key={kind} value={kind}>
              {t(commercialTaxKindLabelKey(kind))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <p className={employeeDialogHintClass}>{hint}</p> : null}
    </div>
  );
}
