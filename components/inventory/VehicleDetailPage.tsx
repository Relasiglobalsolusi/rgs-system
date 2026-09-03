"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Car } from "lucide-react";
import { toast } from "sonner";

import { updateVehicleAsset } from "@/app/inventory/actions";
import type {
  InventoryOverviewAssetRow,
  VehicleCostLogEntry,
  VehicleOdometerLogEntry,
} from "@/components/inventory/inventory-types";
import BackLink from "@/components/ui/BackLink";
import type { PrepaidFuelSpend } from "@/lib/prepaid-card-query";
import { formatPrepaidFuelMonth } from "@/lib/prepaid-card-query";
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
import { vehicleExpenseNarrative } from "@/lib/vehicle-expense";
import type { VehicleLeaseProgress } from "@/lib/vehicle-lease";
import {
  DEFAULT_KM_PER_LITRE_MAX,
  DEFAULT_KM_PER_LITRE_MIN,
  formatKmPerLitreRange,
  formatLitres,
  formatLitresRange,
  formatOdometerKm,
  remainingKmOf,
} from "@/lib/vehicle-odometer";

type Props = {
  vehicle: InventoryOverviewAssetRow;
  costLog: VehicleCostLogEntry[];
  costLogTotal: number;
  odometerLog: VehicleOdometerLogEntry[];
  leaseProgress: VehicleLeaseProgress | null;
  fuelSpend: PrepaidFuelSpend;
  canManage: boolean;
};

function Fact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-text">{value}</dd>
    </div>
  );
}

