"use client";

import { useRouter } from "next/navigation";

import FinancePeriodControl from "@/components/billing/FinancePeriodControl";
import { financePeriodSearchParams } from "@/lib/finance-period";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  year: number;
  month: number | null;
  day?: number | null;
  /** Preserve AP list view (`tax` / `payments`) when changing period. */
  view?: string | null;
};

export default function PurchaseInvoicePeriodControl({
  year,
  month,
  day = null,
  view,
}: Props) {
  const { t } = useT();
  const router = useRouter();

  return (
    <FinancePeriodControl
      year={year}
      month={month}
      day={day}
      idPrefix="purchase"
      periodLabel={t("pages.billing.purchasePeriod")}
      onNavigate={(next) => {
        router.push(
          `/billing/purchase-invoices?${financePeriodSearchParams(next, {
            view,
          }).toString()}`
        );
      }}
    />
  );
}
