"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Upload } from "lucide-react";

import {
  markImportDutiesPaid,
  reversePurchaseInvoice,
} from "@/app/billing/purchase-invoices/actions";
import PurchaseMarkPaidDialog from "@/components/billing/PurchaseMarkPaidDialog";
import PurchaseTaxInvoiceUploadDialog from "@/components/billing/PurchaseTaxInvoiceUploadDialog";
import { BillingDocumentFilePick } from "@/components/billing/BillingDocumentVerifyDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import ProofLightbox from "@/components/ui/ProofLightbox";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import type { PurchaseDocumentSlot } from "@/lib/purchase-invoice-documents";

type Props = {
  purchaseInvoiceId: string;
  supplierName: string;
  invoiceRef: string;
  documents: PurchaseDocumentSlot[];
  canManage: boolean;
  canMarkPaid: boolean;
  isPaid: boolean;
  showLocalTaxUpload: boolean;
  canMarkDutiesPaid?: boolean;
  importDutiesBillingId?: string | null;
  isImport?: boolean;
};

export default function PurchaseInvoiceDetailClient({
  purchaseInvoiceId,
  supplierName,
  invoiceRef,
  documents,
  canManage,
  canMarkPaid,
  isPaid,
  showLocalTaxUpload,
  canMarkDutiesPaid = false,
  importDutiesBillingId = null,
  isImport = false,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(
    null
  );
  const [taxUpload, setTaxUpload] = useState(false);
  const [markPaid, setMarkPaid] = useState(false);
  const [dutiesOpen, setDutiesOpen] = useState(false);
  const [dutiesBillingId, setDutiesBillingId] = useState(
    importDutiesBillingId ?? ""
  );
  const [dutiesFile, setDutiesFile] = useState<File | null>(null);

  return (
    <>
      <div className="space-y-3">
        {documents.map((doc) => {
          const title = t(doc.titleKey);
          return (
            <div
              key={doc.kind}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-elevated px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">{title}</p>
                {doc.hintKey ? (
                  <p className="mt-1 text-xs leading-snug text-subtle">
                    {t(doc.hintKey)}
                  </p>
                ) : null}
                {!doc.href ? (
                  <p className="mt-1 text-xs text-muted">
                    {t("pages.billing.purchaseDocumentMissing")}
                  </p>
                ) : null}
              </div>
              {doc.href ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5"
                  onClick={() => setLightbox({ src: doc.href!, title })}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                  {t("pages.billing.purchaseViewFile")}
                </Button>
              ) : doc.kind === "tax" && showLocalTaxUpload && canManage ? (
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5"
                  onClick={() => setTaxUpload(true)}
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden />
                  {t("pages.billing.purchaseUploadTaxInvoiceAction")}
                </Button>
              ) : (
                <span className="inline-flex h-8 items-center text-xs text-subtle">
                  {t("pages.billing.purchaseNoTaxInvoice")}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {canMarkDutiesPaid ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={pending}
            onClick={() => setDutiesOpen(true)}
          >
            {t("pages.billing.purchaseCompleteImportArrival")}
          </Button>
        ) : null}
        {canMarkPaid && !isPaid ? (
          <Button
            type="button"
            variant="accent"
            size="sm"
            className="h-8"
            onClick={() => setMarkPaid(true)}
          >
            {isImport
              ? t("pages.billing.invoicePaid")
              : t("pages.billing.purchaseMarkPaid")}
          </Button>
        ) : null}
        {canManage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={pending}
            onClick={() => {
              const reason = window.prompt(
                t("pages.billing.purchaseReverseReason")
              );
              if (!reason?.trim()) return;
              const formData = new FormData();
              formData.set("purchaseInvoiceId", purchaseInvoiceId);
              formData.set("reason", reason.trim());
              startTransition(async () => {
                try {
                  await reversePurchaseInvoice(formData);
                  router.push("/billing/purchase-invoices");
                  router.refresh();
                } catch (error) {
                  showRejectionFromError(
                    error,
                    t("pages.billing.purchaseReverseFailed")
                  );
                }
              });
            }}
          >
            {t("pages.billing.purchaseReverse")}
          </Button>
        ) : null}
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
            if (!open) setTaxUpload(false);
          }}
          purchaseInvoiceId={purchaseInvoiceId}
          supplierName={supplierName}
          invoiceRef={invoiceRef}
        />
      ) : null}
      {markPaid ? (
        <PurchaseMarkPaidDialog
          open
          onOpenChange={(open) => {
            if (!open) setMarkPaid(false);
          }}
          purchaseInvoiceId={purchaseInvoiceId}
          supplierName={supplierName}
          invoiceRef={invoiceRef}
        />
      ) : null}
      <Dialog open={dutiesOpen} onOpenChange={setDutiesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("pages.billing.purchaseCompleteImportArrival")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-subtle">
            {t("pages.billing.purchaseCompleteImportArrivalHint")}
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                {t("pages.billing.importDutiesBillingId")}
              </label>
              <Input
                value={dutiesBillingId}
                onChange={(event) => setDutiesBillingId(event.target.value)}
                disabled={pending}
              />
            </div>
            <BillingDocumentFilePick
              id="complete-import-duties-document"
              label={t("pages.billing.importDutiesDocument")}
              required
              fileName={dutiesFile?.name ?? null}
              onPick={setDutiesFile}
              disabled={pending}
            />
            <Button
              type="button"
              variant="accent"
              disabled={pending || !dutiesBillingId.trim()}
              onClick={() => {
                if (!dutiesBillingId.trim()) return;
                const formData = new FormData();
                formData.set("purchaseInvoiceId", purchaseInvoiceId);
                formData.set("importDutiesBillingId", dutiesBillingId.trim());
                if (dutiesFile && dutiesFile.size > 0) {
                  formData.set("importDutiesDocument", dutiesFile);
                }
                startTransition(async () => {
                  try {
                    await markImportDutiesPaid(formData);
                    setDutiesOpen(false);
                    router.refresh();
                  } catch (error) {
                    showRejectionFromError(
                      error,
                      t("pages.billing.purchaseUploadFailed")
                    );
                  }
                });
              }}
            >
              {t("pages.billing.purchaseCompleteImportArrival")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
