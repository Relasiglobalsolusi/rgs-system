"use client";

import StatusBadge, { outlineChipTones } from "@/components/ui/StatusBadge";
import FinanceRecordRow, {
  financeListStatusChipClassName,
  financeListTypeChipClassName,
  financeRecordListClassName,
} from "@/components/ui/FinanceRecordRow";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

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
    <FinanceRecordRow
      href={`/billing/purchase-invoices/${row.id}`}
      type={
        <>
          {categoryLabels.map((label) => (
            <span
              key={label}
              className={cn(financeListTypeChipClassName, outlineChipTones.cyan)}
            >
              {label}
            </span>
          ))}
          {recordChips.map((chip) => (
            <span
              key={chip}
              className={cn(
                financeListTypeChipClassName,
                outlineChipTones.warning
              )}
            >
              {recordChipLabel(chip, t)}
            </span>
          ))}
        </>
      }
      title={
        <>
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
