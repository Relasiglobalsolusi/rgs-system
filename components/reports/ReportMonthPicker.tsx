"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import ReportBreadcrumbs from "@/components/reports/ReportBreadcrumbs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clampReportPeriod,
  defaultReportPeriod,
  listAllowedMonths,
  listAllowedYears,
  type ReportPeriodBounds,
} from "@/lib/report-period-bounds";
import { formatMonthLabel } from "@/lib/monthly-report";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  clientId: string;
  projectId: string;
  bounds: ReportPeriodBounds;
};

export default function ReportMonthPicker({
  clientId,
  projectId,
  bounds,
}: Props) {
  const { t, locale } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initial = useMemo(() => defaultReportPeriod(bounds), [bounds]);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  const yearOptions = useMemo(() => listAllowedYears(bounds), [bounds]);
  const monthOptions = useMemo(
    () => listAllowedMonths(year, bounds),
    [year, bounds]
  );

  useEffect(() => {
    const clamped = clampReportPeriod(year, month, bounds);
    if (clamped.year !== year) setYear(clamped.year);
    if (clamped.month !== month) setMonth(clamped.month);
  }, [year, month, bounds]);

  function handleYearChange(nextYear: number) {
    const clamped = clampReportPeriod(nextYear, month, bounds);
    setYear(clamped.year);
    setMonth(clamped.month);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const clamped = clampReportPeriod(year, month, bounds);
    const params = new URLSearchParams({
      year: String(clamped.year),
      month: String(clamped.month),
    });
    startTransition(() => {
      router.push(`/reports/${clientId}/${projectId}?${params.toString()}`);
    });
  }

  const rangeHint = t("pages.reports.periodRangeHint", {
    from: formatMonthLabel(bounds.min.year, bounds.min.month, locale),
    to: formatMonthLabel(bounds.max.year, bounds.max.month, locale),
  });

  return (
    <>
      <ReportBreadcrumbs
        items={[
          { labelKey: "pages.reports.title", href: "/reports" },
          {
            labelKey: "pages.reports.backToProjects",
            href: `/reports/${clientId}`,
          },
        ]}
      />

      <form
        onSubmit={handleSubmit}
        className={cn(
          "mx-auto max-w-md space-y-6 rounded-2xl border border-border bg-card p-6",
          pending && "pointer-events-none opacity-70"
        )}
      >
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-text">
            {bounds.projectName}
          </h2>
          <p className="text-sm font-medium text-text">
            {t("pages.reports.selectPeriod")}
          </p>
          <p className="text-sm text-muted">{t("pages.reports.selectPeriodDesc")}</p>
          <p className="text-xs text-subtle">{rangeHint}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="report-picker-month"
              className="block text-xs font-medium uppercase tracking-wider text-subtle"
            >
              {t("common.labels.month")}
            </label>
            <Select
              value={String(month)}
              onValueChange={(value) => {
                if (value != null) setMonth(Number(value));
              }}
            >
              <SelectTrigger
                id="report-picker-month"
                className={cn(employeeSelectTriggerClass, "w-full")}
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
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="report-picker-year"
              className="block text-xs font-medium uppercase tracking-wider text-subtle"
            >
              {t("common.labels.year")}
            </label>
            <Select
              value={String(year)}
              onValueChange={(value) => {
                if (value != null) handleYearChange(Number(value));
              }}
            >
              <SelectTrigger
                id="report-picker-year"
                className={cn(employeeSelectTriggerClass, "w-full")}
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
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("common.actions.processing") : t("pages.reports.viewReport")}
        </Button>
      </form>
    </>
  );
}
