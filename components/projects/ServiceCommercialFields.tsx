"use client";

import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { useT } from "@/lib/i18n/use-t";
import type { ProjectSubCategory } from "@prisma/client";

type Props = {
  subCategory: ProjectSubCategory | string;
  defaults?: {
    contractPrice?: number | null;
    setupCost?: number | null;
    profitSharePercent?: number | null;
    monthlyClientFee?: number | null;
    memberParkingUnitFee?: number | null;
    memberParkingUnitCount?: number | null;
    parkingTaxPercent?: number | null;
    serviceFeePercent?: number | null;
    paymentTermsDays?: number | null;
    payrollCutoffStartDay?: number | null;
    payrollCutoffEndDay?: number | null;
    payrollTaxPercent?: number | null;
  };
  /** Prefix field names (e.g. `line.0.`) for bulk create. */
  namePrefix?: string;
};

function moneyDefault(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(Math.round(value));
}

function percentDefault(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

export default function ServiceCommercialFields({
  subCategory,
  defaults,
  namePrefix = "",
}: Props) {
  const { t } = useT();
  const nameOf = (field: string) =>
    namePrefix ? `${namePrefix}${field}` : field;

  if (subCategory === "SECURITY") {
    return (
      <div className={employeeDialogFieldClass}>
        <label className="text-sm font-medium text-text">
          {t("pages.projects.serviceCommercial.monthlyFee")}
        </label>
        <MoneyInput
          name={nameOf("contractPrice")}
          required
          defaultValue={moneyDefault(defaults?.contractPrice)}
          className={employeeInputClass}
        />
        <p className={employeeDialogHintClass}>
          {t("pages.projects.serviceCommercial.monthlyFeeHint")}
        </p>
      </div>
    );
  }

  if (subCategory === "PARKING") {
    return (
      <div className="space-y-4">
        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.projects.serviceCommercial.setupCost")}
          </label>
          <MoneyInput
            name={nameOf("setupCost")}
            defaultValue={moneyDefault(defaults?.setupCost)}
            className={employeeInputClass}
          />
          <p className={employeeDialogHintClass}>
            {t("pages.projects.serviceCommercial.setupCostHint")}
          </p>
        </div>
        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.projects.serviceCommercial.profitSharePercent")}
          </label>
          <Input
            name={nameOf("profitSharePercent")}
            type="number"
            min={0}
            max={100}
            step="0.01"
            defaultValue={percentDefault(defaults?.profitSharePercent)}
            placeholder="0"
            className={employeeInputClass}
          />
          <p className={employeeDialogHintClass}>
            {t("pages.projects.serviceCommercial.profitSharePercentHint")}
          </p>
        </div>
        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.projects.serviceCommercial.monthlyClientFee")}
          </label>
          <MoneyInput
            name={nameOf("monthlyClientFee")}
            defaultValue={moneyDefault(defaults?.monthlyClientFee)}
            className={employeeInputClass}
          />
        </div>
        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.projects.serviceCommercial.memberParkingUnitFee")}
          </label>
          <MoneyInput
            name={nameOf("memberParkingUnitFee")}
            defaultValue={moneyDefault(defaults?.memberParkingUnitFee)}
            placeholder="10.000"
            className={employeeInputClass}
          />
          <p className={employeeDialogHintClass}>
            {t("pages.projects.serviceCommercial.memberParkingUnitFeeHint")}
          </p>
        </div>
        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.projects.serviceCommercial.memberParkingUnitCount")}
          </label>
          <Input
            name={nameOf("memberParkingUnitCount")}
            type="number"
            min={0}
            step="1"
            defaultValue={
              defaults?.memberParkingUnitCount != null
                ? String(defaults.memberParkingUnitCount)
                : ""
            }
            placeholder="0"
            className={employeeInputClass}
          />
          <p className={employeeDialogHintClass}>
            {t("pages.projects.serviceCommercial.memberParkingUnitCountHint")}
          </p>
        </div>
        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.projects.serviceCommercial.parkingTaxPercent")}
          </label>
          <Input
            name={nameOf("parkingTaxPercent")}
            type="number"
            min={0}
            max={100}
            step="0.01"
            defaultValue={percentDefault(defaults?.parkingTaxPercent ?? 10)}
            className={employeeInputClass}
          />
          <p className={employeeDialogHintClass}>
            {t("pages.projects.serviceCommercial.parkingTaxPercentHint")}
          </p>
        </div>
      </div>
    );
  }

  if (subCategory === "PAYROLL_MANAGEMENT") {
    return (
      <div className="space-y-4">
        <p className={employeeDialogHintClass}>
          {t("pages.projects.serviceCommercial.payrollEconomicsHint")}
        </p>
        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.projects.serviceCommercial.serviceFeePercent")}
          </label>
          <Input
            name={nameOf("serviceFeePercent")}
            type="number"
            min={0}
            max={100}
            step="0.01"
            required
            defaultValue={percentDefault(defaults?.serviceFeePercent)}
            placeholder=""
            className={employeeInputClass}
          />
          <p className={employeeDialogHintClass}>
            {t("pages.projects.serviceCommercial.serviceFeePercentHint")}
          </p>
        </div>
        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.projects.serviceCommercial.payrollTaxPercent")}
          </label>
          <Input
            name={nameOf("payrollTaxPercent")}
            type="number"
            min={0}
            max={100}
            step="0.01"
            defaultValue={percentDefault(defaults?.payrollTaxPercent ?? 11)}
            className={employeeInputClass}
          />
          <p className={employeeDialogHintClass}>
            {t("pages.projects.serviceCommercial.payrollTaxPercentHint")}
          </p>
        </div>
        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.projects.serviceCommercial.payrollCutoffEndDay")}
          </label>
          <Input
            name={nameOf("payrollCutoffEndDay")}
            type="number"
            min={1}
            max={31}
            required
            defaultValue={
              defaults?.payrollCutoffEndDay != null
                ? String(defaults.payrollCutoffEndDay)
                : ""
            }
            className={employeeInputClass}
          />
        </div>
        <p className={employeeDialogHintClass}>
          {t("pages.projects.serviceCommercial.payrollCutoffHint")}
        </p>
      </div>
    );
  }

  return null;
}
