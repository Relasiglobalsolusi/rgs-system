"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { ArrowDownLeft, ArrowUpRight, Scale, Wallet } from "lucide-react";

import { FinancePeriodToolbar, financeToolbarActionClass } from "@/components/billing/finance-toolbar";
import TaxInvoiceReportDownloadButton from "@/components/billing/TaxInvoiceReportDownloadButton";
import TaxReportDownloadButton from "@/components/billing/TaxReportDownloadButton";

import { employeeSelectTriggerClass } from "@/components/employees/employee-dialog-ui";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { chipScrollRowClassName } from "@/components/ui/chip-scroll-row";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DirectoryStatGrid from "@/components/ui/DirectoryStatGrid";
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
import {
  TAX_REPORT_VIEWS,
  type TaxReportView,
} from "@/lib/tax-report-view";
import { cn } from "@/lib/utils";
import { DEFAULT_INCLUSIVE_PPN_RATE } from "@/lib/vat";
import type {
  IncomeTaxCreditRow,
  VatLedgerRow,
} from "@/lib/vat-ledger";

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

function withFromParam(href: string, view: TaxReportView): string {
  const queryIndex = href.indexOf("?");
  const path = queryIndex === -1 ? href : href.slice(0, queryIndex);
  const params = new URLSearchParams(
    queryIndex === -1 ? "" : href.slice(queryIndex + 1)
  );
  params.set("from", view);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export default function VatReportPanel({
  year,
  month,
  view,
  outputTotal,
  inputTotal,
  net,
  outputRows,
  inputRows,
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
  const incomeCreditTotal = incomeImportTotal + incomeInstallmentTotal;
  const isAll = view === "all";
  const isIncome = view === "income";
  const isOther = view === "other";
  const showVatStats = isAll || view === "output" || view === "input";
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

  function openRow(href: string) {
    router.push(withFromParam(href, view));
  }

  const vatColumns = (kind: "output" | "input"): DataTableColumn<VatLedgerRow>[] => [
    {
      key: "party",
      title:
        kind === "output"
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

  const amountColumns = (
    amountKind: "income" | "other"
  ): DataTableColumn<IncomeTaxCreditRow>[] => [
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
      title:
        amountKind === "other"
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

  function renderVatSection(kind: "output" | "input") {
    const rows = kind === "output" ? outputRows : inputRows;
    return (
      <SectionCard key={kind}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">
              {kind === "output"
                ? t("pages.vat.outputTitle")
                : t("pages.vat.inputTitle")}
            </h2>
            <p className="mt-1 text-sm text-subtle">
              {kind === "output"
                ? t("pages.vat.outputDesc")
                : t("pages.vat.inputDesc")}
            </p>
          </div>
          {!hideOutputLink || kind === "input" ? (
            <Link
              href={
                kind === "output"
                  ? "/billing/tax-invoices"
                  : "/billing/purchase-invoices?view=tax"
              }
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {kind === "output"
                ? t("pages.vat.openTaxInvoices")
                : t("pages.vat.openPurchases")}
            </Link>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={
              kind === "output"
                ? t("pages.vat.emptyOutput")
                : t("pages.vat.emptyInput")
            }
            description={
              kind === "output"
                ? t("pages.vat.emptyOutputDesc")
                : t("pages.vat.emptyInputDesc")
            }
          />
        ) : (
          <DataTable
            columns={vatColumns(kind)}
            data={rows}
            getRowKey={(row) => row.id}
            onRowClick={(row) => openRow(row.href)}
          />
        )}
      </SectionCard>
    );
  }

  function renderAmountSection(kind: "income" | "other") {
    const rows = kind === "other" ? otherRows : incomeRows;
    return (
      <SectionCard key={kind}>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-text">
            {kind === "other"
              ? t("pages.vat.otherTitle")
              : t("pages.vat.incomeTitle")}
          </h2>
          <p className="mt-1 text-sm text-subtle">
            {kind === "other"
              ? t("pages.vat.otherDesc")
              : t("pages.vat.incomeDesc")}
          </p>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={
              kind === "other"
                ? t("pages.vat.emptyOther")
                : t("pages.vat.emptyIncome")
            }
            description={
              kind === "other"
                ? t("pages.vat.emptyOtherDesc")
                : t("pages.vat.emptyIncomeDesc")
            }
          />
        ) : (
          <DataTable
            columns={amountColumns(kind)}
            data={rows}
            getRowKey={(row) => row.id}
            onRowClick={(row) => openRow(row.href)}
          />
        )}
      </SectionCard>
    );
  }

  const hint = isAll
    ? t("pages.vat.taxReportHint")
    : isIncome
      ? t("pages.vat.incomeDesc")
      : isOther
        ? t("pages.vat.otherDesc")
        : t("pages.vat.rateHint", { rate: ratePct });

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className={chipScrollRowClassName("min-w-0 sm:flex-1")}>
          {TAX_REPORT_VIEWS.map((tab) => (
            <DirectoryFilterTab
              key={tab}
              href={periodHref(tab)}
              active={view === tab}
              count={
                tab === "all"
                  ? outputRows.length +
                    inputRows.length +
                    incomeRows.length +
                    otherRows.length
                  : tab === "output"
                    ? outputRows.length
                    : tab === "input"
                      ? inputRows.length
                      : tab === "income"
                        ? incomeRows.length
                        : otherRows.length
              }
            >
              {t(`pages.vat.tabs.${tab}`)}
            </DirectoryFilterTab>
          ))}
        </div>
        <TaxInvoiceReportDownloadButton view={view} />
        <Link
          href="/billing/tax-invoices/rates"
          className={financeToolbarActionClass}
        >
          {t("pages.taxRates.button")}
        </Link>
      </div>

      <div className="space-y-3">
        <FinancePeriodToolbar
          label={t("pages.vat.period")}
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
            <TaxReportDownloadButton
              year={year}
              month={month}
              view={view}
              className="w-auto"
            />
        </FinancePeriodToolbar>
        <p className="max-w-xl text-sm text-subtle">{hint}</p>
      </div>

      {isOther ? (
        <DirectoryStatGrid>
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
        </DirectoryStatGrid>
      ) : isIncome ? (
        <DirectoryStatGrid>
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
        </DirectoryStatGrid>
      ) : showVatStats ? (
      <DirectoryStatGrid>
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
      </DirectoryStatGrid>
      ) : null}

      {isAll ? (
        <div className="space-y-6">
          {renderVatSection("output")}
          {renderVatSection("input")}
          {renderAmountSection("income")}
          {renderAmountSection("other")}
        </div>
      ) : view === "output" ? (
        renderVatSection("output")
      ) : view === "input" ? (
        renderVatSection("input")
      ) : view === "income" ? (
        renderAmountSection("income")
      ) : (
        renderAmountSection("other")
      )}
    </div>
  );
}
