"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

import type { FinancialReportScopeClient } from "@/app/billing/financial-report/actions";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import { formatBankAccountOptionLabel } from "@/lib/company-bank-accounts";
import { directoryFilterSelectTriggerClass } from "@/components/ui/DirectoryFilterSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FINANCIAL_REPORT_ALL_BANKS,
  FINANCIAL_REPORT_GENERAL_SCOPE,
  FINANCIAL_REPORT_UNASSIGNED_BANK,
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
  bankAccounts?: CompanyBankAccountOption[];
  /** Keep the clicked Financial Report card when changing period / bank. */
  detailMetric?: string;
  action?: ReactNode;
};

export default function FinancialReportFilters({
  selection,
  clients,
  scopeClientId,
  projectId,
  bankAccounts = [],
  detailMetric,
  action,
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
  const bankValue = selection.bank ?? FINANCIAL_REPORT_ALL_BANKS;

  function navigate(
    next: FinancialReportSelection,
    nextClientId: string | null
  ) {
    const path =
      nextClientId && projectId && nextClientId === scopeClientId
        ? `/billing/financial-report/${nextClientId}/${projectId}`
        : nextClientId
          ? `/billing/financial-report/${nextClientId}`
          : detailMetric
            ? "/billing/financial-report/detail"
            : "/billing/financial-report";
    const href = financialReportHref(path, next);
    startTransition(() => {
      router.replace(
        detailMetric && !nextClientId ? `${href}&metric=${detailMetric}` : href,
        { scroll: false }
      );
    });
  }

  const fieldLabelClass =
    "text-xs font-semibold uppercase tracking-wide text-subtle";
  const triggerClass = cn(directoryFilterSelectTriggerClass, "w-full");

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 lg:flex-row lg:items-end",
        pending && "pointer-events-none opacity-70"
      )}
    >
      <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="grid min-w-0 gap-1.5">
          <span className={fieldLabelClass}>
            {t("pages.financialReport.filterPeriod")}
          </span>
          <Select
            value={periodValue}
            onValueChange={(value) => {
              if (value == null) return;
              navigate(
                {
                  ...selection,
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
              className={triggerClass}
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

        <label className="grid min-w-0 gap-1.5">
          <span className={fieldLabelClass}>
            {t("pages.financialReport.filterYear")}
          </span>
          <Select
            value={String(selection.year)}
            onValueChange={(value) => {
              if (value == null) return;
              navigate(
                { ...selection, year: Number(value), month: selection.month },
                scopeClientId
              );
            }}
          >
            <SelectTrigger
              aria-label={t("pages.financialReport.filterYear")}
              className={triggerClass}
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

        <label className="grid min-w-0 gap-1.5">
          <span className={fieldLabelClass}>
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
              className={triggerClass}
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

        <label className="grid min-w-0 gap-1.5">
          <span className={fieldLabelClass}>
            {t("pages.financialReport.filterBank")}
          </span>
          <Select
            value={bankValue}
            onValueChange={(value) => {
              if (value == null) return;
              navigate({ ...selection, bank: value }, scopeClientId);
            }}
          >
            <SelectTrigger
              aria-label={t("pages.financialReport.filterBank")}
              className={triggerClass}
            >
              <SelectValue>
                {(value) => {
                  if (!value || value === FINANCIAL_REPORT_ALL_BANKS) {
                    return t("pages.financialReport.filterBankAll");
                  }
                  if (value === FINANCIAL_REPORT_UNASSIGNED_BANK) {
                    return t("pages.financialReport.filterBankUnassigned");
                  }
                  const account = bankAccounts.find((row) => row.id === value);
                  return account
                    ? formatBankAccountOptionLabel(account)
                    : t("pages.financialReport.filterBank");
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FINANCIAL_REPORT_ALL_BANKS}>
                {t("pages.financialReport.filterBankAll")}
              </SelectItem>
              <SelectItem value={FINANCIAL_REPORT_UNASSIGNED_BANK}>
                {t("pages.financialReport.filterBankUnassigned")}
              </SelectItem>
              {bankAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {formatBankAccountOptionLabel(account)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {action ? (
        <div className="grid shrink-0 gap-1.5">
          <span className={cn(fieldLabelClass, "hidden lg:invisible lg:block")} aria-hidden>
            {t("pages.financialReport.downloadReport")}
          </span>
          {action}
        </div>
      ) : null}
    </div>
  );
}
