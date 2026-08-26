"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { ArrowDownLeft, ArrowUpRight, Scale, Wallet } from "lucide-react";

import { FinancePeriodToolbar } from "@/components/billing/finance-toolbar";
import TaxReportDownloadButton from "@/components/billing/TaxReportDownloadButton";

import { employeeSelectTriggerClass } from "@/components/employees/employee-dialog-ui";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { financePeriodSearchParams } from "@/lib/finance-period";
import { formatDisplayDate } from "@/lib/format-date";
import { localeToBcp47 } from "@/lib/i18n/locale";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { formatTaxInvoiceSerial } from "@/lib/tax-invoice-serial";
import { cn } from "@/lib/utils";
import { DEFAULT_INCLUSIVE_PPN_RATE } from "@/lib/vat";
import type {
  IncomeTaxCreditRow,
  VatLedgerRow,
} from "@/lib/vat-ledger";

export type { IncomeTaxCreditRow, VatLedgerRow };

type TaxReportView = "output" | "input" | "income" | "other";

type Props = {
  year: number;
  month: number | null;
  view: TaxReportView;
  outputTotal: number;
  inputTotal: number;
  net: number;
  creditBroughtForward?: number;
  outputRows: VatLedgerRow[];
  inputRows: VatLedgerRow[];
  outputPending: number;
  inputPending: number;
  incomeRows?: IncomeTaxCreditRow[];
  incomeImportTotal?: number;
  incomeInstallmentTotal?: number;
  otherRows?: IncomeTaxCreditRow[];
  otherRemittanceTotal?: number;
  otherExpenseTotal?: number;
  /** Base path used for month-picker navigation and tab links. */
  basePath?: string;
  /** Hide the "Open Tax Invoices" action link on the output section header. */
  hideOutputLink?: boolean;
};

