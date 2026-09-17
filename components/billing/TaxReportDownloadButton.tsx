"use client";

import { FileDown } from "lucide-react";

import { financeToolbarPrimaryActionClass } from "@/components/billing/finance-toolbar";
import { financePeriodSearchParams } from "@/lib/finance-period";
import { useT } from "@/lib/i18n/use-t";
import type { TaxReportView } from "@/lib/tax-report-view";
import { cn } from "@/lib/utils";

type Props = {
  year: number;
  month: number | null;
  view: TaxReportView;
  className?: string;
};

export default function TaxReportDownloadButton({
  year,
  month,
  view,
  className,
}: Props) {
  const { t } = useT();
  const params = financePeriodSearchParams(
    { year, month, day: null },
    { view }
  );

  return (
    <a
      href={`/api/billing/tax-report?${params.toString()}`}
      className={cn(financeToolbarPrimaryActionClass, className)}
    >
      <FileDown size={16} aria-hidden />
      {t("pages.vat.taxReportDownload")}
    </a>
  );
}
