"use client";

import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import {
  formatKmPerLitreRange,
  formatLitres,
  formatLitresRange,
  formatOdometerKm,
  parseLitres,
  parseOdometerKm,
  previewFuelFill,
  type VehicleOdometerOption,
} from "@/lib/vehicle-odometer";

export default function VehicleOdometerFields({
  vehicle,
  odometerKm,
  onOdometerChange,
  litres,
  onLitresChange,
  disabled = false,
  className,
}: {
  vehicle: VehicleOdometerOption | null;
  odometerKm: string;
  onOdometerChange: (value: string) => void;
  litres: string;
  onLitresChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const readingKm = parseOdometerKm(odometerKm);
  const litresFilled = parseLitres(litres);
  const isFirstFuelFill =
    vehicle != null &&
    vehicle.lastFillLitres == null &&
    vehicle.fuelLeftMin == null &&
    vehicle.fuelLeftMax == null;
  let liveHint = isFirstFuelFill
    ? t("pages.vehicles.odometer.firstReadingHint")
    : vehicle?.lastOdometerKm != null
      ? t("pages.vehicles.odometer.lastReadingHint", {
          km: formatOdometerKm(vehicle.lastOdometerKm),
          range: formatKmPerLitreRange(
            vehicle.kmPerLitreMin,
            vehicle.kmPerLitreMax
          ),
        })
      : t("pages.vehicles.odometer.firstReadingHint");
  if (vehicle && readingKm != null && litresFilled != null) {
    try {
      const preview = previewFuelFill({
        vehicle,
        readingKm,
        litresFilled,
      });
      if (preview.flagReason === "OVER_FILL") {
        liveHint = t("pages.vehicles.odometer.tankOverCapacity", {
          tank: formatLitres(preview.tankLitres),
          limit: formatLitres(preview.tankLimitLitres),
        });
      } else if (preview.isFirstFuelFill) {
        liveHint = t("pages.vehicles.odometer.firstReadingFuelHint", {
          litres: preview.litresFilled.toLocaleString("id-ID", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }),
          min: formatOdometerKm(preview.expectedKmMin),
          max: formatOdometerKm(preview.expectedKmMax),
        });
      } else if (
        preview.fuelUsedMin != null &&
        preview.fuelLeftBeforeMin != null
      ) {
        liveHint = t("pages.vehicles.odometer.lastReadingFuelHint", {
          km: formatOdometerKm(vehicle.lastOdometerKm),
          used: formatLitresRange(preview.fuelUsedMin, preview.fuelUsedMax),
          left: formatLitresRange(
            preview.fuelLeftBeforeMin,
            preview.fuelLeftBeforeMax
          ),
        });
      }
    } catch {
      liveHint = t("pages.vehicles.odometer.wentBack");
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className={employeeDialogFieldClass}>
        <label className={employeeDialogLabelClass} htmlFor="vehicle-odometer-km">
          {t("pages.vehicles.odometer.current")}
          <span className="text-red-400"> *</span>
        </label>
        <Input
          id="vehicle-odometer-km"
          name="odometerKm"
          inputMode="numeric"
          autoComplete="off"
          required
          disabled={disabled}
          value={odometerKm}
          onChange={(event) =>
            onOdometerChange(event.target.value.replace(/[^\d]/g, ""))
          }
          placeholder={t("pages.vehicles.odometer.placeholder")}
          className={employeeInputClass}
          data-required-label={t("pages.vehicles.odometer.current")}
        />
        <p className={employeeDialogHintClass}>{liveHint}</p>
      </div>
      <div className={employeeDialogFieldClass}>
        <label className={employeeDialogLabelClass} htmlFor="vehicle-litres-filled">
          {t("pages.vehicles.odometer.litres")}
          <span className="text-red-400"> *</span>
        </label>
        <Input
          id="vehicle-litres-filled"
          name="litresFilled"
          inputMode="decimal"
          autoComplete="off"
          required
          disabled={disabled}
          value={litres}
          onChange={(event) =>
            onLitresChange(event.target.value.replace(/[^\d.,]/g, ""))
          }
          placeholder={t("pages.vehicles.odometer.litresPlaceholder")}
          className={employeeInputClass}
          data-required-label={t("pages.vehicles.odometer.litres")}
        />
        <p className={employeeDialogHintClass}>
          {isFirstFuelFill
            ? t("pages.vehicles.odometer.firstLitresHint")
            : t("pages.vehicles.odometer.litresHint")}
        </p>
      </div>
    </div>
  );
}
