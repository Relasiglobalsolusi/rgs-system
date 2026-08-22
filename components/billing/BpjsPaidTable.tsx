"use client";

import Link from "next/link";

import SectionCard from "@/components/ui/SectionCard";
import type { BpjsFinanceRemittanceRow } from "@/lib/bpjs-finance";
import { formatDisplayDate } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

export default function BpjsPaidTable({
  rows,
  showProgram = false,
}: {
  rows: BpjsFinanceRemittanceRow[];
  showProgram?: boolean;
}) {
  const { t, locale } = useT();

  return (
    <SectionCard className="p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-text">
        {t("pages.bpjs.remittancesTitle")}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {t("pages.bpjs.remittancesEmpty")}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">
                  {t("pages.bpjs.paidAt")}
                </th>
                {showProgram ? (
                  <th className="px-3 py-2 font-medium">
                    {t("pages.bpjs.program")}
                  </th>
                ) : null}
                <th className="px-3 py-2 font-medium">
                  {t("pages.bpjs.amount")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("pages.bpjs.reference")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("pages.bpjs.viewExpense")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/70 last:border-0"
                >
                  <td className="px-3 py-3 text-text">
                    {formatDisplayDate(
                      row.paidAt,
                      { timeZone: "Asia/Jakarta" },
                      locale
                    )}
                  </td>
                  {showProgram ? (
                    <td className="px-3 py-3 text-text">
                      {row.program === "KESEHATAN"
                        ? t("pages.bpjs.kesehatan")
                        : t("pages.bpjs.ketenagakerjaan")}
                    </td>
                  ) : null}
                  <td className="px-3 py-3 tabular-nums">
                    {formatContractPrice(row.amount)}
                  </td>
                  <td className="px-3 py-3 text-muted">
                    {row.reference || "—"}
                  </td>
                  <td className="px-3 py-3">
                    {row.purchaseInvoiceId ? (
                      <Link
                        href={`/billing/purchase-invoices/${row.purchaseInvoiceId}`}
                        className="text-primary hover:underline"
                      >
                        {t("pages.bpjs.viewExpense")}
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
