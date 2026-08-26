"use client";

import { useMemo, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { FinancePeriodToolbar } from "@/components/billing/finance-toolbar";
import { employeeSelectTriggerClass } from "@/components/employees/employee-dialog-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { jakartaYearMonthDay } from "@/lib/internal-payroll-period";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  year: number;
  month: number;
  action?: ReactNode;
};

export default function BpjsPeriodControl({ year, month, action }: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => index + 1),
    []
  );
  const yearOptions = useMemo(() => {
    const currentYear = jakartaYearMonthDay().year;
    return Array.from(
      new Set([
        ...Array.from({ length: 8 }, (_, index) => currentYear - 5 + index),
        year,
      ])
    ).sort((a, b) => a - b);
  }, [year]);

  function navigatePeriod(nextYear: number, nextMonth: number) {
    const params = new URLSearchParams({
      year: String(nextYear),
      month: String(nextMonth),
    });
    startTransition(() => {
      router.push(`/billing/bpjs?${params.toString()}`);
    });
  }

  return (
    <FinancePeriodToolbar
      label={t("pages.bpjs.period")}
      action={action}
      className={cn(pending && "pointer-events-none opacity-70")}
    >
          <Select
            value={String(month) || null}
            onValueChange={(value) => {
              if (value != null) navigatePeriod(year, Number(value));
            }}
          >
            <SelectTrigger
              id="bpjs-picker-month"
              aria-label={t("common.labels.month")}
              className={cn(employeeSelectTriggerClass, "w-[10rem]")}
            >
              <SelectValue>
                {(value) =>
                  value
                    ? t(`pages.reports.months.${value}`)
                    : t("common.labels.month")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {t(`pages.reports.months.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(year) || null}
            onValueChange={(value) => {
              if (value != null) navigatePeriod(Number(value), month);
            }}
          >
            <SelectTrigger
              id="bpjs-picker-year"
              aria-label={t("common.labels.year")}
              className={cn(employeeSelectTriggerClass, "w-[6.5rem]")}
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
