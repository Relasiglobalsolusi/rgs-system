"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { acknowledgeVehicleFuelAlert } from "@/app/inventory/actions";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { formatDisplayDate } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";
import {
  formatLitresRange,
  formatOdometerKm,
} from "@/lib/vehicle-odometer";

export type FuelRangeAlertItem = {
  id: string;
  vehicleId: string;
  plate: string;
  vehicleName: string;
  kmTraveled: number | null;
  fuelLeftMin: number | null;
  fuelLeftMax: number | null;
  recordedAt: string;
};

export default function FuelRangeAlertBanner({
  alerts,
}: {
  alerts: FuelRangeAlertItem[];
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (alerts.length === 0) return null;

  function dismiss(id: string) {
    const formData = new FormData();
    formData.set("readingId", id);
    startTransition(async () => {
      try {
        await acknowledgeVehicleFuelAlert(formData);
        router.refresh();
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.vehicles.odometer.ackFailed")
        );
      }
    });
  }

  return (
    <SectionCard className="mb-6 border-amber-500/25 bg-card-tint-amber">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-semibold text-text">
              {alerts.length === 1
                ? t("pages.vehicles.odometer.alertTitleOne")
                : t("pages.vehicles.odometer.alertTitleMany", {
                    count: alerts.length,
                  })}
            </p>
            <p className="mt-1 text-sm text-muted">
              {t("pages.vehicles.odometer.alertHint")}
            </p>
          </div>
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <Link
                  href={`/inventory/vehicles/${alert.vehicleId}`}
                  className="min-w-0 font-medium text-text underline-offset-2 hover:underline"
                >
                  {alert.plate}
                  {alert.kmTraveled != null
                    ? ` · ${t("pages.vehicles.odometer.alertDistance", {
                        traveled: formatOdometerKm(alert.kmTraveled),
                        left: formatLitresRange(
                          alert.fuelLeftMin,
                          alert.fuelLeftMax
                        ),
                      })}`
                    : ""}
                  {` · ${formatDisplayDate(alert.recordedAt)}`}
                </Link>
                <Button
                  type="button"
                  variant="permissionsBadge"
                  size="badgeFlex"
                  disabled={pending}
                  onClick={() => dismiss(alert.id)}
                >
                  {t("pages.vehicles.odometer.acknowledge")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionCard>
  );
}
