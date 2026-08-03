"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { employeeSelectTriggerClass } from "@/components/employees/employee-dialog-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clampReportPeriod,
  listAllowedMonths,
  listAllowedYears,
  type ReportPeriodBounds,
} from "@/lib/report-period-bounds";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  clientId: string;
  projectId: string;
  year: number;
  month: number;
  bounds: ReportPeriodBounds;
};

export default function AttendanceMonthPeriodControl({
  clientId,
  projectId,
  year,
  month,
  bounds,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [localYear, setLocalYear] = useState(year);
  const [localMonth, setLocalMonth] = useState(month);

  useEffect(() => {
    setLocalYear(year);
    setLocalMonth(month);
  }, [year, month]);

  const yearOptions = useMemo(() => listAllowedYears(bounds), [bounds]);
  const monthOptions = useMemo(
    () => listAllowedMonths(localYear, bounds),
    [localYear, bounds]
  );

  function navigate(nextYear: number, nextMonth: number) {
    const clamped = clampReportPeriod(nextYear, nextMonth, bounds);
    const params = new URLSearchParams({
      year: String(clamped.year),
      month: String(clamped.month),
    });
    startTransition(() => {
      router.push(`/attendance/${clientId}/${projectId}?${params.toString()}`);
    });
  }

  function handleYearChange(value: string | null) {
    if (!value) return;
    const nextYear = Number(value);
    const clamped = clampReportPeriod(nextYear, localMonth, bounds);
    setLocalYear(clamped.year);
    setLocalMonth(clamped.month);
    navigate(clamped.year, clamped.month);
  }

  function handleMonthChange(value: string | null) {
    if (!value) return;
    const nextMonth = Number(value);
    setLocalMonth(nextMonth);
    navigate(localYear, nextMonth);
  }

  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-center gap-3",
        pending && "pointer-events-none opacity-60"
      )}
    >
      <Select value={String(localMonth)} onValueChange={handleMonthChange}>
        <SelectTrigger
          id="attendance-picker-month"
          className={cn(employeeSelectTriggerClass, "w-36")}
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

      <Select value={String(localYear)} onValueChange={handleYearChange}>
        <SelectTrigger
          id="attendance-picker-year"
          className={cn(employeeSelectTriggerClass, "w-28")}
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
    </div>
  );
}
