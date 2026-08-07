"use client";

import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Input } from "@/components/ui/input";
import { PAYMENT_TERMS_DAYS_OPTIONS } from "@/lib/invoice-period";
import { useT } from "@/lib/i18n/use-t";
import type { ProjectSubCategory } from "@prisma/client";

type Props = {
  subCategory: ProjectSubCategory | string;
  defaults?: {
    contractPrice?: number | null;
    setupCost?: number | null;
    profitSharePercent?: number | null;
    monthlyClientFee?: number | null;
    serviceFeePercent?: number | null;
    paymentTermsDays?: number | null;
  };
  /** Default payment terms when creating payroll (from selected client). */
  clientPaymentTermsDays?: number | null;
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
  clientPaymentTermsDays,
}: Props) {
  const { t } = useT();

  if (subCategory === "SECURITY") {
    return (
      <div className={employeeDialogFieldClass}>
        <label className="text-sm font-medium text-text">
          {t("pages.projects.serviceCommercial.monthlyFee")}
        </label>
        <Input
          name="contractPrice"
          type="number"
          min={0}
          step="1"
          required
          defaultValue={moneyDefault(defaults?.contractPrice)}
          placeholder="0"
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
          <Input
            name="setupCost"
            type="number"
            min={0}
            step="1"
            defaultValue={moneyDefault(defaults?.setupCost)}
            placeholder="0"
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
            name="profitSharePercent"
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
          <Input
            name="monthlyClientFee"
            type="number"
            min={0}
            step="1"
            defaultValue={moneyDefault(defaults?.monthlyClientFee)}
            placeholder="0"
            className={employeeInputClass}
          />
          <p className={employeeDialogHintClass}>
            {t("pages.projects.serviceCommercial.monthlyClientFeeHint")}
          </p>
        </div>
      </div>
    );
  }

  if (subCategory === "PAYROLL_MANAGEMENT") {
    const termsDefault =
      defaults?.paymentTermsDays != null &&
      (PAYMENT_TERMS_DAYS_OPTIONS as readonly number[]).includes(
        defaults.paymentTermsDays
      )
        ? defaults.paymentTermsDays
        : clientPaymentTermsDays != null &&
            (PAYMENT_TERMS_DAYS_OPTIONS as readonly number[]).includes(
              clientPaymentTermsDays
            )
          ? clientPaymentTermsDays
          : 14;

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
            name="serviceFeePercent"
            type="number"
            min={0}
            max={100}
            step="0.01"
            required
            defaultValue={percentDefault(defaults?.serviceFeePercent)}
            placeholder="6"
            className={employeeInputClass}
          />
          <p className={employeeDialogHintClass}>
            {t("pages.projects.serviceCommercial.serviceFeePercentHint")}
          </p>
        </div>
        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.projects.serviceCommercial.paymentTermsDays")}
          </label>
          <select
            name="paymentTermsDays"
            defaultValue={String(termsDefault)}
            className={employeeInputClass}
          >
            {PAYMENT_TERMS_DAYS_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days === 0
                  ? t("common.paymentTerms.cash")
                  : t("common.paymentTerms.net", { days })}
              </option>
            ))}
          </select>
          <p className={employeeDialogHintClass}>
            {t("pages.projects.serviceCommercial.paymentTermsDaysHint")}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
