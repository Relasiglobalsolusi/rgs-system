"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import TaxInvoiceDoneButton from "@/components/billing/TaxInvoiceDoneButton";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { ACTIONS_SINGLE_CHIP_COLUMN_WIDTH } from "@/components/ui/trash-action-buttons";
import {
  localizeBillingChipLines,
  localizeBillingStatus,
} from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";

export type TaxInvoiceTableRow = {
  id: string;
  displayTitle: string;
  subtitle: string;
  secondary: string;
  amountLabel: string;
  billingHref: string | null;
  periodLabel: string;
  paymentKey: string;
  isPending: boolean;
};

type Props = {
  rows: TaxInvoiceTableRow[];
  canManage: boolean;
  isPending: boolean;
};

export default function TaxInvoiceTable({
  rows,
  canManage,
  isPending,
}: Props) {
  const { t, locale } = useT();
  const router = useRouter();

  const columns = useMemo(() => {
    const cols: DataTableColumn<TaxInvoiceTableRow>[] = [
      {
        key: "invoice",
        title: t("pages.billing.invoice"),
        width: "14rem",
        share: 2,
        className: "min-w-[14rem]",
        render: (row) => (
          <div className="min-w-0">
            <p className="font-semibold text-text">{row.displayTitle}</p>
            <p className="mt-0.5 max-w-md truncate text-sm text-subtle">
              {row.subtitle}
            </p>
          </div>
        ),
      },
      {
        key: "meta",
        title: isPending
          ? t("pages.billing.issued")
          : t("pages.billing.completed"),
        width: "10rem",
        className: "min-w-[10rem] whitespace-nowrap",
        render: (row) => (
          <p className="text-muted">{row.secondary}</p>
        ),
      },
      {
        key: "status",
        title: t("common.labels.status"),
        width: "14rem",
        align: "center",
        className: "min-w-[14rem] overflow-visible",
        render: (row) => (
          <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-1.5">
            {row.isPending ? (
              <StatusBadge
                status="pending"
                compact
                lines={localizeBillingChipLines("taxInvoiceDue", locale)}
              />
            ) : (
              <StatusBadge
                status="success"
                compact
                lines={localizeBillingChipLines("taxInvoiceDone", locale)}
              />
            )}
            {row.paymentKey === "LATE" ? (
              <StatusBadge
                status="danger"
                compact
                lines={localizeBillingChipLines("latePayment", locale)}
              />
            ) : row.paymentKey === "PAID" ? (
              <StatusBadge status="active" compact>
                {localizeBillingStatus("PAID", locale)}
              </StatusBadge>
            ) : row.paymentKey === "AWAITING_PAYMENT" ? (
              <StatusBadge
                status="warning"
                compact
                lines={localizeBillingChipLines("awaitingPayment", locale)}
              />
            ) : row.paymentKey === "PENDING_VERIFICATION" ? (
              <StatusBadge
                status="pending"
                compact
                lines={localizeBillingChipLines("verifyingPayment", locale)}
              />
            ) : null}
          </div>
        ),
      },
    ];

    if (isPending && canManage) {
      cols.push({
        key: "actions",
        title: t("common.labels.actions"),
        width: ACTIONS_SINGLE_CHIP_COLUMN_WIDTH,
        align: "center",
        className: "min-w-[12.5rem] overflow-visible whitespace-nowrap",
        render: (row) => (
          <div
            className="inline-flex shrink-0 items-center justify-center whitespace-nowrap"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <TaxInvoiceDoneButton
              periodId={row.id}
              projectName={row.displayTitle}
              periodLabel={row.periodLabel}
            />
          </div>
        ),
      });
    }

    return cols;
  }, [canManage, isPending, locale, t]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowKey={(row) => row.id}
      onRowClick={
        rows.some((row) => row.billingHref)
          ? (row) => {
              if (row.billingHref) router.push(row.billingHref);
            }
          : undefined
      }
      emptyMessage={t("pages.billing.noTaxPending")}
    />
  );
}
