"use client";

import Link from "next/link";

import StatusBadge, { outlineChipTones } from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

/** Type chips: compact pill, not the 2.75rem StatusBadge box. */
const listTypeChipClassName =
  "inline-flex h-7 min-h-7 w-auto min-w-0 shrink-0 items-center justify-center whitespace-nowrap rounded-md border px-2 text-[0.625rem] font-semibold uppercase leading-none tracking-[0.04em]";

/** Status chips: between the original tiny pill and the 2.75rem box. */
const listStatusChipClassName =
  "h-8 min-h-8 w-auto min-w-[4.75rem] px-2.5 text-[0.6875rem]";

/** Same title column on every row so type chips line up. */
const expenseRowClassName =
  "grid grid-cols-[20rem_max-content_minmax(0,1fr)_auto] items-center gap-x-10 px-4 py-2 transition hover:bg-card-hover/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/40";

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
    <article className="rounded-xl border border-border bg-elevated">
      <Link
        href={`/billing/purchase-invoices/${row.id}`}
        className={expenseRowClassName}
      >
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-tight text-text">
            {row.supplierName}
          </h3>
          <p className="mt-0.5 truncate text-xs text-subtle">
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

        <div className="flex items-center gap-1.5">
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

        <div aria-hidden />

        <div className="flex shrink-0 items-center gap-2.5">
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
              {isPaid
                ? t("pages.billing.vendorStatusPaid")
                : row.paymentStatus === "overdue"
                  ? t("pages.billing.vendorStatusOverdue")
                  : t("pages.billing.vendorStatusOpen")}
            </StatusBadge>
          ) : null}
          <p className="min-w-[5.5rem] text-right text-sm font-semibold tabular-nums tracking-tight text-text">
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
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <PurchaseInvoiceCard key={row.id} row={row} />
      ))}
    </div>
  );
}
