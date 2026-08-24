"use client";

import { FileDown } from "lucide-react";

import { financePeriodSearchParams } from "@/lib/finance-period";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  year: number;
  month: number | null;
  day?: number | null;
};

export default function SalesReportDownloadButton({
  year,
  month,
  day = null,
}: Props) {
  const { t } = useT();
  const params = financePeriodSearchParams({ year, month, day });

  return (
    <a
      href={`/api/billing/sales-report?${params.toString()}`}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-strong bg-elevated px-3 text-sm font-semibold text-text",
        "hover:border-primary/45 hover:bg-card-hover"
      )}
    >
      <FileDown size={16} aria-hidden />
      {t("pages.sales.salesReportDownload")}
    </a>
  );
}
