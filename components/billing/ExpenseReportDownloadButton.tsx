"use client";

import { FileDown } from "lucide-react";

import { financeToolbarActionClass } from "@/components/billing/finance-toolbar";
import { financePeriodSearchParams } from "@/lib/finance-period";
import { useT } from "@/lib/i18n/use-t";

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
      className={financeToolbarActionClass}
    >
      <FileDown size={16} aria-hidden />
      {t("pages.billing.expenseReportDownload")}
    </a>
  );
}
