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

function MetaRow({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  if (value == null || value === "") return null;
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[0.625rem] font-medium uppercase tracking-[0.1em] text-subtle">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-text">{value}</dd>
    </div>
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

  const taxAction = row.taxInvoiceFilePath ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full justify-start"
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
      className="w-full justify-start"
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
    <span className="inline-flex min-h-7 items-center px-1 text-sm text-subtle">
      {t("pages.billing.purchaseNoTaxInvoice")}
    </span>
  );

  return (
    <article className="rounded-2xl border border-border-strong/65 bg-elevated p-4 shadow-[0_12px_28px_-20px_rgba(0,0,0,0.72)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h3 className="text-base font-semibold tracking-tight text-text">
                {row.supplierName}
              </h3>
              <p className="truncate text-sm text-subtle">{row.invoiceRef}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <MetaRow
              label={t("pages.billing.purchaseInvoiceDate")}
              value={row.invoiceDateLabel}
            />
            <MetaRow
              label={t("pages.billing.purchasePaymentTerms")}
              value={
                <span className="tabular-nums">
                  {row.paymentTermsLabel ?? "—"}
                </span>
              }
            />
            <MetaRow
              label={t("pages.billing.paymentDue")}
              value={row.dueDateLabel ?? "—"}
            />
            <MetaRow
              label={t("pages.billing.columns.amount")}
              value={
                <span className="font-semibold tabular-nums">
                  {row.amountLabel}
                </span>
              }
            />
            <MetaRow
              label={t("pages.billing.purchaseUploaded")}
              value={
                <span>
                  {row.uploadedAtLabel}
                  {row.uploadedBy ? (
                    <span className="mt-0.5 block text-xs text-subtle">
                      {row.uploadedBy}
                    </span>
                  ) : null}
                </span>
              }
            />
            {row.notes ? (
              <MetaRow
                label={t("pages.billing.purchaseNotes")}
                value={row.notes}
                className="sm:col-span-2 lg:col-span-3 xl:col-span-5"
              />
            ) : null}
          </dl>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-[12.5rem]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start"
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
      <div className="flex flex-col gap-5">
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
