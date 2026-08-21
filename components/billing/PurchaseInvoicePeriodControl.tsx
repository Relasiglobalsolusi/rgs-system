"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";

import { employeeSelectTriggerClass } from "@/components/employees/employee-dialog-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n/use-t";
import { daysInUtcMonth } from "@/lib/vat";
import { cn } from "@/lib/utils";

type Props = {
  year: number;
  month: number;
  day?: number | null;
  /** Preserve AP list view (`tax` / `payments`) when changing period. */
  view?: string | null;
};

export default function PurchaseInvoicePeriodControl({
  year,
  month,
  day = null,
  view,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
    () => Array.from({ length: daysInUtcMonth(year, month) }, (_, index) => index + 1),
    [year, month]
  );

  function navigatePeriod(
    nextYear: number,
    nextMonth: number,
    nextDay: number | null = day
  ) {
    const params = new URLSearchParams({
      year: String(nextYear),
      month: String(nextMonth),
    });
    if (nextDay != null) params.set("day", String(nextDay));
    if (view) params.set("view", view);
    startTransition(() => {
      router.push(`/billing/purchase-invoices?${params.toString()}`);
    });
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-2",
        pending && "pointer-events-none opacity-70"
      )}
    >
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-subtle">
          {t("pages.billing.purchasePeriod")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Select
            value={String(month)}
            onValueChange={(value) => {
              if (value != null) {
                const nextMonth = Number(value);
                const maxDay = daysInUtcMonth(year, nextMonth);
                navigatePeriod(
                  year,
                  nextMonth,
                  day != null && day > maxDay ? null : day
                );
              }
            }}
          >
            <SelectTrigger
              id="purchase-picker-month"
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
            value={String(year)}
            onValueChange={(value) => {
              if (value != null) navigatePeriod(Number(value), month);
            }}
          >
            <SelectTrigger
              id="purchase-picker-year"
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

          <Select
            value={day == null ? "all" : String(day)}
            onValueChange={(value) => {
              if (value == null) return;
              navigatePeriod(
                year,
                month,
                value === "all" ? null : Number(value)
              );
            }}
          >
            <SelectTrigger
              id="purchase-picker-day"
              aria-label={t("common.labels.date")}
              className={cn(employeeSelectTriggerClass, "w-[7.5rem]")}
            >
              <SelectValue>
                {(value) =>
                  !value || value === "all"
                    ? t("pages.billing.purchaseAllDays")
                    : t("pages.billing.purchaseDayOption", { day: String(value) })
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("pages.billing.purchaseAllDays")}
              </SelectItem>
              {dayOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {t("pages.billing.purchaseDayOption", { day: String(option) })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
