"use client";

import { FileDown } from "lucide-react";

import { financeToolbarPrimaryActionClass } from "@/components/billing/finance-toolbar";
import { financePeriodSearchParams } from "@/lib/finance-period";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  year: number;
  month: number | null;
  day?: number | null;
};

export default function ApReportDownloadButton({
  year,
  month,
  day = null,
}: Props) {
  const { t } = useT();
  const params = financePeriodSearchParams({ year, month, day });

  return (
    <a
      href={`/api/billing/ap-report?${params.toString()}`}
      className={financeToolbarPrimaryActionClass}
    >
      <FileDown size={16} aria-hidden />
      {t("pages.billing.apReportDownload")}
    </a>
  );
}
