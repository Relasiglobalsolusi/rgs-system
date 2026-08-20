"use client";

import type { BillingPeriodBasis } from "@prisma/client";

import {
  employeeDialogFieldClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import ProjectOptionPills from "@/components/projects/ProjectOptionPills";
import { useT } from "@/lib/i18n/use-t";

const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

type Props = {
  billingPeriodBasis: BillingPeriodBasis;
  onBillingPeriodBasisChange: (value: BillingPeriodBasis) => void;
  fromDay: number;
  toDay: number;
  onFromDayChange: (value: number) => void;
  onToDayChange: (value: number) => void;
  namePrefix?: string;
  idPrefix?: string;
};

export default function BillingPeriodBasisFields({
  billingPeriodBasis,
  onBillingPeriodBasisChange,
  fromDay,
  toDay,
  onFromDayChange,
  onToDayChange,
  namePrefix = "",
  idPrefix = "",
}: Props) {
  const { t } = useT();
  const nameOf = (field: string) =>
    namePrefix ? `${namePrefix}${field}` : field;
  const idOf = (field: string) => (idPrefix ? `${idPrefix}${field}` : field);
  const isCustomPeriod = billingPeriodBasis === "CONTRACT_CYCLE";

  return (
    <>
      <ProjectOptionPills
        label={t("pages.projects.billingPeriodBasis")}
        value={billingPeriodBasis}
        options={[
          {
            value: "CALENDAR_MONTH",
            label: t("pages.projects.billingPeriodBasisCalendarMonth"),
          },
          {
            value: "CONTRACT_CYCLE",
            label: t("pages.projects.billingPeriodBasisContractCycle"),
          },
        ]}
        onChange={(value) =>
          onBillingPeriodBasisChange(value as BillingPeriodBasis)
        }
        columns={2}
      />
      <p className="text-xs text-subtle">
        {t("pages.projects.billingPeriodBasisHelp")}
      </p>
      {isCustomPeriod ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className={employeeDialogFieldClass}>
            <label
              className="text-sm font-medium text-text"
              htmlFor={idOf("billingCycleStartDay")}
            >
              {t("pages.projects.billingCycleFromDay")}
            </label>
            <select
              id={idOf("billingCycleStartDay")}
              name={nameOf("billingCycleStartDay")}
              required
              value={fromDay}
              onChange={(event) => onFromDayChange(Number(event.target.value))}
              className={employeeInputClass}
            >
              {MONTH_DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
          <div className={employeeDialogFieldClass}>
            <label
              className="text-sm font-medium text-text"
              htmlFor={idOf("billingCycleEndDay")}
            >
              {t("pages.projects.billingCycleToDay")}
            </label>
            <select
              id={idOf("billingCycleEndDay")}
              name={nameOf("billingCycleEndDay")}
              required
              value={toDay}
              onChange={(event) => onToDayChange(Number(event.target.value))}
              className={employeeInputClass}
            >
              {MONTH_DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </>
  );
}
