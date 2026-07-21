"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, FileText, RotateCcw } from "lucide-react";

import {
  clientApproveBillingReview,
  clientReviseBillingReview,
} from "@/app/billing/reconciliation/actions";
import ProofLightbox from "@/components/ui/ProofLightbox";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  periodId: string;
  reviewReportPdfPath: string | null;
  hoReviewNote?: string | null;
  hoReviewProofPath?: string | null;
  /** When HO rejected a prior revision, show their feedback. */
  showHoRejection?: boolean;
};

export default function ClientBillingReviewActions({
  periodId,
  reviewReportPdfPath,
  hoReviewNote,
  hoReviewProofPath,
  showHoRejection,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reviseOpen, setReviseOpen] = useState(false);
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  function approve() {
    if (
      !confirm(
        t("pages.reconciliation.confirmClientApprove")
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await clientApproveBillingReview(periodId);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.reconciliation.approveFailed"));
      }
    });
  }

  function submitRevise(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("periodId", periodId);
    formData.set("note", note);
    if (proof) formData.set("proof", proof);
    startTransition(async () => {
      try {
        await clientReviseBillingReview(formData);
        setReviseOpen(false);
        setNote("");
        setProof(null);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.reconciliation.reviseFailed"));
      }
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-elevated/40 p-4">
      <p className="text-sm font-medium text-text">
        {t("pages.reconciliation.clientActionTitle")}
      </p>
      <p className="text-xs text-subtle">
        {t("pages.reconciliation.clientActionHelp")}
      </p>

      {showHoRejection && hoReviewNote ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-200">
            {t("pages.reconciliation.hoRejectionTitle")}
          </p>
          <p className="mt-1 text-muted whitespace-pre-wrap">{hoReviewNote}</p>
          {hoReviewProofPath ? (
            <button
              type="button"
              className="mt-2 text-xs text-accent-teal underline"
              onClick={() => setLightboxSrc(hoReviewProofPath)}
            >
              {t("pages.reconciliation.viewHoProof")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {reviewReportPdfPath ? (
          <a
            href={reviewReportPdfPath}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            {t("pages.reconciliation.viewReport")}
          </a>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={approve}
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          {pending
            ? t("pages.reconciliation.approving")
            : t("pages.reconciliation.approve")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setReviseOpen((v) => !v)}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          {t("pages.reconciliation.revise")}
        </Button>
      </div>

      {reviseOpen ? (
        <form onSubmit={submitRevise} className="space-y-3 border-t border-border pt-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              {t("pages.reconciliation.reviseNoteLabel")}
            </label>
            <textarea
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text"
              placeholder={t("pages.reconciliation.reviseNotePlaceholder")}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              {t("pages.reconciliation.reviseProofLabel")}
            </label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button type="submit" size="sm" disabled={pending || !note.trim()}>
            {pending
              ? t("pages.reconciliation.submittingRevise")
              : t("pages.reconciliation.submitRevise")}
          </Button>
        </form>
      ) : null}

      <ProofLightbox
        open={Boolean(lightboxSrc)}
        onOpenChange={(open) => {
          if (!open) setLightboxSrc(null);
        }}
        src={lightboxSrc}
        title={t("pages.reconciliation.hoProofTitle")}
      />
    </div>
  );
}
