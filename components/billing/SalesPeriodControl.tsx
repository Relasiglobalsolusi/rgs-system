"use client";

import { useRouter } from "next/navigation";

import FinancePeriodControl from "@/components/billing/FinancePeriodControl";
import { financePeriodSearchParams } from "@/lib/finance-period";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  year: number;
  month: number | null;
  day?: number | null;
};

export default function SalesPeriodControl({
  year,
  month,
  day = null,
}: Props) {
  const { t } = useT();
  const router = useRouter();

  return (
    <FinancePeriodControl
      year={year}
      month={month}
      day={day}
      idPrefix="sales"
      periodLabel={t("pages.sales.period")}
      onNavigate={(next) => {
        router.push(`/billing/sales?${financePeriodSearchParams(next).toString()}`);
      }}
    />
  );
}
