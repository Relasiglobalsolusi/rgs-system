import type { ConfirmRequest } from "@/components/ui/confirm-dialog";
import { formatContractPrice } from "@/lib/project-billing";
import {
  formatKmPerLitreRange,
  formatLitres,
  formatLitresRange,
  formatOdometerKm,
  type FuelFillPreview,
} from "@/lib/vehicle-odometer";

type Translate = (key: string, params?: Record<string, string | number>) => string;

export function fuelFillConfirmRequest(
  t: Translate,
  preview: FuelFillPreview,
  amount?: number | null
): ConfirmRequest {
  const lines = preview.isFirstFuelFill
    ? [
        t("pages.vehicles.odometer.confirmPlate", { plate: preview.plate }),
        t("pages.vehicles.odometer.confirmCurrent", {
          km: formatOdometerKm(preview.readingKm),
        }),
        t("pages.vehicles.odometer.confirmFirstFill"),
        t("pages.vehicles.odometer.confirmEconomy", {
          range: formatKmPerLitreRange(
            preview.kmPerLitreMin,
            preview.kmPerLitreMax
          ),
        }),
        preview.tankLitres != null
          ? t("pages.vehicles.odometer.confirmCatalogTank", {
              tank: formatLitres(preview.tankLitres),
              limit: formatLitres(preview.tankLimitLitres),
            })
          : null,
        t("pages.vehicles.odometer.confirmThisFill", {
          litres: formatLitres(preview.litresFilled),
        }),
        t("pages.vehicles.odometer.confirmLeftAfter", {
          litres: formatLitresRange(
            preview.fuelLeftAfterMin,
            preview.fuelLeftAfterMax
          ),
        }),
        preview.expectedKmMin != null && preview.expectedKmMax != null
          ? t("pages.vehicles.odometer.confirmRemainingRange", {
              min: formatOdometerKm(preview.expectedKmMin),
              max: formatOdometerKm(preview.expectedKmMax),
            })
          : null,
        amount != null && amount > 0
          ? t("pages.vehicles.odometer.confirmAmount", {
              amount: formatContractPrice(amount),
            })
          : null,
        "",
        t("pages.vehicles.odometer.confirmRecheck"),
      ]
    : [
        t("pages.vehicles.odometer.confirmPlate", { plate: preview.plate }),
        t("pages.vehicles.odometer.confirmPrevious", {
          km: formatOdometerKm(preview.previousKm),
        }),
        t("pages.vehicles.odometer.confirmCurrent", {
          km: formatOdometerKm(preview.readingKm),
        }),
        preview.kmTraveled != null
          ? t("pages.vehicles.odometer.confirmDistance", {
              km: formatOdometerKm(preview.kmTraveled),
            })
          : null,
        t("pages.vehicles.odometer.confirmEconomy", {
          range: formatKmPerLitreRange(
            preview.kmPerLitreMin,
            preview.kmPerLitreMax
          ),
        }),
        preview.tankLitres != null
          ? t("pages.vehicles.odometer.confirmCatalogTank", {
              tank: formatLitres(preview.tankLitres),
              limit: formatLitres(preview.tankLimitLitres),
            })
          : null,
        preview.fuelUsedMin != null
          ? t("pages.vehicles.odometer.confirmUsed", {
              litres: formatLitresRange(
                preview.fuelUsedMin,
                preview.fuelUsedMax
              ),
            })
          : null,
        preview.fuelLeftBeforeMin != null
          ? t("pages.vehicles.odometer.confirmLeftBefore", {
              litres: formatLitresRange(
                preview.fuelLeftBeforeMin,
                preview.fuelLeftBeforeMax
              ),
            })
          : null,
        t("pages.vehicles.odometer.confirmThisFill", {
          litres: formatLitres(preview.litresFilled),
        }),
        t("pages.vehicles.odometer.confirmLeftAfter", {
          litres: formatLitresRange(
            preview.fuelLeftAfterMin,
            preview.fuelLeftAfterMax
          ),
        }),
        preview.expectedKmMin != null && preview.expectedKmMax != null
          ? t("pages.vehicles.odometer.confirmRemainingRange", {
              min: formatOdometerKm(preview.expectedKmMin),
              max: formatOdometerKm(preview.expectedKmMax),
            })
          : null,
        amount != null && amount > 0
          ? t("pages.vehicles.odometer.confirmAmount", {
              amount: formatContractPrice(amount),
            })
          : null,
        "",
        preview.flagReason === "SHORT_INTERVAL"
          ? t("pages.vehicles.odometer.confirmWarningShort", {
              traveled: formatOdometerKm(preview.kmTraveled),
              last: formatLitres(preview.tankLitres),
              expected:
                preview.tankLitres != null
                  ? `${formatOdometerKm(
                      Math.round(preview.tankLitres * preview.kmPerLitreMin)
                    )}–${formatOdometerKm(
                      Math.round(preview.tankLitres * preview.kmPerLitreMax)
                    )}`
                  : "—",
              left: formatLitresRange(
                preview.fuelLeftBeforeMin,
                preview.fuelLeftBeforeMax
              ),
            })
          : preview.flagReason === "OVER_USE"
            ? t("pages.vehicles.odometer.confirmWarningLong", {
                traveled: formatOdometerKm(preview.kmTraveled),
                left: formatLitresRange(
                  preview.fuelLeftBeforeMin,
                  preview.fuelLeftBeforeMax
                ),
                used: formatLitresRange(
                  preview.fuelUsedMin,
                  preview.fuelUsedMax
                ),
              })
            : t("pages.vehicles.odometer.confirmRecheck"),
      ];

  return {
    title: t("pages.vehicles.odometer.confirmTitle"),
    description: lines.filter((line) => line != null).join("\n"),
    confirmLabel: t("pages.vehicles.odometer.confirmPost"),
    cancelLabel: t("pages.vehicles.odometer.confirmBack"),
    tone: preview.flagged ? "danger" : "primary",
    layout: "recap",
  };
}
