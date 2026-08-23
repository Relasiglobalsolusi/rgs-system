"use client";

import Link from "next/link";

import StatusBadge, { outlineChipTones } from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

/** Type chips: compact pill, not the 2.75rem StatusBadge box. */
const listTypeChipClassName =
  "inline-flex h-7 min-h-7 w-auto min-w-0 shrink-0 items-center justify-center whitespace-nowrap rounded-md border px-2 text-[0.625rem] font-semibold uppercase leading-none tracking-[0.04em]";

/** Status chips: compact pill, label optically centered (not the 2.75rem box). */
const listStatusChipClassName =
  "inline-flex h-8 max-h-8 min-h-8 w-auto min-w-[4.75rem] items-center justify-center px-2.5 py-0 text-[0.6875rem] leading-none";

/** Desktop: same title column on every row so type chips line up.
 * Phone: vendor + status/amount on one centered row so nothing clips. */
const expenseRowClassName =
  "flex min-w-0 flex-col justify-center gap-2 px-3.5 py-2.5 transition hover:bg-card-hover/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/40 md:grid md:grid-cols-[minmax(0,20rem)_max-content_minmax(0,1fr)_auto] md:items-center md:gap-x-10 md:px-4 md:py-2";

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
    | "BANK_LOAN";
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

function categoryChipLabels(
  row: PurchaseInvoiceTableRow,
  t: (key: string) => string
): string[] {
  const labels: string[] = [];
  if (row.origin === "IMPORT") {
    labels.push(t("pages.billing.purchaseOriginChipImport"));
  }
  if (row.purchaseCategory === "GOVERNMENT") {
    labels.push(row.governmentTaxKindLabel ?? t("pages.billing.governmentChip"));
  }
  if (row.purchaseCategory === "VEHICLE") {
    labels.push(t("pages.billing.purchaseCategoryVehicle"));
  }
  if (row.purchaseCategory === "BANK_LOAN") {
    labels.push(t("pages.billing.purchaseCategoryBankLoan"));
  }
  if (row.freeOfCharge) {
    labels.push(t("pages.billing.purchaseFreeOfChargeChip"));
  }
  return labels;
}

function recordChipLabel(
  chip: NonNullable<PurchaseInvoiceTableRow["recordChips"]>[number],
  t: (key: string) => string
): string {
  if (chip === "awaiting_import_duties") {
    return t("pages.billing.purchaseStatusAwaitingImportDuties");
  }
  if (chip === "awaiting_vendor_payment") {
    return t("pages.billing.purchaseStatusAwaitingVendorPayment");
  }
  if (chip === "awaiting_handling") {
    return t("pages.billing.purchaseStatusAwaitingHandling");
  }
  if (chip === "awaiting_shipping") {
    return t("pages.billing.purchaseStatusAwaitingShipping");
  }
  return t("pages.billing.purchaseStatusRecordNotCompleted");
}

function CategoryChip({ label }: { label: string }) {
  return (
    <span className={cn(listTypeChipClassName, outlineChipTones.cyan)}>
      {label}
    </span>
  );
}

function PurchaseInvoiceCard({ row }: { row: PurchaseInvoiceTableRow }) {
  const { t } = useT();
  const isPaid = row.paymentStatus === "paid";
  const recordChips =
    row.origin === "IMPORT"
      ? row.recordChips?.length
        ? row.recordChips
        : row.recordStatus && row.recordStatus !== "complete"
          ? [row.recordStatus]
          : []
      : [];
  const categoryLabels = categoryChipLabels(row, t);

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-elevated">
      <Link
        href={`/billing/purchase-invoices/${row.id}`}
        className={expenseRowClassName}
      >
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold leading-none tracking-tight text-text">
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
        </div>

        {categoryLabels.length > 0 || recordChips.length > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {categoryLabels.map((label) => (
              <CategoryChip key={label} label={label} />
            ))}
            {recordChips.map((chip) => (
              <span
                key={chip}
                className={cn(listTypeChipClassName, outlineChipTones.warning)}
              >
                {recordChipLabel(chip, t)}
              </span>
            ))}
          </div>
        ) : (
          <div className="hidden md:block" aria-hidden />
        )}

        <div className="hidden md:block" aria-hidden />

        <div className="flex h-8 w-full items-center justify-between gap-2">
          {row.paymentStatus ? (
            <StatusBadge
              status={
                isPaid
                  ? "success"
                  : row.paymentStatus === "overdue"
                    ? "danger"
                    : "info"
              }
              className={listStatusChipClassName}
            >
              <span className="flex h-full w-full items-center justify-center leading-none">
                {isPaid
                  ? t("pages.billing.vendorStatusPaid")
                  : row.paymentStatus === "overdue"
                    ? t("pages.billing.vendorStatusOverdue")
                    : t("pages.billing.vendorStatusOpen")}
              </span>
            </StatusBadge>
          ) : (
            <span />
          )}
          <p className="flex h-8 items-center text-right text-sm font-semibold leading-none tabular-nums tracking-tight text-text">
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
    <div className="flex min-w-0 flex-col gap-2">
      {rows.map((row) => (
        <PurchaseInvoiceCard key={row.id} row={row} />
      ))}
    </div>
  );
}
