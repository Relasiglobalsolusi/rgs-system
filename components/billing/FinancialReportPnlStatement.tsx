"use client";

import type { FinancialReportPnlStairs } from "@/lib/financial-report-pnl";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { cn } from "@/lib/utils";

type StairRow = {
  key: string;
  label: string;
  amount: number;
  emphasize?: boolean;
  total?: boolean;
};

type Props = {
  pnl: FinancialReportPnlStairs;
};

export default function FinancialReportPnlStatement({ pnl }: Props) {
  const { t } = useT();
  const rows: StairRow[] = [
    { key: "revenue", label: t("pages.financialReport.pnlRevenue"), amount: pnl.revenue },
    {
      key: "cos",
      label: t("pages.financialReport.pnlCostOfSales"),
      amount: pnl.costOfSales,
    },
    {
      key: "gp",
      label: t("pages.financialReport.pnlGrossProfit"),
      amount: pnl.grossProfit,
      emphasize: true,
    },
    {
      key: "other",
      label: t("pages.financialReport.pnlOtherIncome"),
      amount: pnl.otherIncome,
    },
    {
      key: "ho",
      label: t("pages.financialReport.pnlHeadOffice"),
      amount: pnl.headOffice,
    },
    {
      key: "op",
      label: t("pages.financialReport.pnlOperatingProfit"),
      amount: pnl.operatingProfit,
      emphasize: true,
    },
    {
      key: "finance",
      label: t("pages.financialReport.pnlFinanceCosts"),
      amount: pnl.financeCosts,
    },
    {
      key: "pbt",
      label: t("pages.financialReport.pnlProfitBeforeTax"),
      amount: pnl.profitBeforeTax,
      emphasize: true,
    },
    {
      key: "tax",
      label:
        pnl.incomeTaxRatePercent != null
          ? t("pages.financialReport.pnlIncomeTax", {
              percent: pnl.incomeTaxRatePercent,
            })
          : t("pages.financialReport.pnlIncomeTaxMixed"),
      amount: pnl.incomeTax,
    },
    {
      key: "np",
      label: t("pages.financialReport.pnlNetProfit"),
      amount: pnl.netProfit,
      total: true,
    },
  ];

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <h2 className="text-base font-semibold text-text">
          {t("pages.financialReport.pnlTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {t("pages.financialReport.pnlHint")}
        </p>
      </div>
      <div className="divide-y divide-border/70">
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              "flex items-baseline justify-between gap-4 px-5 py-2.5 sm:px-6",
              row.total && "bg-surface-muted/50",
              row.emphasize && !row.total && "bg-surface-muted/25"
            )}
          >
            <p
              className={cn(
                "min-w-0 text-sm text-text",
                (row.emphasize || row.total) && "font-semibold"
              )}
            >
              {row.label}
            </p>
            <p
              className={cn(
                "shrink-0 tabular-nums text-sm",
                row.total ? "font-semibold text-text" : "text-text",
                row.amount < 0 && "text-danger"
              )}
            >
              {formatContractPrice(row.amount)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
