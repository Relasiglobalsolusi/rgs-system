"use client";

import { useState, type ReactNode } from "react";
import { Banknote, Eye, FileText, Upload } from "lucide-react";

import PurchaseMarkPaidDialog from "@/components/billing/PurchaseMarkPaidDialog";
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
  /** PPN on but faktur pajak not uploaded yet. */
  taxIncomplete?: boolean;
  notes: string | null;
  filePath: string;
  taxInvoiceFilePath: string | null;
  uploadedBy: string | null;
  uploadedAtLabel: string;
  /** Open / overdue for unpaid; paid when paidAt set. */
  paymentStatus?: "open" | "overdue" | "paid" | null;
  showPaymentStatus?: boolean;
  paidAtLabel?: string | null;
  paymentProofPath?: string | null;
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

type MarkPaidTarget = {
  id: string;
  supplierName: string;
  invoiceRef: string;
};

type Props = {
  rows: PurchaseInvoiceTableRow[];
  canManage?: boolean;
  /** Hide tax-upload actions (payment/settlement read-only for tax). */
  readOnlyPayment?: boolean;
  /** Show Mark Paid when unpaid (Purchases card + Payment view). */
  canMarkPaid?: boolean;
};

function MetaRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: ReactNode;
  emphasize?: boolean;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="min-w-0">
      <dt className="text-[0.625rem] font-medium uppercase tracking-[0.1em] text-subtle">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-sm text-text",
          emphasize &&
            "text-base font-semibold tabular-nums tracking-tight text-text"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function PurchaseInvoiceCard({
  row,
  canManage,
  readOnlyPayment,
  canMarkPaid,
  onViewFile,
  onUploadTax,
  onMarkPaid,
}: {
  row: PurchaseInvoiceTableRow;
  canManage: boolean;
  readOnlyPayment: boolean;
  canMarkPaid: boolean;
  onViewFile: (src: string, title: string) => void;
  onUploadTax: (target: TaxUploadTarget) => void;
  onMarkPaid: (target: MarkPaidTarget) => void;
}) {
  const { t } = useT();
  const isPaid = row.paymentStatus === "paid" || Boolean(row.paidAtLabel);

  const taxAction = row.taxInvoiceFilePath ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5"
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
      className="h-8 gap-1.5"
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
    <span className="inline-flex h-8 items-center px-1 text-xs text-subtle">
      {t("pages.billing.purchaseNoTaxInvoice")}
    </span>
  );

  const paymentStatusBadge = row.showPaymentStatus ? (
    row.paymentStatus === "paid" ? (
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
    ) : null
  ) : isPaid ? (
    <StatusBadge status="success" compact>
      {t("pages.billing.vendorStatusPaid")}
    </StatusBadge>
  ) : null;

  const markPaidAction =
    canMarkPaid && !isPaid ? (
      <Button
        type="button"
        variant="accent"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() =>
          onMarkPaid({
            id: row.id,
            supplierName: row.supplierName,
            invoiceRef: row.invoiceRef,
          })
        }
      >
        <Banknote className="h-3.5 w-3.5" aria-hidden />
        {t("pages.billing.purchaseMarkPaid")}
      </Button>
    ) : null;

  const paymentProofAction =
    row.paymentProofPath && isPaid ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() =>
          onViewFile(
            row.paymentProofPath!,
            t("pages.billing.proofOfPayment")
          )
        }
      >
        <Eye className="h-3.5 w-3.5" aria-hidden />
        {t("pages.billing.purchaseViewPaymentProof")}
      </Button>
    ) : null;

  return (
    <article className="rounded-2xl border border-border-strong/65 bg-elevated p-4 shadow-[0_12px_28px_-20px_rgba(0,0,0,0.72)]">
      <div className="flex min-w-0 items-center gap-2">
        <h3 className="truncate text-sm font-semibold tracking-tight text-text">
          {row.supplierName}
        </h3>
        <p className="min-w-0 truncate text-xs text-subtle">
          {t("pages.billing.purchaseInvoiceRefShort", {
            ref: row.invoiceRef,
          })}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 items-center gap-x-4 gap-y-3 border-t border-border pt-3 sm:grid-cols-5">
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
          label={
            isPaid
              ? t("pages.billing.purchasePaidAt")
              : t("pages.billing.paymentDue")
          }
          value={
            isPaid
              ? (row.paidAtLabel ?? "—")
              : (row.dueDateLabel ?? "—")
          }
        />
        <MetaRow
          label={t("pages.billing.purchaseAmount")}
          value={row.amountLabel}
          emphasize
        />
        <div className="col-span-2 flex items-center justify-end gap-1.5 sm:col-span-1 sm:justify-center">
          {paymentStatusBadge}
          {row.taxIncomplete ? (
            <StatusBadge status="pending" compact>
              {t("pages.billing.vendorAwaitingTax")}
            </StatusBadge>
          ) : row.includesPpn ? (
            <StatusBadge status="success" compact>
              {t("pages.billing.purchaseIncludesPpnChip")}
            </StatusBadge>
          ) : (
            <StatusBadge status="inactive" compact>
              {t("pages.billing.purchaseNoPpnChip")}
            </StatusBadge>
          )}
        </div>
      </dl>

      {row.notes ? (
        <p className="mt-3 truncate text-xs text-subtle">
          <span className="font-medium text-muted">
            {t("pages.billing.purchaseNotes")}:{" "}
          </span>
          {row.notes}
        </p>
      ) : null}

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 border-t border-border pt-3">
        <p className="min-w-0 flex-1 text-xs leading-snug text-subtle">
          {t("pages.billing.purchaseUploaded")}
          {row.uploadedBy ? (
            <>
              {" "}
              <span className="text-muted">{row.uploadedBy}</span>
            </>
          ) : null}
          <span className="mx-1.5 text-border-strong" aria-hidden>
            ·
          </span>
          {row.uploadedAtLabel}
        </p>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() =>
              onViewFile(row.filePath, t("pages.billing.purchaseInvoice"))
            }
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {t("pages.billing.purchaseViewInvoiceAction")}
          </Button>
          {taxAction}
          {paymentProofAction}
          {markPaidAction}
        </div>
      </div>
    </article>
  );
}

export default function PurchaseInvoiceTable({
  rows,
  canManage = false,
  readOnlyPayment = false,
  canMarkPaid = false,
}: Props) {
  const { t } = useT();
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [taxUpload, setTaxUpload] = useState<TaxUploadTarget | null>(null);
  const [markPaid, setMarkPaid] = useState<MarkPaidTarget | null>(null);

  if (rows.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <PurchaseInvoiceCard
            key={row.id}
            row={row}
            canManage={canManage}
            readOnlyPayment={readOnlyPayment}
            canMarkPaid={canMarkPaid}
            onViewFile={(src, title) => setLightbox({ src, title })}
            onUploadTax={setTaxUpload}
            onMarkPaid={setMarkPaid}
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
      {markPaid ? (
        <PurchaseMarkPaidDialog
          open
          onOpenChange={(open) => {
            if (!open) setMarkPaid(null);
          }}
          purchaseInvoiceId={markPaid.id}
          supplierName={markPaid.supplierName}
          invoiceRef={markPaid.invoiceRef}
        />
      ) : null}
    </>
  );
}
