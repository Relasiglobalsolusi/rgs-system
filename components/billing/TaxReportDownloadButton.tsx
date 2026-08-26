"use client";

import { FileDown } from "lucide-react";

import { financeToolbarActionClass } from "@/components/billing/finance-toolbar";
import { financePeriodSearchParams } from "@/lib/finance-period";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  year: number;
  month: number | null;
};

export default function TaxReportDownloadButton({ year, month }: Props) {
  const { t } = useT();
  const params = financePeriodSearchParams({ year, month, day: null });

  return (
    <a
      href={`/api/billing/tax-report?${params.toString()}`}
      className={financeToolbarActionClass}
    >
      <FileDown size={16} aria-hidden />
      {t("pages.vat.taxReportDownload")}
    </a>
  );
}
