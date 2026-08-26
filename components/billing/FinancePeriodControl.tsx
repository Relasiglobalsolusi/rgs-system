"use client";

import { useMemo, useTransition, type ReactNode } from "react";

import { FinancePeriodToolbar } from "@/components/billing/finance-toolbar";

import { employeeSelectTriggerClass } from "@/components/employees/employee-dialog-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FinancePeriod } from "@/lib/finance-period";
import { useT } from "@/lib/i18n/use-t";
import { daysInUtcMonth } from "@/lib/vat";
import { cn } from "@/lib/utils";

type Props = {
  year: number;
  month: number | null;
  day?: number | null;
  idPrefix: string;
  periodLabel: string;
  onNavigate: (next: FinancePeriod) => void;
  action?: ReactNode;
};

export default function FinancePeriodControl({
  year,
  month,
  day = null,
  idPrefix,
  periodLabel,
  onNavigate,
  action,
}: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const wholeYear = month == null;

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => index + 1),
    []
  );
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from(
      new Set([
        ...Array.from({ length: 8 }, (_, i) => currentYear - 5 + i),
        year,
      ])
    ).sort((a, b) => a - b);
  }, [year]);

  const dayOptions = useMemo(
    () =>
      month == null
        ? []
        : Array.from({ length: daysInUtcMonth(year, month) }, (_, index) => index + 1),
    [year, month]
  );

  function navigate(next: FinancePeriod) {
    startTransition(() => {
      onNavigate(next);
    });
  }

  return (
    <FinancePeriodToolbar
      label={periodLabel}
      action={action}
      className={cn(pending && "pointer-events-none opacity-70")}
    >
          <Select
            value={day == null || wholeYear ? "all" : String(day)}
            disabled={wholeYear}
            onValueChange={(value) => {
              if (value == null || month == null) return;
              navigate({
                year,
                month,
                day: value === "all" ? null : Number(value),
              });
            }}
          >
            <SelectTrigger
              id={`${idPrefix}-picker-day`}
              aria-label={t("common.labels.dates")}
              className={cn(
                employeeSelectTriggerClass,
                "w-full min-w-0 sm:w-auto sm:min-w-[11.5rem] *:data-[slot=select-value]:overflow-visible"
              )}
            >
              <SelectValue>
                {() =>
                  wholeYear
                    ? t("common.labels.wholeYear")
                    : day == null
                      ? t("common.labels.wholeMonth")
                      : String(day)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.labels.wholeMonth")}</SelectItem>
              {dayOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={month == null ? "all" : String(month)}
            onValueChange={(value) => {
              if (value == null) return;
              if (value === "all") {
                navigate({ year, month: null, day: null });
                return;
              }
              const nextMonth = Number(value);
              const maxDay = daysInUtcMonth(year, nextMonth);
              navigate({
                year,
                month: nextMonth,
                day: day != null && day > maxDay ? null : day,
              });
            }}
          >
            <SelectTrigger
              id={`${idPrefix}-picker-month`}
              aria-label={t("common.labels.month")}
              className={cn(
                employeeSelectTriggerClass,
                "w-full min-w-0 sm:w-auto sm:min-w-[12rem] *:data-[slot=select-value]:overflow-visible"
              )}
            >
              <SelectValue>
                {(value) =>
                  !value || value === "all"
                    ? t("common.labels.wholeYear")
                    : t(`pages.reports.months.${value}`)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.labels.wholeYear")}</SelectItem>
              {monthOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {t(`pages.reports.months.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(year)}
            onValueChange={(value) => {
              if (value == null) return;
              const nextYear = Number(value);
              if (month == null) {
                navigate({ year: nextYear, month: null, day: null });
                return;
              }
              const maxDay = daysInUtcMonth(nextYear, month);
              navigate({
                year: nextYear,
                month,
                day: day != null && day > maxDay ? null : day,
              });
            }}
          >
            <SelectTrigger
              id={`${idPrefix}-picker-year`}
              aria-label={t("common.labels.year")}
              className={cn(
                employeeSelectTriggerClass,
                "w-full min-w-0 sm:w-auto sm:min-w-[6.75rem] *:data-[slot=select-value]:overflow-visible"
              )}
            >
              <SelectValue>
                {(value) => value ?? t("common.labels.year")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
    </FinancePeriodToolbar>
  );
}
