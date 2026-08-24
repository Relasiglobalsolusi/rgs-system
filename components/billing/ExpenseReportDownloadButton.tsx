"use client";

import { FileDown } from "lucide-react";

import { financePeriodSearchParams } from "@/lib/finance-period";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  year: number;
  month: number | null;
  day?: number | null;
  view?: string | null;
};

export default function ExpenseReportDownloadButton({
  year,
  month,
  day = null,
  view,
}: Props) {
  const { t } = useT();
  const params = financePeriodSearchParams({ year, month, day }, { view });

  return (
    <a
      href={`/api/billing/expense-report?${params.toString()}`}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-strong bg-elevated px-3 text-sm font-semibold text-text",
        "hover:border-primary/45 hover:bg-card-hover"
      )}
    >
      <FileDown size={16} aria-hidden />
      {t("pages.billing.expenseReportDownload")}
    </a>
  );
}
