"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import FinancePeriodControl from "@/components/billing/FinancePeriodControl";
import { financePeriodSearchParams } from "@/lib/finance-period";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  year: number;
  month: number | null;
  day?: number | null;
  /** Preserve AP list view (`tax` / `payments`) when changing period. */
  view?: string | null;
  action?: ReactNode;
};

export default function PurchaseInvoicePeriodControl({
  year,
  month,
  day = null,
  view,
  action,
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
      action={action}
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