export default function VehicleDetailPage({
  vehicle,
  costLog,
  costLogTotal,
  odometerLog,
  leaseProgress,
  fuelSpend,
  canManage,
}: Props) {
  const { t, locale, bcp47 } = useT();
  const [pending, startTransition] = useTransition();
  const [plate, setPlate] = useState(vehicle.assetCode);
  const [initialOdometer, setInitialOdometer] = useState(
    vehicle.initialOdometerKm != null ? String(vehicle.initialOdometerKm) : ""
  );
  const initialLocked = Boolean(vehicle.hasOdometerReadings);

  function submit(formData: FormData) {
    formData.set("assetId", vehicle.id);
    formData.set("vehiclePlate", plate);
    if (initialOdometer.trim()) {
      formData.set("initialOdometerKm", initialOdometer);
    }
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

  const conditionLabel =
    vehicle.vehicleCondition === "NEW"
      ? t("pages.billing.purchaseVehicleConditionNew")
      : vehicle.vehicleCondition === "USED"
        ? t("pages.billing.purchaseVehicleConditionUsed")
        : "—";

  const vehicleName = vehicle.item?.name ?? t("modules.inventory");
  const leftoverMin = vehicle.estimatedFuelLeftLitresMin ?? null;
  const leftoverMax = vehicle.estimatedFuelLeftLitresMax ?? leftoverMin;
  const remainingRange =
    leftoverMin != null && leftoverMax != null
      ? remainingKmOf(leftoverMin, leftoverMax, {
          min: vehicle.kmPerLitreMin ?? DEFAULT_KM_PER_LITRE_MIN,
          max: vehicle.kmPerLitreMax ?? DEFAULT_KM_PER_LITRE_MAX,
        })
      : null;

  return (
    <div className="space-y-4">
      <BackLink href="/inventory">{t("pages.inventory.vehicles.back")}</BackLink>

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
          <Fact
            label={t("pages.inventory.columns.dateBought")}
            value={formatDisplayDate(vehicle.createdAt)}
          />
          {leaseProgress ? (
            <Fact
              label={t("pages.inventory.vehicles.leaseCarTotal")}
              value={formatContractPrice(leaseProgress.scheduledTotalCost)}
            />
          ) : (
            <Fact
              label={t("pages.inventory.columns.unitCost")}
              value={
                vehicle.unitCost != null
                  ? formatContractPrice(vehicle.unitCost)
                  : "—"
              }
            />
          )}
          <Fact
            label={t("pages.inventory.overview.location")}
            value={location}
          />
          <Fact
            label={t("pages.inventory.form.vehicleYear")}
            value={
              vehicle.vehicleYear != null ? String(vehicle.vehicleYear) : "—"
            }
          />
          <Fact
            label={t("pages.billing.purchaseVehicleCondition")}
            value={conditionLabel}
          />
          <Fact
            label={t("pages.billing.purchaseVehicleLease")}
            value={
              vehicle.isVehicleLease
                ? t("common.actions.yes")
                : t("common.actions.no")
            }
          />
          <Fact
            label={t("pages.vehicles.odometer.current")}
            value={formatOdometerKm(vehicle.currentOdometerKm ?? vehicle.initialOdometerKm)}
          />
          <Fact
            label={t("pages.vehicles.odometer.kmPerLitre")}
            value={formatKmPerLitreRange(
              vehicle.kmPerLitreMin,
              vehicle.kmPerLitreMax
            )}
          />
          <Fact
            label={t("pages.vehicles.odometer.fuelTank")}
            value={formatLitres(vehicle.tankLitres)}
          />
          <Fact
            label={t("pages.vehicles.odometer.fuelLeft")}
            value={formatLitresRange(
              vehicle.estimatedFuelLeftLitresMin,
              vehicle.estimatedFuelLeftLitresMax
            )}
          />
          <Fact
            label={t("pages.vehicles.odometer.remainingRange")}
            value={
              remainingRange
                ? `${formatOdometerKm(remainingRange.min)}–${formatOdometerKm(remainingRange.max)}`
                : "—"
            }
          />
        </dl>
        <p className={employeeDialogHintClass}>
          {t("pages.inventory.vehicles.purchaseFactsHint")}
        </p>

        {canManage ? (
          <form action={submit} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <label className={employeeDialogLabelClass} htmlFor="vehicle-initial-odometer">
                {t("pages.vehicles.odometer.initial")}
              </label>
              <input
                id="vehicle-initial-odometer"
                name="initialOdometerKm"
                inputMode="numeric"
                autoComplete="off"
                disabled={initialLocked}
                value={initialOdometer}
                onChange={(event) =>
                  setInitialOdometer(event.target.value.replace(/[^\d]/g, ""))
                }
                className={employeeInputClass}
                placeholder={t("pages.vehicles.odometer.placeholder")}
              />
              <p className={employeeDialogHintClass}>
                {initialLocked
                  ? t("pages.vehicles.odometer.initialLockedHint")
                  : t("pages.vehicles.odometer.initialHint")}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className={employeeDialogHintClass}>
                {t("pages.vehicles.odometer.rangeLockedHint")}
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
          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Fact
              label={t("pages.inventory.form.vehiclePlate")}
              value={vehicle.assetCode}
            />
            <Fact
              label={t("pages.vehicles.odometer.initial")}
              value={formatOdometerKm(vehicle.initialOdometerKm)}
            />
            <Fact
              label={t("pages.vehicles.odometer.kmPerLitre")}
              value={formatKmPerLitreRange(
                vehicle.kmPerLitreMin,
                vehicle.kmPerLitreMax
              )}
            />
          </dl>
        )}
      </SectionCard>

      <SectionCard>
        <div className="mb-3">
          <p className="text-sm font-semibold text-text">
            {t("pages.vehicles.odometer.logTitle")}
          </p>
          <p className={employeeDialogHintClass}>
            {t("pages.vehicles.odometer.logHint")}
          </p>
        </div>
        {odometerLog.length === 0 ? (
          <p className="text-sm text-muted">
            {t("pages.vehicles.odometer.logEmpty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-subtle">
                  <th className="py-2 pr-4">{t("pages.vehicles.odometer.logDate")}</th>
                  <th className="py-2 pr-4">{t("pages.vehicles.odometer.logReading")}</th>
                  <th className="py-2 pr-4">{t("pages.vehicles.odometer.logDistance")}</th>
                  <th className="py-2 pr-4">{t("pages.vehicles.odometer.logLitres")}</th>
                  <th className="py-2 pr-4">{t("pages.vehicles.odometer.logUsed")}</th>
                  <th className="py-2 pr-4">{t("pages.vehicles.odometer.logLeft")}</th>
                  <th className="py-2 pr-4">{t("pages.vehicles.odometer.logSource")}</th>
                  <th className="py-2">{t("pages.vehicles.odometer.logFlag")}</th>
                </tr>
              </thead>
              <tbody>
                {odometerLog.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-2 pr-4 text-text">
                      {formatDisplayDate(row.recordedAt)}
                    </td>
                    <td className="py-2 pr-4 text-text">
                      {formatOdometerKm(row.readingKm)}
                    </td>
                    <td className="py-2 pr-4 text-text">
                      {row.kind === "INITIAL"
                        ? t("pages.vehicles.odometer.kindInitial")
                        : formatOdometerKm(row.kmTraveled)}
                    </td>
                    <td className="py-2 pr-4 text-text">
                      {row.litresFilled != null
                        ? `${row.litresFilled.toLocaleString("id-ID", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })} L`
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-text">
                      {formatLitresRange(row.fuelUsedMin, row.fuelUsedMax)}
                    </td>
                    <td className="py-2 pr-4 text-text">
                      {formatLitresRange(
                        row.fuelLeftBeforeMin,
                        row.fuelLeftBeforeMax
                      )}
                    </td>
                    <td className="py-2 pr-4 text-muted">
                      {row.source === "PETTY_CASH"
                        ? t("pages.vehicles.odometer.sourcePetty")
                        : row.source === "PREPAID"
                          ? t("pages.vehicles.odometer.sourcePrepaid")
                          : row.source === "PURCHASE_INVOICE"
                            ? t("pages.vehicles.odometer.sourceExpense")
                            : t("pages.vehicles.odometer.sourceManual")}
                    </td>
                    <td className="py-2 text-warning">
                      {row.flagReason === "OVER_USE" ||
                      row.flagReason === "LONG_INTERVAL"
                        ? t("pages.vehicles.odometer.flaggedLong")
                        : row.flagReason === "OVER_FILL"
                          ? t("pages.vehicles.odometer.flaggedOverFill")
                          : row.flagged
                            ? t("pages.vehicles.odometer.flagged")
                            : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {leaseProgress ? (
        <SectionCard>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-text">
                {t("pages.inventory.vehicles.leaseTitle")}
              </p>
              <p className={employeeDialogHintClass}>
                {t("pages.inventory.vehicles.leaseProgress")}
              </p>
            </div>
            <p className="text-sm font-semibold text-text">
              {leaseProgress.paidOff
                ? t("pages.inventory.vehicles.leasePaidOff")
                : t("pages.inventory.vehicles.leaseInProgress")}
            </p>
          </div>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Fact
              label={t("pages.inventory.vehicles.leaseOtr")}
              value={formatContractPrice(leaseProgress.otrAmount)}
            />
            <Fact
              label={t("pages.billing.purchaseLeaseDownPayment")}
              value={formatContractPrice(leaseProgress.downPayment)}
            />
            <Fact
              label={t("pages.inventory.vehicles.leasePrincipal")}
              value={formatContractPrice(leaseProgress.principal)}
            />
            <Fact
              label={t("pages.billing.purchaseLeaseTenor")}
              value={String(leaseProgress.tenorMonths)}
            />
            <Fact
              label={t("pages.billing.purchaseLeaseInterest")}
              value={`${leaseProgress.interestPercentYear}%`}
            />
            <Fact
              label={t("pages.billing.purchaseLeaseMonthly")}
              value={formatContractPrice(leaseProgress.monthlyInstallment)}
            />
            {leaseProgress.adminFee > 0 ? (
              <Fact
                label={t("pages.billing.purchaseLeaseAdminFee")}
                value={formatContractPrice(leaseProgress.adminFee)}
              />
            ) : null}
            {leaseProgress.insuranceAmount > 0 ? (
              <Fact
                label={t("pages.billing.purchaseLeaseInsurance")}
                value={formatContractPrice(leaseProgress.insuranceAmount)}
              />
            ) : null}
            {leaseProgress.fiduciaryFee > 0 ? (
              <Fact
                label={t("pages.billing.purchaseLeaseFiduciary")}
                value={formatContractPrice(leaseProgress.fiduciaryFee)}
              />
            ) : null}
            {leaseProgress.provisionFee > 0 ? (
              <Fact
                label={t("pages.billing.purchaseLeaseProvision")}
                value={formatContractPrice(leaseProgress.provisionFee)}
              />
            ) : null}
            {leaseProgress.otherFee > 0 ? (
              <Fact
                label={t("pages.billing.purchaseLeaseOtherFee")}
                value={formatContractPrice(leaseProgress.otherFee)}
              />
            ) : null}
            <Fact
              label={t("pages.inventory.vehicles.leaseUpfrontFees")}
              value={formatContractPrice(leaseProgress.upfrontFees)}
            />
            <Fact
              label={t("pages.inventory.vehicles.leaseScheduledTotal")}
              value={formatContractPrice(leaseProgress.scheduledTotalCost)}
            />
            <Fact
              label={t("pages.inventory.vehicles.leaseProgress")}
              value={t("pages.inventory.vehicles.leasePaymentsCount", {
                paid: leaseProgress.installmentsPaidCount,
                tenor: leaseProgress.tenorMonths,
              })}
            />
            <Fact
              label={t("pages.inventory.vehicles.leasePaid")}
              value={formatContractPrice(leaseProgress.leaseCashPaid)}
            />
            <Fact
              label={t("pages.inventory.vehicles.leaseRemaining")}
              value={formatContractPrice(leaseProgress.remainingToPay)}
            />
            {leaseProgress.otherSpend > 0 ? (
              <Fact
                label={t("pages.inventory.vehicles.leaseOtherSpend")}
                value={formatContractPrice(leaseProgress.otherSpend)}
              />
            ) : null}
          </dl>
          <p className={`${employeeDialogHintClass} mt-3`}>
            {leaseProgress.paidOff
              ? t("pages.inventory.vehicles.leaseCarTotalDone")
              : t("pages.inventory.vehicles.leaseCarTotalHint")}
          </p>
        </SectionCard>
      ) : null}

      <SectionCard>
        <p className="text-sm font-semibold text-text">
          {t("pages.inventory.vehicles.fuelSpend")}
        </p>
        <p className="mt-2 text-xl font-semibold tracking-tight text-text">
          {t("pages.inventory.vehicles.fuelSpendTotal")}:{" "}
          {formatContractPrice(fuelSpend.total)}
        </p>
        {fuelSpend.months.length === 0 ? (
          <p className={`${employeeDialogHintClass} mt-2`}>
            {t("pages.inventory.vehicles.fuelSpendEmpty")}
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-base text-text">
            {fuelSpend.months.map((row) => (
              <li
                key={row.yearMonth}
                className="flex items-center justify-between gap-3"
              >
                <span>{formatPrepaidFuelMonth(row.yearMonth, bcp47)}</span>
                <span className="font-semibold tabular-nums">
                  {formatContractPrice(row.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard>
        <div className="mb-3">
          <p className="text-sm font-semibold text-text">
            {t("pages.inventory.vehicles.costLog")}
          </p>
          <p className={employeeDialogHintClass}>
            {t("pages.inventory.vehicles.costLogHint")}
          </p>
        </div>
        {costLog.length === 0 ? (
          <p className="text-sm text-muted">
            {t("pages.inventory.vehicles.costLogEmpty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                  <th className="py-2 pr-3">
                    {t("pages.inventory.vehicles.costLogDate")}
                  </th>
                  <th className="py-2 pr-3">
                    {t("pages.inventory.vehicles.costLogKind")}
                  </th>
                  <th className="py-2 pr-3">
                    {t("pages.inventory.vehicles.costLogSupplier")}
                  </th>
                  <th className="py-2 text-right">
                    {t("pages.inventory.vehicles.costLogAmount")}
                  </th>
                  {leaseProgress ? (
                    <th className="py-2 pl-3 text-right">
                      {t("pages.inventory.vehicles.costLogRemaining")}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {costLog.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/70">
                    <td className="py-2 pr-3 text-text">
                      {formatDisplayDate(entry.invoiceDate)}
                    </td>
                    <td className="py-2 pr-3 text-text">
                      <Link
                        href={`/billing/purchase-invoices/${entry.id}`}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {vehicleExpenseNarrative({
                          locale,
                          kind: entry.kind,
                          isLease:
                            entry.isVehicleLease ||
                            vehicle.isVehicleLease === true,
                          vehicleName,
                          plate: vehicle.assetCode,
                          otherDescription: entry.description,
                          installmentNumber: entry.installmentNumber,
                          tenorMonths:
                            entry.tenorMonths ?? vehicle.leaseTenorMonths,
                        })}
                      </Link>
                      {entry.invoiceRef ? (
                        <p className="text-xs text-muted">{entry.invoiceRef}</p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-text">{entry.supplierName}</td>
                    <td className="py-2 text-right tabular-nums text-text">
                      {formatContractPrice(entry.amount)}
                    </td>
                    {leaseProgress ? (
                      <td className="py-2 pl-3 text-right tabular-nums text-text">
                        {entry.kind === "PURCHASE" ||
                        entry.kind === "LEASE_PAYMENT"
                          ? entry.remainingAfter != null
                            ? formatContractPrice(entry.remainingAfter)
                            : "—"
                          : "—"}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td
                    colSpan={3}
                    className="pt-3 text-sm font-semibold text-text"
                  >
                    {t("pages.inventory.vehicles.costLogTotal")}
                  </td>
                  <td className="pt-3 text-right tabular-nums text-sm font-semibold text-text">
                    {formatContractPrice(costLogTotal)}
                  </td>
                  {leaseProgress ? <td /> : null}
                </tr>
                {leaseProgress ? (
                  <>
                    <tr>
                      <td
                        colSpan={3}
                        className="pt-1 text-sm font-semibold text-text"
                      >
                        {t("pages.inventory.vehicles.leaseRemaining")}
                      </td>
                      <td />
                      <td className="pt-1 text-right tabular-nums text-sm font-semibold text-text">
                        {formatContractPrice(leaseProgress.remainingToPay)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={3}
                        className="pt-1 text-sm font-semibold text-text"
                      >
                        {t("pages.inventory.vehicles.leaseCarTotal")}
                      </td>
                      <td className="pt-1 text-right tabular-nums text-sm font-semibold text-text">
                        {formatContractPrice(leaseProgress.scheduledTotalCost)}
                      </td>
                      <td />
                    </tr>
                  </>
                ) : null}
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
