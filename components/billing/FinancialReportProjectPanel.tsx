"use client";

import { ArrowDownLeft, ArrowUpRight, Percent, TrendingUp } from "lucide-react";

import type { FinancialReportProjectDetail } from "@/app/billing/financial-report/actions";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { formatDisplayDate } from "@/lib/format-date";
import { localeToBcp47 } from "@/lib/i18n/locale";
import { useT } from "@/lib/i18n/use-t";
import { formatEmploymentTypeLabel } from "@/lib/placement";
import { formatContractPrice } from "@/lib/project-billing";

type Props = {
  detail: FinancialReportProjectDetail;
};

export default function FinancialReportProjectPanel({ detail }: Props) {
  const { t, locale } = useT();
  const bcp47 = localeToBcp47(locale);

  const paidColumns: DataTableColumn<
    FinancialReportProjectDetail["paidLines"][number]
  >[] = [
    {
      key: "period",
      title: t("pages.financialReport.columns.period"),
      width: "12rem",
      share: 1.5,
      className: "min-w-[12rem]",
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-text">
            {row.label?.trim() ||
              t("pages.financialReport.invoicePeriodFallback")}
          </p>
          <p className="mt-0.5 text-sm text-subtle">
            {formatDisplayDate(row.periodStart, { timeZone: "UTC" }, bcp47)}
            {" – "}
            {formatDisplayDate(row.periodEnd, { timeZone: "UTC" }, bcp47)}
          </p>
        </div>
      ),
    },
    {
      key: "paidAt",
      title: t("pages.financialReport.columns.paidAt"),
      width: "9rem",
      className: "min-w-[9rem]",
      render: (row) =>
        row.paidAt
          ? formatDisplayDate(row.paidAt, undefined, bcp47)
          : "—",
    },
    {
      key: "amount",
      title: t("pages.financialReport.columns.amount"),
      width: "9rem",
      align: "right",
      className: "min-w-[9rem] tabular-nums",
      render: (row) => formatContractPrice(row.amount),
    },
  ];

  const issueColumns: DataTableColumn<
    FinancialReportProjectDetail["inventoryIssues"][number]
  >[] = [
    {
      key: "item",
      title: t("pages.financialReport.columns.item"),
      width: "12rem",
      share: 2,
      className: "min-w-[12rem]",
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-text">{row.item.name}</p>
          <p className="mt-0.5 text-sm text-subtle">{row.item.sku}</p>
        </div>
      ),
    },
    {
      key: "movedAt",
      title: t("pages.financialReport.columns.issuedAt"),
      width: "9rem",
      className: "min-w-[9rem]",
      render: (row) => formatDisplayDate(row.movedAt, undefined, bcp47),
    },
    {
      key: "qty",
      title: t("pages.financialReport.columns.quantity"),
      width: "7rem",
      align: "right",
      className: "min-w-[7rem] tabular-nums",
      render: (row) =>
        `${row.quantity.toLocaleString(bcp47)} ${row.item.unit}`,
    },
    {
      key: "cost",
      title: t("pages.financialReport.columns.amount"),
      width: "9rem",
      align: "right",
      className: "min-w-[9rem] tabular-nums",
      render: (row) => formatContractPrice(row.totalCost),
    },
  ];

  const wageColumns: DataTableColumn<
    FinancialReportProjectDetail["wageLines"][number]
  >[] = [
    {
      key: "employee",
      title: t("pages.financialReport.columns.employee"),
      width: "12rem",
      share: 2,
      className: "min-w-[12rem]",
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-text">{row.name}</p>
          <p className="mt-0.5 text-sm text-subtle">
            {row.employeeNo}
            {" · "}
            {formatEmploymentTypeLabel(row.employmentType, locale)}
          </p>
        </div>
      ),
    },
    {
      key: "basePay",
      title: t("pages.financialReport.columns.monthlyBasePay"),
      width: "9rem",
      align: "right",
      className: "min-w-[9rem] tabular-nums",
      render: (row) =>
        row.monthlyBasePay != null && row.monthlyBasePay > 0
          ? formatContractPrice(row.monthlyBasePay)
          : "—",
    },
    {
      key: "period",
      title: t("pages.financialReport.columns.assignmentPeriod"),
      width: "11rem",
      className: "min-w-[11rem]",
      render: (row) => (
        <span className="text-sm text-text">
          {formatDisplayDate(row.costFrom, { timeZone: "UTC" }, bcp47)}
          {" – "}
          {formatDisplayDate(row.costThrough, { timeZone: "UTC" }, bcp47)}
        </span>
      ),
    },
    {
      key: "wage",
      title: t("pages.financialReport.columns.wageCost"),
      width: "9rem",
      align: "right",
      className: "min-w-[9rem] tabular-nums",
      render: (row) => formatContractPrice(row.wageCost),
    },
  ];

  const marginLabel =
    detail.marginPercent == null
      ? "—"
      : `${detail.marginPercent.toLocaleString(bcp47, {
          maximumFractionDigits: 1,
          minimumFractionDigits: 0,
        })}%`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DirectoryStatCard
          title={t("pages.financialReport.moneyIn")}
          value={formatContractPrice(detail.moneyIn)}
          subtitle={t("pages.financialReport.moneyInHint")}
          icon={<ArrowDownLeft size={18} />}
          accent="success"
        />
        <DirectoryStatCard
          title={t("pages.financialReport.moneyOut")}
          value={formatContractPrice(detail.moneyOut)}
          subtitle={t("pages.financialReport.moneyOutHint")}
          icon={<ArrowUpRight size={18} />}
          accent="warning"
        />
        <DirectoryStatCard
          title={t("pages.financialReport.profit")}
          value={formatContractPrice(detail.profit)}
          subtitle={t("pages.financialReport.profitHint")}
          icon={<TrendingUp size={18} />}
          accent={detail.profit < 0 ? "danger" : "primary"}
        />
        <DirectoryStatCard
          title={t("pages.financialReport.margin")}
          value={marginLabel}
          subtitle={
            detail.contractValue != null
              ? `${t("pages.financialReport.contractValue")}: ${formatContractPrice(detail.contractValue)}`
              : t("pages.financialReport.marginHint")
          }
          icon={<Percent size={18} />}
          accent="info"
        />
      </div>

      <SectionCard>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-text">
            {t("pages.financialReport.moneyOutBreakdownTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t("pages.financialReport.moneyOutBreakdownDesc")}
          </p>
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border/70 bg-surface-muted/40 px-4 py-3">
            <dt className="text-sm text-subtle">
              {t("pages.financialReport.inventoryOut")}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-text">
              {formatContractPrice(detail.inventoryOut)}
            </dd>
          </div>
          <div className="rounded-lg border border-border/70 bg-surface-muted/40 px-4 py-3">
            <dt className="text-sm text-subtle">
              {t("pages.financialReport.wagesOut")}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-text">
              {formatContractPrice(detail.wagesOut)}
            </dd>
          </div>
          <div className="rounded-lg border border-border/70 bg-surface-muted/40 px-4 py-3">
            <dt className="text-sm text-subtle">
              {t("pages.financialReport.moneyOutTotal")}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-text">
              {formatContractPrice(detail.moneyOut)}
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-text">
            {t("pages.financialReport.paymentsTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t("pages.financialReport.paymentsDesc")}
          </p>
        </div>
        {detail.paidLines.length === 0 ? (
          <EmptyState
            title={t("pages.financialReport.emptyPayments")}
            description={t("pages.financialReport.emptyPaymentsDesc")}
          />
        ) : (
          <DataTable
            columns={paidColumns}
            data={detail.paidLines}
            getRowKey={(row) => row.id}
            emptyMessage={t("pages.financialReport.emptyPayments")}
          />
        )}
      </SectionCard>

      <SectionCard>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-text">
            {t("pages.financialReport.inventoryTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t("pages.financialReport.inventoryDesc")}
          </p>
        </div>
        {detail.inventoryIssues.length === 0 ? (
          <EmptyState
            title={t("pages.financialReport.emptyInventory")}
            description={t("pages.financialReport.emptyInventoryDesc")}
          />
        ) : (
          <DataTable
            columns={issueColumns}
            data={detail.inventoryIssues}
            getRowKey={(row) => row.id}
            emptyMessage={t("pages.financialReport.emptyInventory")}
          />
        )}
      </SectionCard>

      <SectionCard>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-text">
            {t("pages.financialReport.wagesTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t("pages.financialReport.wagesDesc")}
          </p>
        </div>
        {detail.wageLines.length === 0 ? (
          <EmptyState
            title={t("pages.financialReport.emptyWages")}
            description={t("pages.financialReport.emptyWagesDesc")}
          />
        ) : (
          <DataTable
            columns={wageColumns}
            data={detail.wageLines}
            getRowKey={(row) => row.assignmentId}
            emptyMessage={t("pages.financialReport.emptyWages")}
          />
        )}
      </SectionCard>
    </div>
  );
}
