"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Download, FileText } from "lucide-react";

import StatusBadge from "@/components/ui/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { formatDisplayDate } from "@/lib/format-date";
import { localizeBillingStatus } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import {
  decimalToNumber,
  formatContractPrice,
} from "@/lib/project-billing";
import { cn } from "@/lib/utils";
import type { InvoicePeriodStatus } from "@prisma/client";

export type CompletedPeriodRow = {
  id: string;
  label: string | null;
  periodStart: string | Date;
  periodEnd: string | Date;
  status: InvoicePeriodStatus | string;
  amount: number | string | { toString(): string } | null;
  invoicePdfPath: string | null;
  submittedAt: string | Date | null;
  taxInvoiceRequired: boolean;
  taxInvoiceDoneAt: string | Date | null;
  taxInvoiceDocumentPath: string | null;
  /** Client has no NPWP — tax invoice N/A. */
  clientHasNpwp: boolean;
};

type Props = {
  periods: CompletedPeriodRow[];
};

export default function CompletedProjectPeriods({ periods }: Props) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);

  if (periods.length === 0) {
    return <span className="text-xs text-subtle">—</span>;
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-medium text-accent-teal hover:underline"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {t("pages.reconciliation.completedPeriodsTitle")} ({periods.length})
      </button>

      {open ? (
        <div className="mt-2 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[28rem] text-left text-xs">
            <thead className="bg-elevated text-[10px] uppercase tracking-wider text-subtle">
              <tr>
                <th className="px-2 py-1.5 font-semibold">
                  {t("pages.billing.columns.period")}
                </th>
                <th className="px-2 py-1.5 font-semibold">
                  {t("pages.reconciliation.invoiceSent")}
                </th>
                <th className="px-2 py-1.5 font-semibold">
                  {t("pages.reconciliation.taxInvoiceIssued")}
                </th>
                <th className="px-2 py-1.5 font-semibold">
                  {t("pages.billing.columns.amount")}
                </th>
                <th className="px-2 py-1.5 font-semibold">
                  {t("pages.billing.columns.status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                const amount = decimalToNumber(p.amount);
                const taxNa = !p.clientHasNpwp || !p.taxInvoiceRequired;
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-2 py-1.5 text-text">
                      {p.label ??
                        `${formatDisplayDate(p.periodStart, { timeZone: "UTC" })} – ${formatDisplayDate(p.periodEnd, { timeZone: "UTC" })}`}
                    </td>
                    <td className="px-2 py-1.5">
                      {p.invoicePdfPath ? (
                        <a
                          href={p.invoicePdfPath}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "h-7 gap-1 px-2 text-[11px]"
                          )}
                        >
                          <Download className="h-3 w-3" />
                          PDF
                        </a>
                      ) : p.submittedAt ? (
                        formatDisplayDate(p.submittedAt)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {taxNa ? (
                        <span className="text-subtle">
                          {t("pages.reconciliation.taxNa")}
                        </span>
                      ) : p.taxInvoiceDocumentPath ? (
                        <a
                          href={p.taxInvoiceDocumentPath}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "h-7 gap-1 px-2 text-[11px]"
                          )}
                        >
                          <FileText className="h-3 w-3" />
                          PDF
                        </a>
                      ) : p.taxInvoiceDoneAt ? (
                        formatDisplayDate(p.taxInvoiceDoneAt)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-muted">
                      {amount != null ? formatContractPrice(amount) : "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      <StatusBadge status="success" compact>
                        {localizeBillingStatus(
                          p.status as InvoicePeriodStatus,
                          locale
                        )}
                      </StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
