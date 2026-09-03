"use client";

import {
  employeeDialogFieldClass,
  employeeDialogGridClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/use-t";

export default function VehicleKmPerLitreFields({
  minName = "kmPerLitreMin",
  maxName = "kmPerLitreMax",
  minValue,
  maxValue,
  defaultMin,
  defaultMax,
  defaultTank,
  onMinChange,
  onMaxChange,
  required = true,
  disabled = false,
  idPrefix = "km-l",
  hintKey = "pages.vehicles.odometer.kmPerLitreCatalogHint",
}: {
  minName?: string;
  maxName?: string;
  minValue?: string;
  maxValue?: string;
  defaultMin?: string;
  defaultMax?: string;
  defaultTank?: string;
  onMinChange?: (value: string) => void;
  onMaxChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  idPrefix?: string;
  hintKey?: string;
}) {
  const { t } = useT();
  const minId = `${idPrefix}-min`;
  const maxId = `${idPrefix}-max`;
  const controlled = onMinChange != null || onMaxChange != null;

  return (
    <div className="space-y-2.5">
      <div className={employeeDialogGridClass}>
        <div className={employeeDialogFieldClass}>
          <label className={employeeDialogLabelClass} htmlFor={minId}>
            {t("pages.vehicles.odometer.kmPerLitreMin")}
            {required ? <span className="text-red-400"> *</span> : null}
          </label>
          <Input
            id={minId}
            name={minName}
            inputMode="decimal"
            autoComplete="off"
            required={required}
            disabled={disabled}
            value={controlled ? (minValue ?? "") : undefined}
            defaultValue={controlled ? undefined : defaultMin}
            onChange={
              onMinChange
                ? (event) =>
                    onMinChange(event.target.value.replace(/[^\d.]/g, ""))
                : undefined
            }
            placeholder={t("pages.vehicles.odometer.kmPerLitrePlaceholder")}
            className={employeeInputClass}
            data-required-label={t("pages.vehicles.odometer.kmPerLitreMin")}
          />
        </div>
        <div className={employeeDialogFieldClass}>
          <label className={employeeDialogLabelClass} htmlFor={maxId}>
            {t("pages.vehicles.odometer.kmPerLitreMax")}
            {required ? <span className="text-red-400"> *</span> : null}
          </label>
          <Input
            id={maxId}
            name={maxName}
            inputMode="decimal"
            autoComplete="off"
            required={required}
            disabled={disabled}
            value={controlled ? (maxValue ?? "") : undefined}
            defaultValue={controlled ? undefined : defaultMax}
            onChange={
              onMaxChange
                ? (event) =>
                    onMaxChange(event.target.value.replace(/[^\d.]/g, ""))
                : undefined
            }
            placeholder={t("pages.vehicles.odometer.kmPerLitrePlaceholderHigh")}
            className={employeeInputClass}
            data-required-label={t("pages.vehicles.odometer.kmPerLitreMax")}
          />
        </div>
      </div>
      <p className={employeeDialogHintClass}>{t(hintKey)}</p>
      <div className={employeeDialogFieldClass}>
        <label className={employeeDialogLabelClass} htmlFor={`${idPrefix}-tank`}>
          {t("pages.vehicles.odometer.fuelTank")}
          {required ? <span className="text-red-400"> *</span> : null}
        </label>
        <Input
          id={`${idPrefix}-tank`}
          name="fuelTankLitres"
          inputMode="decimal"
          autoComplete="off"
          required={required}
          disabled={disabled}
          defaultValue={defaultTank}
          placeholder={t("pages.vehicles.odometer.fuelTankPlaceholder")}
          className={employeeInputClass}
          data-required-label={t("pages.vehicles.odometer.fuelTank")}
        />
        <p className={employeeDialogHintClass}>
          {t("pages.vehicles.odometer.fuelTankHint")}
        </p>
      </div>
    </div>
  );
}
