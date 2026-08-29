"use client";

import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import YesNoChoiceCards from "@/components/ui/YesNoChoiceCards";
import {
  employeeDialogChoiceChipClass,
  employeeDialogChoiceGridClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Input } from "@/components/ui/input";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import { formatContractPrice } from "@/lib/project-billing";
import {
  calculateVehicleLease,
  VEHICLE_LEASE_TENOR_MONTHS,
} from "@/lib/vehicle-lease";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type VehicleConditionChoice = "" | "NEW" | "USED";

export type PurchaseVehicleLeaseDraft = {
  plateNumber: string;
  vehicleYear: string;
  condition: VehicleConditionChoice;
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
    condition: "",
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

export function applyVehicleLeaseDraftToFormData(
  formData: FormData,
  draft: PurchaseVehicleLeaseDraft
) {
  if (draft.plateNumber.trim()) {
    formData.set("vehiclePlate", draft.plateNumber);
  }
  if (draft.vehicleYear.trim()) {
    formData.set("vehicleYear", draft.vehicleYear);
  }
  if (draft.condition) {
    formData.set("vehicleCondition", draft.condition);
  }
  formData.set("isVehicleLease", draft.enabled ? "true" : "false");
  if (draft.enabled) {
    formData.set("leaseOtrAmount", draft.otrAmount);
    formData.set("leaseDownPayment", draft.downPayment);
    formData.set("leaseTenorMonths", draft.tenorMonths);
    formData.set("leaseInterestPercentYear", draft.interestPercentYear);
    formData.set("leaseAdminFee", draft.adminFee);
    formData.set("leaseInsuranceAmount", draft.insuranceAmount);
    formData.set("leaseFiduciaryFee", draft.fiduciaryFee);
    formData.set("leaseProvisionFee", draft.provisionFee);
    formData.set("leaseOtherFee", draft.otherFee);
  }
}

type Props = {
  draft: PurchaseVehicleLeaseDraft;
  onChange: (draft: PurchaseVehicleLeaseDraft) => void;
  disabled?: boolean;
  /** Hide plate and year when those fields live on the parent form. */
  showIdentity?: boolean;
  /** Show the required mark on New Or Used. Default true. */
  requireCondition?: boolean;
};

function moneyNumber(raw: string): number {
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function PurchaseVehicleLeaseFields({
  draft,
  onChange,
  disabled,
  showIdentity = true,
  requireCondition = true,
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
      {showIdentity ? (
        <>
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
        </>
      ) : null}

      <div>
        <p
          id="vehicle-condition-label"
          className="text-sm font-semibold text-text"
        >
          {t("pages.billing.purchaseVehicleCondition")}
          {requireCondition ? <span className="text-danger"> *</span> : null}
        </p>
        <p className={employeeDialogHintClass}>
          {t("pages.billing.purchaseVehicleConditionHint")}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby="vehicle-condition-label"
        className={employeeDialogChoiceGridClass}
      >
        {(
          [
            ["NEW", "pages.billing.purchaseVehicleConditionNew"],
            ["USED", "pages.billing.purchaseVehicleConditionUsed"],
          ] as const
        ).map(([value, labelKey]) => {
          const active = draft.condition === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => {
                if (!disabled) patch({ condition: value });
              }}
              className={cn(
                employeeDialogChoiceChipClass,
                "gap-1.5 duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                active &&
                  value === "NEW" &&
                  outlineChipTones.emeraldInteractive,
                active &&
                  value === "USED" &&
                  outlineChipTones.warningInteractive,
                !active &&
                  "border border-border bg-elevated text-muted hover:border-border-strong hover:bg-card-hover hover:text-text",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              {t(labelKey)}
            </button>
          );
        })}
      </div>

      <div>
        <p
          id="vehicle-lease-label"
          className="text-sm font-semibold text-text"
        >
          {t("pages.billing.purchaseVehicleLease")}
        </p>
        <p className={employeeDialogHintClass}>
          {t("pages.billing.purchaseVehicleLeaseHint")}
        </p>
      </div>
      <YesNoChoiceCards
        id="vehicle-lease-choice"
        labelledBy="vehicle-lease-label"
        value={draft.enabled ? "Yes" : "No"}
        disabled={disabled}
        onChange={(value) => patch({ enabled: value === "Yes" })}
      />
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
