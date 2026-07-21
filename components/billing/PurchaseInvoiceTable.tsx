"use client";

import { useMemo, useState } from "react";

import PurchaseTaxInvoiceUploadDialog from "@/components/billing/PurchaseTaxInvoiceUploadDialog";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import ProofLightbox from "@/components/ui/ProofLightbox";
import StatusBadge from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";

export type PurchaseInvoiceTableRow = {
  id: string;
  supplierName: string;
  invoiceRef: string;
  invoiceDateLabel: string;
  /** From linked vendor terms (Cash / Net N); null when entered manually. */
  paymentTermsLabel: string | null;
  dueDateLabel: string | null;
  amountLabel: string;
  includesPpn: boolean;
  notes: string | null;
  filePath: string;
  taxInvoiceFilePath: string | null;
  uploadedBy: string | null;
  uploadedAtLabel: string;
  /** Vendor portal upload status for tax / document tracking. */
  taxStatus?: "uploaded" | "missing" | "not_required";
  /** Vendor portal settlement view (no paidAt yet — open vs overdue by due date). */
  paymentStatus?: "open" | "overdue" | null;
  showUploadStatus?: boolean;
  showPaymentStatus?: boolean;
};

type LightboxState = {
  src: string;
  title: string;
};

type TaxUploadTarget = {
  id: string;
  supplierName: string;
  invoiceRef: string;
};

type Props = {
  rows: PurchaseInvoiceTableRow[];
  canManage?: boolean;
  /** Hide tax-upload actions (payment/settlement read-only). */
  readOnlyPayment?: boolean;
};

