"use client";

import Link from "next/link";

import StatusBadge from "@/components/ui/StatusBadge";
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
    | "VEHICLE";
  governmentTaxKindLabel?: string | null;
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
  const recordChips =
    row.origin === "IMPORT"
      ? (row.recordChips?.length
          ? row.recordChips
          : row.recordStatus && row.recordStatus !== "complete"
            ? [row.recordStatus]
            : [])
      : [];

  return (
    <article className="overflow-hidden rounded-2xl border border-border-strong/65 bg-elevated shadow-[0_12px_28px_-20px_rgba(0,0,0,0.72)]">
      <Link
        href={`/billing/purchase-invoices/${row.id}`}
        className="grid grid-cols-1 items-center gap-3 p-5 transition hover:bg-card-hover/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/40 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-6"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold tracking-tight text-text">
              {row.supplierName}
            </h3>
            {row.origin === "IMPORT" ? (
              <span className="shrink-0 rounded-md border border-accent-cyan/40 bg-card-tint-cyan px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.04em] text-accent-teal">
                {t("pages.billing.purchaseOriginChipImport")}
              </span>
            ) : null}
            {row.purchaseCategory === "GOVERNMENT" ? (
              <span className="shrink-0 rounded-md border border-accent-cyan/40 bg-card-tint-cyan px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.04em] text-accent-teal">
                {row.governmentTaxKindLabel ?? t("pages.billing.governmentChip")}
              </span>
            ) : null}
            {row.purchaseCategory === "VEHICLE" ? (
              <span className="shrink-0 rounded-md border border-accent-cyan/40 bg-card-tint-cyan px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.04em] text-accent-teal">
                {t("pages.billing.purchaseCategoryVehicle")}
              </span>
            ) : null}
            {row.freeOfCharge ? (
              <span className="shrink-0 rounded-md border border-accent-cyan/40 bg-card-tint-cyan px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.04em] text-accent-teal">
                {t("pages.billing.purchaseFreeOfChargeChip")}
              </span>
            ) : null}
            {recordChips.map((chip) => (
              <span
                key={chip}
                className="shrink-0 rounded-md border border-amber-400/50 bg-amber-500/10 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.04em] text-amber-700"
              >
                {chip === "awaiting_import_duties"
                  ? t("pages.billing.purchaseStatusAwaitingImportDuties")
                  : chip === "awaiting_vendor_payment"
                    ? t("pages.billing.purchaseStatusAwaitingVendorPayment")
                    : chip === "awaiting_handling"
                      ? t("pages.billing.purchaseStatusAwaitingHandling")
                      : chip === "awaiting_shipping"
                        ? t("pages.billing.purchaseStatusAwaitingShipping")
                        : t("pages.billing.purchaseStatusRecordNotCompleted")}
              </span>
            ))}
          </div>
          <p className="mt-1 text-sm text-subtle">
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
        </div>
        <div className="flex justify-start sm:justify-center">
          {isPaid ? (
            <StatusBadge status="success" compact>
              {t("pages.billing.vendorStatusPaid")}
            </StatusBadge>
          ) : row.paymentStatus === "overdue" ? (
            <StatusBadge status="danger" compact>
              {t("pages.billing.vendorStatusOverdue")}
            </StatusBadge>
          ) : row.paymentStatus === "open" ? (
            <StatusBadge status="info" compact>
              {t("pages.billing.vendorStatusOpen")}
            </StatusBadge>
          ) : (
            <span className="hidden sm:block sm:min-w-[7.5rem]" aria-hidden />
          )}
        </div>
        <div className="flex items-center justify-start sm:justify-end">
          <p className="text-base font-semibold tabular-nums tracking-tight text-text">
            {row.amountLabel}
          </p>
        </div>
      </Link>
    </article>
  );
}

export default function PurchaseInvoiceTable({ rows }: Props) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <PurchaseInvoiceCard key={row.id} row={row} />
      ))}
    </div>
  );
}
