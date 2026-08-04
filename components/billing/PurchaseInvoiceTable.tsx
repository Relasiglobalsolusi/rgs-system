"use client";

import { useState, type ReactNode } from "react";
import { Eye, FileText, Upload } from "lucide-react";

import PurchaseTaxInvoiceUploadDialog from "@/components/billing/PurchaseTaxInvoiceUploadDialog";
import { Button } from "@/components/ui/button";
import ProofLightbox from "@/components/ui/ProofLightbox";
import StatusBadge from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

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
  /** Vendor portal settlement view (no paidAt yet — open vs overdue by due date). */
  paymentStatus?: "open" | "overdue" | null;
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

function MetaSep() {
  return (
    <span className="select-none text-border-strong" aria-hidden>
      ·
    </span>
  );
}

function MetaFact({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  if (children == null || children === "") return null;
  return (
    <span className={cn("min-w-0 text-subtle", className)}>{children}</span>
  );
}

function PurchaseInvoiceCard({
  row,
  canManage,
  readOnlyPayment,
  onViewFile,
  onUploadTax,
}: {
  row: PurchaseInvoiceTableRow;
  canManage: boolean;
  readOnlyPayment: boolean;
  onViewFile: (src: string, title: string) => void;
  onUploadTax: (target: TaxUploadTarget) => void;
}) {
  const { t } = useT();

  const actionBtnClass = "h-7 w-full justify-center gap-1.5 px-2.5";

  const taxAction = row.taxInvoiceFilePath ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={actionBtnClass}
      onClick={() =>
        onViewFile(
          row.taxInvoiceFilePath!,
          t("pages.billing.purchaseTaxInvoice")
        )
      }
    >
      <FileText className="h-3.5 w-3.5" aria-hidden />
      {t("pages.billing.purchaseViewTaxInvoiceAction")}
    </Button>
  ) : canManage && !readOnlyPayment ? (
    <Button
      type="button"
      variant="accent"
      size="sm"
      className={actionBtnClass}
      onClick={() =>
        onUploadTax({
          id: row.id,
          supplierName: row.supplierName,
          invoiceRef: row.invoiceRef,
        })
      }
    >
      <Upload className="h-3.5 w-3.5" aria-hidden />
      {t("pages.billing.purchaseUploadTaxInvoiceAction")}
    </Button>
  ) : (
    <span className="inline-flex h-7 items-center justify-center px-1 text-xs text-subtle">
      {t("pages.billing.purchaseNoTaxInvoice")}
    </span>
  );

  const uploadedMeta = (
    <>
      {row.uploadedAtLabel}
      {row.uploadedBy ? (
        <>
          {" "}
          <span className="text-muted">{row.uploadedBy}</span>
        </>
      ) : null}
    </>
  );

  return (
    <article className="rounded-2xl border border-border-strong/65 bg-elevated px-3.5 py-3 shadow-[0_12px_28px_-20px_rgba(0,0,0,0.72)] sm:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-sm font-semibold tracking-tight text-text">
              {row.supplierName}
            </h3>
            {row.showPaymentStatus ? (
              row.paymentStatus === "overdue" ? (
                <StatusBadge status="danger" compact>
                  {t("pages.billing.vendorStatusOverdue")}
                </StatusBadge>
              ) : row.paymentStatus === "open" ? (
                <StatusBadge status="info" compact>
                  {t("pages.billing.vendorStatusOpen")}
                </StatusBadge>
              ) : null
            ) : null}
            {row.includesPpn ? (
              <StatusBadge status="success" compact>
                {t("pages.billing.purchaseIncludesPpnChip")}
              </StatusBadge>
            ) : (
              <StatusBadge status="inactive" compact>
                {t("pages.billing.purchaseNoPpnChip")}
              </StatusBadge>
            )}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-snug">
            <MetaFact className="font-medium text-muted">{row.invoiceRef}</MetaFact>
            <MetaSep />
            <MetaFact>{row.invoiceDateLabel}</MetaFact>
            <MetaSep />
            <MetaFact className="tabular-nums">
              {row.paymentTermsLabel ?? "—"}
            </MetaFact>
            <MetaSep />
            <MetaFact className="text-text">{row.dueDateLabel ?? "—"}</MetaFact>
            <MetaSep />
            <span className="text-base font-semibold tabular-nums tracking-tight text-text">
              {row.amountLabel}
            </span>
          </div>

          <p className="text-xs leading-snug text-subtle">
            <span className="font-medium uppercase tracking-[0.08em] text-muted">
              {t("pages.billing.purchaseUploaded")}
            </span>
            <span className="mx-1.5 text-border-strong" aria-hidden>
              ·
            </span>
            {uploadedMeta}
          </p>

          {row.notes ? (
            <p className="truncate text-xs text-subtle">
              <span className="font-medium text-muted">
                {t("pages.billing.purchaseNotes")}:{" "}
              </span>
              {row.notes}
            </p>
          ) : null}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-[10.25rem]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={actionBtnClass}
            onClick={() =>
              onViewFile(row.filePath, t("pages.billing.purchaseInvoice"))
            }
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {t("pages.billing.purchaseViewInvoiceAction")}
          </Button>
          {taxAction}
        </div>
      </div>
    </article>
  );
}

export default function PurchaseInvoiceTable({
  rows,
  canManage = false,
  readOnlyPayment = false,
}: Props) {
  const { t } = useT();
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [taxUpload, setTaxUpload] = useState<TaxUploadTarget | null>(null);

  if (rows.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <PurchaseInvoiceCard
            key={row.id}
            row={row}
            canManage={canManage}
            readOnlyPayment={readOnlyPayment}
            onViewFile={(src, title) => setLightbox({ src, title })}
            onUploadTax={setTaxUpload}
          />
        ))}
      </div>
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