export default function VatReportPanel({
  year,
  month,
  view,
  outputTotal,
  inputTotal,
  net,
  outputRows,
  inputRows,
  outputPending,
  inputPending,
  creditBroughtForward = 0,
  incomeRows = [],
  incomeImportTotal = 0,
  incomeInstallmentTotal = 0,
  otherRows = [],
  otherRemittanceTotal = 0,
  otherExpenseTotal = 0,
  basePath = "/billing/tax-invoices",
  hideOutputLink = false,
}: Props) {
  const { t, locale } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const bcp47 = localeToBcp47(locale);
  const rows = view === "output" ? outputRows : inputRows;
  const incomeCreditTotal = incomeImportTotal + incomeInstallmentTotal;
  const isIncome = view === "income";
  const isOther = view === "other";
  const wholeYear = month == null;
  const ratePct = Math.round(DEFAULT_INCLUSIVE_PPN_RATE * 100);
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => index + 1),
    []
  );
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from(new Set([...Array.from({ length: 8 }, (_, i) => currentYear - 5 + i), year])).sort(
      (a, b) => a - b
    );
  }, [year]);

  function navigatePeriod(nextYear: number, nextMonth: number | null) {
    startTransition(() => {
      router.push(
        `${basePath}?${financePeriodSearchParams(
          { year: nextYear, month: nextMonth, day: null },
          { view }
        ).toString()}`
      );
    });
  }

  function periodHref(nextView: TaxReportView) {
    return `${basePath}?${financePeriodSearchParams(
      { year, month, day: null },
      { view: nextView }
    ).toString()}`;
  }

  const columns: DataTableColumn<VatLedgerRow>[] = [
    {
      key: "party",
      title:
        view === "output"
          ? t("pages.vat.columns.client")
          : t("pages.vat.columns.vendor"),
      width: "14rem",
      share: 2,
      className: "min-w-[14rem]",
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-text">{row.partyName}</p>
          <p className="mt-0.5 truncate text-sm text-subtle">{row.detail}</p>
        </div>
      ),
    },
    {
      key: "date",
      title: t("pages.vat.columns.date"),
      width: "9rem",
      className: "min-w-[9rem]",
      render: (row) =>
        row.date
          ? formatDisplayDate(new Date(row.date), { timeZone: "UTC" }, bcp47)
          : "—",
    },
    {
      key: "gross",
      title: t("pages.vat.columns.gross"),
      width: "9rem",
      align: "right",
      className: "min-w-[9rem] tabular-nums",
      render: (row) => formatContractPrice(row.gross),
    },
    {
      key: "dpp",
      title: t("pages.vat.columns.dpp"),
      width: "9rem",
      align: "right",
      className: "min-w-[9rem] tabular-nums",
      render: (row) => formatContractPrice(row.dpp),
    },
    {
      key: "ppn",
      title: t("pages.vat.columns.ppn"),
      width: "9rem",
      align: "right",
      className: "min-w-[9rem] tabular-nums font-medium text-text",
      render: (row) => formatContractPrice(row.ppn),
    },
    {
      key: "taxInvoiceNumber",
      title: t("pages.vat.columns.taxInvoiceNumber"),
      width: "12rem",
      className: "min-w-[12rem] tabular-nums",
      render: (row) =>
        row.taxInvoiceSerial
          ? formatTaxInvoiceSerial(row.taxInvoiceSerial)
          : "—",
    },
    {
      key: "status",
      title: t("pages.vat.columns.faktur"),
      width: "9rem",
      cellAlign: "center",
      className: "min-w-[9rem]",
      render: (row) => (
        <StatusBadge status={row.fakturReady ? "success" : "pending"}>
          {row.fakturReady
            ? t("pages.vat.fakturReady")
            : t("pages.vat.fakturPending")}
        </StatusBadge>
      ),
    },
  ];

  const incomeColumns: DataTableColumn<IncomeTaxCreditRow>[] = [
    {
      key: "source",
      title: t("pages.vat.columns.source"),
      width: "14rem",
      share: 2,
      className: "min-w-[14rem]",
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-text">{row.source}</p>
          <p className="mt-0.5 truncate text-sm text-subtle">{row.detail}</p>
        </div>
      ),
    },
    {
      key: "date",
      title: t("pages.vat.columns.date"),
      width: "9rem",
      className: "min-w-[9rem]",
      render: (row) =>
        row.date
          ? formatDisplayDate(new Date(row.date), { timeZone: "UTC" }, bcp47)
          : "—",
    },
    {
      key: "credit",
      title: isOther
        ? t("pages.vat.columns.amount")
        : t("pages.vat.columns.credit"),
      width: "10rem",
      align: "right",
      className: "min-w-[10rem] tabular-nums font-medium text-text",
      render: (row) => formatContractPrice(row.amount),
    },
    {
      key: "status",
      title: t("pages.vat.columns.faktur"),
      width: "9rem",
      cellAlign: "center",
      className: "min-w-[9rem]",
      render: (row) => (
        <StatusBadge status={row.documentReady ? "success" : "pending"}>
          {row.documentReady
            ? t("pages.vat.fakturReady")
            : t("pages.vat.fakturPending")}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <FinancePeriodToolbar
          label={t("pages.vat.period")}
          action={<TaxReportDownloadButton year={year} month={month} />}
          className={cn(pending && "pointer-events-none opacity-70")}
        >
            <Select
              value={month == null ? "all" : String(month)}
              onValueChange={(value) => {
                if (value == null) return;
                if (value === "all") {
                  navigatePeriod(year, null);
                  return;
                }
                navigatePeriod(year, Number(value));
              }}
            >
              <SelectTrigger
                id="vat-month"
                className={cn(employeeSelectTriggerClass, "w-[10rem]")}
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
                <SelectItem value="all">
                  {t("common.labels.wholeYear")}
                </SelectItem>
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
                id="vat-year"
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
        <p className="max-w-xl text-sm text-subtle">
          {isIncome
            ? t("pages.vat.incomeDesc")
            : isOther
              ? t("pages.vat.otherDesc")
              : t("pages.vat.rateHint", { rate: ratePct })}
        </p>
      </div>

      {isOther ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <DirectoryStatCard
            title={t("pages.vat.otherRemittanceTotal")}
            value={formatContractPrice(otherRemittanceTotal)}
            subtitle={t("pages.vat.otherRemittanceTotalHint")}
            icon={<ArrowUpRight size={18} />}
            accent="warning"
          />
          <DirectoryStatCard
            title={t("pages.vat.otherExpenseTotal")}
            value={formatContractPrice(otherExpenseTotal)}
            subtitle={t("pages.vat.otherExpenseTotalHint")}
            icon={<ArrowDownLeft size={18} />}
            accent="primary"
          />
          <DirectoryStatCard
            title={t("pages.vat.tabs.other")}
            value={formatContractPrice(otherRemittanceTotal + otherExpenseTotal)}
            subtitle={t("pages.vat.otherDesc")}
            icon={<Scale size={18} />}
            accent="primary"
          />
        </div>
      ) : isIncome ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <DirectoryStatCard
            title={t("pages.vat.incomeImportTotal")}
            value={formatContractPrice(incomeImportTotal)}
            subtitle={t("pages.vat.incomeImportTotalHint")}
            icon={<ArrowDownLeft size={18} />}
            accent="success"
          />
          <DirectoryStatCard
            title={t("pages.vat.incomeInstallmentTotal")}
            value={formatContractPrice(incomeInstallmentTotal)}
            subtitle={t("pages.vat.incomeInstallmentTotalHint")}
            icon={<ArrowUpRight size={18} />}
            accent="warning"
          />
          <DirectoryStatCard
            title={t("pages.vat.incomeCreditTotal")}
            value={formatContractPrice(incomeCreditTotal)}
            subtitle={t("pages.vat.incomeCreditTotalHint")}
            icon={<Scale size={18} />}
            accent="primary"
          />
        </div>
      ) : (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DirectoryStatCard
          title={t("pages.vat.outputTotal")}
          value={formatContractPrice(outputTotal)}
          subtitle={
            wholeYear
              ? t("pages.vat.outputTotalYearHint")
              : t("pages.vat.outputTotalHint")
          }
          icon={<ArrowUpRight size={18} />}
          accent="warning"
        />
        <DirectoryStatCard
          title={t("pages.vat.inputTotal")}
          value={formatContractPrice(inputTotal)}
          subtitle={
            wholeYear
              ? t("pages.vat.inputTotalYearHint")
              : t("pages.vat.inputTotalHint")
          }
          icon={<ArrowDownLeft size={18} />}
          accent="success"
        />
        <DirectoryStatCard
          title={t("pages.vat.netPayable")}
          value={formatContractPrice(net)}
          subtitle={
            wholeYear
              ? t("pages.vat.netYearHint")
              : t("pages.vat.netPayableHint")
          }
          icon={<Scale size={18} />}
          accent={net > 0 ? "success" : net < 0 ? "warning" : "primary"}
        />
        <DirectoryStatCard
          title={t("pages.vat.creditBroughtForward")}
          value={formatContractPrice(creditBroughtForward)}
          subtitle={
            wholeYear
              ? t("pages.vat.creditBroughtForwardYearHint")
              : t("pages.vat.creditBroughtForwardHint")
          }
          icon={<Wallet size={18} />}
          accent={creditBroughtForward > 0 ? "success" : "primary"}
        />
      </div>
      )}

      <div className="flex flex-wrap gap-2">
        <DirectoryFilterTab
          href={periodHref("output")}
          active={view === "output"}
          count={outputRows.length}
        >
          {t("pages.vat.tabs.output")}
          {outputPending > 0
            ? ` · ${t("pages.vat.pendingCount", { count: outputPending })}`
            : null}
        </DirectoryFilterTab>
        <DirectoryFilterTab
          href={periodHref("input")}
          active={view === "input"}
          count={inputRows.length}
        >
          {t("pages.vat.tabs.input")}
          {inputPending > 0
            ? ` · ${t("pages.vat.pendingCount", { count: inputPending })}`
            : null}
        </DirectoryFilterTab>
        <DirectoryFilterTab
          href={periodHref("income")}
          active={view === "income"}
          count={incomeRows.length}
        >
          {t("pages.vat.tabs.income")}
        </DirectoryFilterTab>
        <DirectoryFilterTab
          href={periodHref("other")}
          active={view === "other"}
          count={otherRows.length}
        >
          {t("pages.vat.tabs.other")}
        </DirectoryFilterTab>
      </div>

      <SectionCard>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text">
              {view === "output"
                ? t("pages.vat.outputTitle")
                : view === "income"
                  ? t("pages.vat.incomeTitle")
                  : view === "other"
                    ? t("pages.vat.otherTitle")
                    : t("pages.vat.inputTitle")}
            </h2>
            <p className="mt-1 text-sm text-subtle">
              {view === "output"
                ? t("pages.vat.outputDesc")
                : view === "income"
                  ? t("pages.vat.incomeDesc")
                  : view === "other"
                    ? t("pages.vat.otherDesc")
                    : t("pages.vat.inputDesc")}
            </p>
          </div>
          {!isIncome && !isOther && (!hideOutputLink || view === "input") ? (
            <Link
              href={
                view === "output"
                  ? "/billing/tax-invoices"
                  : "/billing/purchase-invoices?view=tax"
              }
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {view === "output"
                ? t("pages.vat.openTaxInvoices")
                : t("pages.vat.openPurchases")}
            </Link>
          ) : null}
        </div>

        {isIncome || isOther ? (
          (isOther ? otherRows : incomeRows).length === 0 ? (
            <EmptyState
              title={
                isOther ? t("pages.vat.emptyOther") : t("pages.vat.emptyIncome")
              }
              description={
                isOther
                  ? t("pages.vat.emptyOtherDesc")
                  : t("pages.vat.emptyIncomeDesc")
              }
            />
          ) : (
            <DataTable
              columns={incomeColumns}
              data={isOther ? otherRows : incomeRows}
              getRowKey={(row) => row.id}
              onRowClick={(row) => router.push(row.href)}
            />
          )
        ) : rows.length === 0 ? (
          <EmptyState
            title={
              view === "output"
                ? t("pages.vat.emptyOutput")
                : t("pages.vat.emptyInput")
            }
            description={
              view === "output"
                ? t("pages.vat.emptyOutputDesc")
                : t("pages.vat.emptyInputDesc")
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            getRowKey={(row) => row.id}
            onRowClick={(row) => router.push(row.href)}
          />
        )}
      </SectionCard>
    </div>
  );
}
