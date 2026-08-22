"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Upload } from "lucide-react";

import {
  markImportDutiesPaid,
  reversePurchaseInvoice,
} from "@/app/billing/purchase-invoices/actions";
import PurchaseImportCostFields, {
  importDraftToInput,
  purchaseImportDraftFromRecord,
  type PurchaseImportArrivalRecord,
} from "@/components/billing/PurchaseImportCostFields";
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
  needsImportBankRate?: boolean;
  invoiceCurrency?: string | null;
  invoiceForeignAmount?: number | null;
  bookingRate?: number | null;
  importArrival?: PurchaseImportArrivalRecord;
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
  needsImportBankRate = false,
  invoiceCurrency = null,
  invoiceForeignAmount = null,
  bookingRate = null,
  importArrival,
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
  const [importDraft, setImportDraft] = useState(() =>
    purchaseImportDraftFromRecord(importArrival ?? {})
  );
  const [dutiesError, setDutiesError] = useState<string | null>(null);

  useEffect(() => {
    if (!dutiesOpen) return;
    setImportDraft(purchaseImportDraftFromRecord(importArrival ?? {}));
    setDutiesError(null);
    // Snapshot factory-invoice amounts when the dialog opens. Do not reset while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dutiesOpen]);

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
          needsImportBankRate={needsImportBankRate}
          invoiceCurrency={invoiceCurrency}
          invoiceForeignAmount={invoiceForeignAmount}
          bookingRate={bookingRate}
        />
      ) : null}
      <Dialog open={dutiesOpen} onOpenChange={setDutiesOpen}>
        <DialogContent className="flex max-h-[min(94vh,44rem)] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("pages.billing.purchaseImportDutiesSectionTitle")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-subtle">
            {t("pages.billing.purchaseCompleteImportArrivalHint")}
          </p>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <PurchaseImportCostFields
              draft={importDraft}
              onChange={setImportDraft}
              disabled={pending}
              totalQuantity={importArrival?.totalQuantity ?? 0}
              requireBankRate={false}
              lockFactoryNow
              showCustomsCharges
              afterCharges={
                <>
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
                </>
              }
            />
            {dutiesError ? (
              <p className="text-sm text-danger">{dutiesError}</p>
            ) : null}
            <Button
              type="button"
              variant="accent"
              disabled={pending || !dutiesBillingId.trim()}
              onClick={() => {
                if (!dutiesBillingId.trim()) return;
                const importInput = importDraftToInput(importDraft, {
                  requireCustomsRates: true,
                });
                if (!importInput) {
                  setDutiesError(
                    t("pages.billing.purchaseImportCustomsRateRequired")
                  );
                  return;
                }
                setDutiesError(null);
                const formData = new FormData();
                formData.set("purchaseInvoiceId", purchaseInvoiceId);
                formData.set("importDutiesBillingId", dutiesBillingId.trim());
                formData.set("importJson", JSON.stringify(importInput));
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
