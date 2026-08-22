"use client";

import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Input } from "@/components/ui/input";
import { formatContractPrice } from "@/lib/project-billing";
import {
  calculateVehicleLease,
  VEHICLE_LEASE_TENOR_MONTHS,
} from "@/lib/vehicle-lease";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type PurchaseVehicleLeaseDraft = {
  plateNumber: string;
  vehicleYear: string;
  enabled: boolean;
  otrAmount: string;
  downPayment: string;
  tenorMonths: string;
  interestPercentYear: string;
  adminFee: string;
  insuranceAmount: string;
  fiduciaryFee: string;
  provisionFee: string;
  otherFee: string;
};

export function emptyVehicleLeaseDraft(): PurchaseVehicleLeaseDraft {
  return {
    plateNumber: "",
    vehicleYear: "",
    enabled: false,
    otrAmount: "",
    downPayment: "",
    tenorMonths: "36",
    interestPercentYear: "12",
    adminFee: "",
    insuranceAmount: "",
    fiduciaryFee: "",
    provisionFee: "",
    otherFee: "",
  };
}

type Props = {
  draft: PurchaseVehicleLeaseDraft;
  onChange: (draft: PurchaseVehicleLeaseDraft) => void;
  disabled?: boolean;
};

function moneyNumber(raw: string): number {
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function PurchaseVehicleLeaseFields({
  draft,
  onChange,
  disabled,
}: Props) {
  const { t } = useT();
  const schedule = draft.enabled
    ? calculateVehicleLease({
        otrAmount: moneyNumber(draft.otrAmount),
        downPayment: moneyNumber(draft.downPayment),
        tenorMonths: Number(draft.tenorMonths) || 0,
        interestPercentYear: moneyNumber(draft.interestPercentYear),
        adminFee: moneyNumber(draft.adminFee),
        insuranceAmount: moneyNumber(draft.insuranceAmount),
        fiduciaryFee: moneyNumber(draft.fiduciaryFee),
        provisionFee: moneyNumber(draft.provisionFee),
        otherFee: moneyNumber(draft.otherFee),
      })
    : null;

  function patch(next: Partial<PurchaseVehicleLeaseDraft>) {
    onChange({ ...draft, ...next });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-elevated/40 p-3">
      <div>
        <p className="text-sm font-semibold text-text">
          {t("pages.billing.purchaseVehicleIdentity")}
        </p>
        <p className={employeeDialogHintClass}>
          {t("pages.billing.purchaseVehicleIdentityHint")}
        </p>
      </div>
      <div>
        <label className={employeeDialogLabelClass} htmlFor="vehicle-plate">
          {t("pages.billing.purchaseVehiclePlate")}
          <span className="text-danger"> *</span>
        </label>
        <Input
          id="vehicle-plate"
          disabled={disabled}
          value={draft.plateNumber}
          onChange={(event) => patch({ plateNumber: event.target.value })}
          className={employeeInputClass}
          placeholder={t("pages.billing.purchaseVehiclePlatePlaceholder")}
          autoComplete="off"
        />
        <p className={employeeDialogHintClass}>
          {t("pages.billing.purchaseVehiclePlateHint")}
        </p>
      </div>
      <div>
        <label className={employeeDialogLabelClass} htmlFor="vehicle-year">
          {t("pages.billing.purchaseVehicleYear")}
          <span className="text-danger"> *</span>
        </label>
        <Input
          id="vehicle-year"
          disabled={disabled}
          inputMode="numeric"
          value={draft.vehicleYear}
          onChange={(event) => patch({ vehicleYear: event.target.value })}
          className={employeeInputClass}
          placeholder={t("pages.billing.purchaseVehicleYearPlaceholder")}
          autoComplete="off"
        />
        <p className={employeeDialogHintClass}>
          {t("pages.billing.purchaseVehicleYearHint")}
        </p>
      </div>
      <div>
        <p className="text-sm font-semibold text-text">
          {t("pages.billing.purchaseVehicleLease")}
        </p>
        <p className={employeeDialogHintClass}>
          {t("pages.billing.purchaseVehicleLeaseHint")}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={draft.enabled}
          disabled={disabled}
          onChange={(event) => patch({ enabled: event.target.checked })}
        />
        {t("pages.billing.purchaseVehicleLeaseToggle")}
      </label>
      {draft.enabled ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={employeeDialogLabelClass}>
                {t("pages.billing.purchaseLeaseOtr")}
              </label>
              <MoneyInput
                disabled={disabled}
                value={draft.otrAmount}
                onValueChange={(value) => patch({ otrAmount: value })}
                className={employeeInputClass}
              />
            </div>
            <div>
              <label className={employeeDialogLabelClass}>
                {t("pages.billing.purchaseLeaseDownPayment")}
              </label>
              <MoneyInput
                disabled={disabled}
                value={draft.downPayment}
                onValueChange={(value) => patch({ downPayment: value })}
                className={employeeInputClass}
              />
            </div>
            <div>
              <label className={employeeDialogLabelClass}>
                {t("pages.billing.purchaseLeaseTenor")}
              </label>
              <Select
                value={draft.tenorMonths || null}
                onValueChange={(value) => {
                  if (value) patch({ tenorMonths: value });
                }}
                disabled={disabled}
              >
                <SelectTrigger className={cn(employeeSelectTriggerClass, "w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_LEASE_TENOR_MONTHS.map((months) => (
                    <SelectItem key={months} value={String(months)}>
                      {months}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={employeeDialogLabelClass}>
                {t("pages.billing.purchaseLeaseInterest")}
              </label>
              <Input
                inputMode="decimal"
                disabled={disabled}
                value={draft.interestPercentYear}
                onChange={(event) =>
                  patch({ interestPercentYear: event.target.value })
                }
                className={employeeInputClass}
              />
            </div>
            <div>
              <label className={employeeDialogLabelClass}>
                {t("pages.billing.purchaseLeaseAdminFee")}
              </label>
              <MoneyInput
                disabled={disabled}
                value={draft.adminFee}
                onValueChange={(value) => patch({ adminFee: value })}
                className={employeeInputClass}
              />
            </div>
            <div>
              <label className={employeeDialogLabelClass}>
                {t("pages.billing.purchaseLeaseInsurance")}
              </label>
              <MoneyInput
                disabled={disabled}
                value={draft.insuranceAmount}
                onValueChange={(value) => patch({ insuranceAmount: value })}
                className={employeeInputClass}
              />
            </div>
            <div>
              <label className={employeeDialogLabelClass}>
                {t("pages.billing.purchaseLeaseFiduciary")}
              </label>
              <MoneyInput
                disabled={disabled}
                value={draft.fiduciaryFee}
                onValueChange={(value) => patch({ fiduciaryFee: value })}
                className={employeeInputClass}
              />
            </div>
            <div>
              <label className={employeeDialogLabelClass}>
                {t("pages.billing.purchaseLeaseProvision")}
              </label>
              <MoneyInput
                disabled={disabled}
                value={draft.provisionFee}
                onValueChange={(value) => patch({ provisionFee: value })}
                className={employeeInputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={employeeDialogLabelClass}>
                {t("pages.billing.purchaseLeaseOtherFee")}
              </label>
              <MoneyInput
                disabled={disabled}
                value={draft.otherFee}
                onValueChange={(value) => patch({ otherFee: value })}
                className={employeeInputClass}
              />
            </div>
          </div>
          {schedule ? (
            <dl className="grid gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className="text-subtle">
                  {t("pages.billing.purchaseLeasePrincipal")}
                </dt>
                <dd className="tabular-nums font-semibold">
                  {formatContractPrice(schedule.principal)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-subtle">
                  {t("pages.billing.purchaseLeaseUpfront")}
                </dt>
                <dd className="tabular-nums font-semibold">
                  {formatContractPrice(schedule.upfrontAmount)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-subtle">
                  {t("pages.billing.purchaseLeaseMonthly")}
                </dt>
                <dd className="tabular-nums font-semibold">
                  {formatContractPrice(schedule.monthlyInstallment)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-subtle">
                  {t("pages.billing.purchaseLeaseTotal")}
                </dt>
                <dd className="tabular-nums font-semibold">
                  {formatContractPrice(schedule.totalCost)}
                </dd>
              </div>
            </dl>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
