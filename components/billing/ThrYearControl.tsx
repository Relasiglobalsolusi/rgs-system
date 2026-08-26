"use client";

import { useMemo, useTransition, type ReactNode } from "react";
import { Settings2 } from "lucide-react";
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

export default function ThrYearControl({
  year,
  action,
}: {
  year: number;
  action?: ReactNode;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const yearOptions = useMemo(() => {
    const currentYear = jakartaYearMonthDay().year;
    return Array.from(
      new Set([
        ...Array.from({ length: 8 }, (_, index) => currentYear - 5 + index),
        year,
      ])
    ).sort((a, b) => a - b);
  }, [year]);

  return (
    <FinancePeriodToolbar
      label={t("pages.thr.targetYear")}
      action={action}
      className={cn(pending && "pointer-events-none opacity-70")}
    >
      <Select
        value={String(year) || null}
        onValueChange={(value) => {
          if (value == null) return;
          startTransition(() => {
            router.push(`/billing/thr?year=${value}`);
          });
        }}
      >
        <SelectTrigger
          id="thr-picker-year"
          aria-label={t("pages.thr.targetYear")}
          className={cn(employeeSelectTriggerClass, "w-[8.5rem]")}
        >
          <SelectValue>
            {(value) => (
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 shrink-0" aria-hidden />
                <span className="tabular-nums">
                  {value ?? t("common.labels.year")}
                </span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="min-w-[8.5rem]">
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