export default function PurchaseInvoiceTable({
  rows,
  canManage = false,
  readOnlyPayment = false,
}: Props) {
  const { t } = useT();
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [taxUpload, setTaxUpload] = useState<TaxUploadTarget | null>(null);

  const columns = useMemo(() => {
    const cols: DataTableColumn<PurchaseInvoiceTableRow>[] = [
      {
        key: "supplier",
        title: t("pages.billing.purchaseSupplier"),
        width: "12rem",
        share: 2,
        className: "min-w-[12rem]",
        render: (row) => (
          <div className="min-w-0">
            <p className="font-semibold text-text">{row.supplierName}</p>
            <p className="mt-0.5 truncate text-sm text-subtle">
              {row.invoiceRef}
            </p>
          </div>
        ),
      },
      {
        key: "date",
        title: t("pages.billing.purchaseInvoiceDate"),
        width: "8rem",
        className: "min-w-[8rem] whitespace-nowrap",
        render: (row) => (
          <p className="text-muted">{row.invoiceDateLabel}</p>
        ),
      },
      {
        key: "paymentTerms",
        title: t("pages.billing.purchasePaymentTerms"),
        width: "7.5rem",
        className: "min-w-[7.5rem] whitespace-nowrap",
        render: (row) => (
          <p className="tabular-nums text-muted">
            {row.paymentTermsLabel ?? "—"}
          </p>
        ),
      },
      {
        key: "dueDate",
        title: t("pages.billing.paymentDue"),
        width: "8rem",
        className: "min-w-[8rem] whitespace-nowrap",
        render: (row) => (
          <p className="text-muted">{row.dueDateLabel ?? "—"}</p>
        ),
      },
      {
        key: "amount",
        title: t("pages.billing.columns.amount"),
        width: "9rem",
        align: "right",
        className: "min-w-[9rem] whitespace-nowrap",
        render: (row) => (
          <p className="font-medium text-text">{row.amountLabel}</p>
        ),
      },
      {
        key: "ppn",
        title: t("pages.billing.purchasePpnColumn"),
        width: "8.5rem",
        align: "center",
        className: "min-w-[8.5rem]",
        render: (row) =>
          row.includesPpn ? (
            <StatusBadge status="info" compact>
              {t("pages.billing.purchaseIncludesPpnChip")}
            </StatusBadge>
          ) : (
            <StatusBadge status="inactive" compact>
              {t("pages.billing.purchaseNoPpnChip")}
            </StatusBadge>
          ),
      },
      {
        key: "uploaded",
        title: t("pages.billing.purchaseUploaded"),
        width: "10rem",
        className: "min-w-[10rem]",
        render: (row) => (
          <div className="min-w-0">
            <p className="text-muted">{row.uploadedAtLabel}</p>
            {row.uploadedBy ? (
              <p className="mt-0.5 truncate text-xs text-subtle">
                {row.uploadedBy}
              </p>
            ) : null}
          </div>
        ),
      },
    ];

    if (rows.some((row) => row.showUploadStatus)) {
      cols.push({
        key: "uploadStatus",
        title: t("pages.billing.vendorUploadStatus"),
        width: "8.5rem",
        align: "center",
        className: "min-w-[8.5rem]",
        render: (row) => {
          if (row.taxStatus === "uploaded") {
            return (
              <StatusBadge status="success" compact>
                {t("pages.billing.vendorStatusTaxUploaded")}
              </StatusBadge>
            );
          }
          if (row.taxStatus === "missing") {
            return (
              <StatusBadge status="warning" compact>
                {t("pages.billing.vendorStatusTaxMissing")}
              </StatusBadge>
            );
          }
          return (
            <StatusBadge status="inactive" compact>
              {t("pages.billing.vendorStatusNoTaxRequired")}
            </StatusBadge>
          );
        },
      });
    }

    if (rows.some((row) => row.showPaymentStatus)) {
      cols.push({
        key: "paymentStatus",
        title: t("pages.billing.vendorPaymentStatus"),
        width: "7.5rem",
        align: "center",
        className: "min-w-[7.5rem]",
        render: (row) => {
          if (row.paymentStatus === "overdue") {
            return (
              <StatusBadge status="danger" compact>
                {t("pages.billing.vendorStatusOverdue")}
              </StatusBadge>
            );
          }
          if (row.paymentStatus === "open") {
            return (
              <StatusBadge status="info" compact>
                {t("pages.billing.vendorStatusOpen")}
              </StatusBadge>
            );
          }
          return <span className="text-sm text-subtle">—</span>;
        },
      });
    }

    cols.push(
      {
        key: "file",
        title: t("pages.billing.purchaseDocument"),
        width: "7rem",
        align: "center",
        className: "min-w-[7rem]",
        render: (row) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setLightbox({
                src: row.filePath,
                title: t("pages.billing.purchaseInvoice"),
              });
            }}
            className="text-sm font-medium text-primary-dark hover:underline"
          >
            {t("pages.billing.purchaseViewFile")}
          </button>
        ),
      },
      {
        key: "taxInvoice",
        title: t("pages.billing.purchaseTaxInvoice"),
        width: "8rem",
        align: "center",
        className: "min-w-[8rem]",
        render: (row) => {
          if (row.taxInvoiceFilePath) {
            return (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightbox({
                    src: row.taxInvoiceFilePath!,
                    title: t("pages.billing.purchaseTaxInvoice"),
                  });
                }}
                className="text-sm font-medium text-primary-dark hover:underline"
              >
                {t("pages.billing.purchaseViewTaxInvoice")}
              </button>
            );
          }

          if (canManage && !readOnlyPayment) {
            return (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setTaxUpload({
                    id: row.id,
                    supplierName: row.supplierName,
                    invoiceRef: row.invoiceRef,
                  });
                }}
                className="text-sm font-medium text-primary-dark hover:underline"
              >
                {t("pages.billing.purchaseUploadTaxInvoice")}
              </button>
            );
          }

          return (
            <span className="text-sm text-subtle">
              {t("pages.billing.purchaseNoTaxInvoice")}
            </span>
          );
        },
      }
    );

    return cols;
  }, [canManage, readOnlyPayment, rows, t]);

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        getRowKey={(row) => row.id}
        emptyMessage={t("pages.billing.purchaseEmpty")}
      />
      <ProofLightbox
        open={lightbox != null}
        onOpenChange={(open) => {
          if (!open) setLightbox(null);
        }}
        src={lightbox?.src ?? null}
        title={lightbox?.title ?? t("pages.billing.purchaseInvoice")}
      />
      {taxUpload ? (
        <PurchaseTaxInvoiceUploadDialog
          open
          onOpenChange={(open) => {
            if (!open) setTaxUpload(null);
          }}
          purchaseInvoiceId={taxUpload.id}
          supplierName={taxUpload.supplierName}
          invoiceRef={taxUpload.invoiceRef}
        />
      ) : null}
    </>
  );
}
