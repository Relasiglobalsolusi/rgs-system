"use client";

import { FileDown } from "lucide-react";

import { financeToolbarPrimaryActionClass } from "@/components/billing/finance-toolbar";
import { useT } from "@/lib/i18n/use-t";
import type { TaxReportView } from "@/lib/tax-report-view";

export default function TaxInvoiceReportDownloadButton({
  view,
}: {
  view: TaxReportView;
}) {
  const { t } = useT();

  return (
    <a
      href={`/api/billing/tax-invoice-report?view=${encodeURIComponent(view)}`}
      className={financeToolbarPrimaryActionClass}
    >
      <FileDown size={16} aria-hidden />
      {t("pages.vat.taxInvoiceReportDownload")}
    </a>
  );
}
