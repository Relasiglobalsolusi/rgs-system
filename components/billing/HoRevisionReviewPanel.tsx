"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  hoApproveClientRevision,
  hoRejectClientRevision,
} from "@/app/billing/reconciliation/actions";
import ProofLightbox from "@/components/ui/ProofLightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  periodId: string;
  clientRevisionNote: string | null;
  clientRevisionProofPath: string | null;
  suggestedAmount: number | null;
};

export default function HoRevisionReviewPanel({
  periodId,
  clientRevisionNote,
  clientRevisionProofPath,
  suggestedAmount,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [revisedAmount, setRevisedAmount] = useState(
    suggestedAmount != null ? String(Math.round(suggestedAmount)) : ""
  );
  const [revisedInvoiceNumber, setRevisedInvoiceNumber] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [rejectProof, setRejectProof] = useState<File | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  function approve(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("periodId", periodId);
    formData.set("revisedAmount", revisedAmount);
    formData.set("revisedInvoiceNumber", revisedInvoiceNumber);
    startTransition(async () => {
      try {
        await hoApproveClientRevision(formData);
        setMode("idle");
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.reconciliation.hoApproveFailed"));
      }
    });
  }

  function reject(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("periodId", periodId);
    formData.set("note", rejectNote);
    if (rejectProof) formData.set("proof", rejectProof);
    startTransition(async () => {
      try {
        await hoRejectClientRevision(formData);
        setMode("idle");
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.reconciliation.hoRejectFailed"));
      }
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-elevated/40 p-4">
      <p className="text-sm font-medium text-text">
        {t("pages.reconciliation.clientRevisionTitle")}
      </p>
      {clientRevisionNote ? (
        <p className="whitespace-pre-wrap text-sm text-muted">
          {clientRevisionNote}
        </p>
      ) : null}
      {clientRevisionProofPath ? (
        <button
          type="button"
          className="text-xs text-accent-teal underline"
          onClick={() => setLightboxSrc(clientRevisionProofPath)}
        >
          {t("pages.reconciliation.viewClientProof")}
        </button>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => setMode("approve")}
        >
          {t("pages.reconciliation.hoApprove")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setMode("reject")}
        >
          {t("pages.reconciliation.hoReject")}
        </Button>
      </div>

      {mode === "approve" ? (
        <form onSubmit={approve} className="space-y-3 border-t border-border pt-3">
          <p className="text-xs text-subtle">
            {t("pages.reconciliation.revisedInvoiceHelp")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                {t("pages.reconciliation.revisedAmount")}
              </label>
              <Input
                value={revisedAmount}
                onChange={(e) => setRevisedAmount(e.target.value)}
                inputMode="numeric"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                {t("pages.reconciliation.revisedInvoiceNumber")}
              </label>
              <Input
                value={revisedInvoiceNumber}
                onChange={(e) => setRevisedInvoiceNumber(e.target.value)}
                placeholder="INV-…"
              />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending
              ? t("pages.reconciliation.issuingInvoice")
              : t("pages.reconciliation.confirmHoApprove")}
          </Button>
        </form>
      ) : null}

      {mode === "reject" ? (
        <form onSubmit={reject} className="space-y-3 border-t border-border pt-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              {t("pages.reconciliation.rejectNoteLabel")}
            </label>
            <textarea
              required
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              {t("pages.reconciliation.rejectProofLabel")}
            </label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setRejectProof(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button type="submit" size="sm" disabled={pending || !rejectNote.trim()}>
            {pending
              ? t("pages.reconciliation.sendingReject")
              : t("pages.reconciliation.confirmHoReject")}
          </Button>
        </form>
      ) : null}

      <ProofLightbox
        open={Boolean(lightboxSrc)}
        onOpenChange={(open) => {
          if (!open) setLightboxSrc(null);
        }}
        src={lightboxSrc}
        title={t("pages.reconciliation.clientProofTitle")}
      />
    </div>
  );
}
