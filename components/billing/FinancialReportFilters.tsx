"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { FinancialReportScopeClient } from "@/app/billing/financial-report/actions";
import { directoryFilterSelectTriggerClass } from "@/components/ui/DirectoryFilterSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FINANCIAL_REPORT_GENERAL_SCOPE,
  FINANCIAL_REPORT_YEARLY_MONTH,
  financialReportHref,
  financialReportYearOptions,
  type FinancialReportSelection,
} from "@/lib/financial-report-query";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  selection: FinancialReportSelection;
  clients: FinancialReportScopeClient[];
  scopeClientId: string | null;
  projectId?: string;
};

export default function FinancialReportFilters({
  selection,
  clients,
  scopeClientId,
  projectId,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const yearOptions = financialReportYearOptions(selection.year);
  const periodValue =
    selection.month == null
      ? FINANCIAL_REPORT_YEARLY_MONTH
      : String(selection.month);
  const scopeValue = scopeClientId ?? FINANCIAL_REPORT_GENERAL_SCOPE;

  function navigate(
    next: FinancialReportSelection,
    nextClientId: string | null
  ) {
    const path =
      nextClientId && projectId && nextClientId === scopeClientId
        ? `/billing/financial-report/${nextClientId}/${projectId}`
        : nextClientId
          ? `/billing/financial-report/${nextClientId}`
          : "/billing/financial-report";
    startTransition(() => {
      router.push(financialReportHref(path, next));
    });
  }

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="grid min-w-[11rem] gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-subtle">
          {t("pages.financialReport.filterPeriod")}
        </span>
        <Select
          value={periodValue}
          onValueChange={(value) => {
            if (value == null) return;
            navigate(
              {
                year: selection.year,
                month:
                  value === FINANCIAL_REPORT_YEARLY_MONTH
                    ? null
                    : Number(value),
              },
              scopeClientId
            );
          }}
        >
          <SelectTrigger
            aria-label={t("pages.financialReport.filterPeriod")}
            className={cn(directoryFilterSelectTriggerClass, "w-full sm:w-[14rem]")}
          >
            <SelectValue>
              {(value) =>
                value === FINANCIAL_REPORT_YEARLY_MONTH
                  ? t("pages.financialReport.filterPeriodYearly")
                  : value
                    ? t(`pages.reports.months.${value}`)
                    : t("pages.financialReport.filterPeriod")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FINANCIAL_REPORT_YEARLY_MONTH}>
              {t("pages.financialReport.filterPeriodYearly")}
            </SelectItem>
            {Array.from({ length: 12 }, (_, index) => String(index + 1)).map(
              (month) => (
                <SelectItem key={month} value={month}>
                  {t(`pages.reports.months.${month}`)}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </label>

      <label className="grid min-w-[7rem] gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-subtle">
          {t("pages.financialReport.filterYear")}
        </span>
        <Select
          value={String(selection.year)}
          onValueChange={(value) => {
            if (value == null) return;
            navigate(
              { year: Number(value), month: selection.month },
              scopeClientId
            );
          }}
        >
          <SelectTrigger
            aria-label={t("pages.financialReport.filterYear")}
            className={cn(directoryFilterSelectTriggerClass, "w-full sm:w-[7.5rem]")}
          >
            <SelectValue>
              {(value) => value ?? t("pages.financialReport.filterYear")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="grid min-w-[14rem] flex-1 gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-subtle">
          {t("pages.financialReport.filterReport")}
        </span>
        <Select
          value={scopeValue}
          onValueChange={(value) => {
            if (value == null) return;
            navigate(
              selection,
              value === FINANCIAL_REPORT_GENERAL_SCOPE ? null : value
            );
          }}
        >
          <SelectTrigger
            aria-label={t("pages.financialReport.filterReport")}
            className={cn(directoryFilterSelectTriggerClass, "w-full")}
          >
            <SelectValue>
              {(value) => {
                if (!value || value === FINANCIAL_REPORT_GENERAL_SCOPE) {
                  return t("pages.financialReport.filterReportGeneral");
                }
                return (
                  clients.find((client) => client.id === value)?.name ??
                  t("pages.financialReport.filterReport")
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FINANCIAL_REPORT_GENERAL_SCOPE}>
              {t("pages.financialReport.filterReportGeneral")}
            </SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      {pending ? (
        <p className="text-sm text-subtle">{t("common.actions.loading")}</p>
      ) : null}
    </div>
  );
}
