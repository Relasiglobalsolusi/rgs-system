"use client";

import StatusBadge from "@/components/ui/StatusBadge";
import FinanceRecordRow, {
  financeListStatusChipClassName,
  financeRecordListClassName,
} from "@/components/ui/FinanceRecordRow";
import { useT } from "@/lib/i18n/use-t";

export type PurchaseInvoiceTableRow = {
  id: string;
  supplierName: string;
  invoiceRef: string;
  invoiceDateLabel: string;
  amountLabel: string;
  origin?: "LOCAL" | "IMPORT";
  purchaseCategory?:
    | "PRODUCT"
    | "SERVICE"
    | "PETTY_CASH"
    | "GOVERNMENT"
    | "VEHICLE"
    | "BANK_LOAN"
    | "EMPLOYEE_PAYMENT";
  payFromLabel?: string | null;
  payToLabel?: string | null;
  freeOfCharge?: boolean;
  hasInvoice?: boolean;
  paymentStatus?: "open" | "overdue" | "paid" | null;
  recordStatus?:
    | "complete"
    | "record_not_completed"
    | "awaiting_import_duties"
    | "awaiting_vendor_payment"
    | "awaiting_handling"
    | "awaiting_shipping"
    | null;
  recordChips?: Array<
    | "record_not_completed"
    | "awaiting_import_duties"
    | "awaiting_vendor_payment"
    | "awaiting_handling"
    | "awaiting_shipping"
  >;
};

type Props = {
  rows: PurchaseInvoiceTableRow[];
};

function PurchaseInvoiceCard({ row }: { row: PurchaseInvoiceTableRow }) {
  const { t } = useT();
  const isPaid = row.paymentStatus === "paid";

  return (
    <FinanceRecordRow
      href={`/billing/purchase-invoices/${row.id}`}
      title={
        <>
          <h3 className="text-left text-sm font-semibold leading-snug tracking-tight text-text">
            {row.supplierName}
          </h3>
          <p className="mt-1 truncate text-xs leading-none text-subtle">
            {row.purchaseCategory === "GOVERNMENT"
              ? t("pages.billing.governmentBillingIdShort", {
                  ref: row.invoiceRef,
                })
              : row.hasInvoice === false
                ? t("pages.billing.purchaseInvoiceRefNone")
                : t("pages.billing.purchaseInvoiceRefShort", {
                    ref: row.invoiceRef,
                  })}
            <span className="mx-1.5 text-border-strong" aria-hidden>
              ·
            </span>
            {row.invoiceDateLabel}
          </p>
          {row.payFromLabel || row.payToLabel ? (
            <p className="mt-1 truncate text-xs leading-snug text-muted">
              {t("pages.billing.expenseReportBanks", {
                from: row.payFromLabel || "—",
                to: row.payToLabel || "—",
              })}
            </p>
          ) : null}
        </>
      }
      status={
        row.paymentStatus ? (
          <StatusBadge
            status={
              isPaid
                ? "success"
                : row.paymentStatus === "overdue"
                  ? "danger"
                  : "info"
            }
            className={financeListStatusChipClassName}
          >
            <span className="flex h-full w-full items-center justify-center text-center leading-none">
              {isPaid
                ? t("pages.billing.vendorStatusPaid")
                : row.paymentStatus === "overdue"
                  ? t("pages.billing.vendorStatusOverdue")
                  : t("pages.billing.vendorStatusOpen")}
            </span>
          </StatusBadge>
        ) : null
      }
      amount={row.amountLabel}
    />
  );
}

export default function PurchaseInvoiceTable({ rows }: Props) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className={financeRecordListClassName}>
      {rows.map((row) => (
        <PurchaseInvoiceCard key={row.id} row={row} />
      ))}
    </div>
  );
}
