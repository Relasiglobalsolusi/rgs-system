"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Car } from "lucide-react";
import { toast } from "sonner";

import { updateVehicleAsset } from "@/app/inventory/actions";
import type { InventoryOverviewAssetRow } from "@/components/inventory/inventory-types";
import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import SectionCard from "@/components/ui/SectionCard";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { formatDisplayDate } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

type Props = {
  vehicle: InventoryOverviewAssetRow;
  canManage: boolean;
};

export default function VehicleDetailPage({ vehicle, canManage }: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [plate, setPlate] = useState(vehicle.assetCode);
  const [year, setYear] = useState(
    vehicle.vehicleYear != null ? String(vehicle.vehicleYear) : ""
  );

  function submit(formData: FormData) {
    formData.set("assetId", vehicle.id);
    formData.set("vehiclePlate", plate);
    formData.set("vehicleYear", year);
    startTransition(async () => {
      try {
        await updateVehicleAsset(formData);
        toast.success(t("pages.inventory.vehicles.updated"));
      } catch (error) {
        showRejectionFromError(error, t("pages.inventory.vehicles.updateFailed"));
      }
    });
  }

  const location =
    vehicle.status === "ON_PROJECT"
      ? vehicle.project?.name ?? t("pages.inventory.overview.locationOnProject")
      : vehicle.status === "AVAILABLE"
        ? t("pages.inventory.vehicles.locationCompany")
        : vehicle.status === "IN_TRANSIT"
          ? t("pages.inventory.product.inTransit")
          : vehicle.status === "RETIRED"
            ? t("pages.inventory.overview.retired")
            : t("pages.inventory.vehicles.locationCompany");

  return (
    <div className="space-y-4">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        <ArrowLeft size={14} />
        {t("pages.inventory.vehicles.back")}
      </Link>

      <SectionCard>
        <div className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 rounded-lg bg-strip p-2 text-primary">
            <Car size={18} />
          </span>
          <div>
            <p className="font-mono text-lg font-semibold text-text">
              {vehicle.assetCode}
            </p>
            <p className="text-sm text-muted">{vehicle.item?.name ?? "—"}</p>
          </div>
        </div>

        <dl className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
              {t("pages.inventory.columns.dateBought")}
            </dt>
            <dd className="mt-1 text-sm text-text">
              {formatDisplayDate(vehicle.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
              {t("pages.inventory.columns.unitCost")}
            </dt>
            <dd className="mt-1 text-sm text-text">
              {vehicle.unitCost != null
                ? formatContractPrice(vehicle.unitCost)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
              {t("pages.inventory.overview.location")}
            </dt>
            <dd className="mt-1 text-sm text-text">{location}</dd>
          </div>
        </dl>

        {canManage ? (
          <form action={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass} htmlFor="vehicle-plate">
                {t("pages.inventory.form.vehiclePlate")}
              </label>
              <input
                id="vehicle-plate"
                name="vehiclePlate"
                value={plate}
                onChange={(event) => setPlate(event.target.value)}
                className={employeeInputClass}
                placeholder={t("pages.inventory.form.vehiclePlatePlaceholder")}
                autoComplete="off"
              />
              <p className={employeeDialogHintClass}>
                {t("pages.inventory.form.vehiclePlateEditHint")}
              </p>
            </div>
            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass} htmlFor="vehicle-year">
                {t("pages.inventory.form.vehicleYear")}
              </label>
              <input
                id="vehicle-year"
                name="vehicleYear"
                inputMode="numeric"
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className={employeeInputClass}
                placeholder={t("pages.inventory.form.vehicleYearPlaceholder")}
                autoComplete="off"
              />
              <p className={employeeDialogHintClass}>
                {t("pages.inventory.form.vehicleYearHint")}
              </p>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending
                  ? t("common.actions.saving")
                  : t("common.actions.save")}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                {t("pages.inventory.form.vehiclePlate")}
              </dt>
              <dd className="mt-1 font-mono text-sm text-text">
                {vehicle.assetCode}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                {t("pages.inventory.form.vehicleYear")}
              </dt>
              <dd className="mt-1 text-sm text-text">
                {vehicle.vehicleYear != null ? String(vehicle.vehicleYear) : "—"}
              </dd>
            </div>
          </dl>
        )}
      </SectionCard>
    </div>
  );
}
