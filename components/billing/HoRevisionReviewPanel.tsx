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
import ReviewChoiceCards from "@/components/billing/ReviewChoiceCards";
import ProofLightbox from "@/components/ui/ProofLightbox";
import { Button } from "@/components/ui/button";
import { FileDropField } from "@/components/ui/FileDropField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

type Props = {
  periodId: string;
  clientRevisionNote: string | null;
  clientRevisionProofPath: string | null;
  suggestedAmount: number | null;
  clientRequestedAmount?: number | null;
};

export default function HoRevisionReviewPanel({
  periodId,
  clientRevisionNote,
  clientRevisionProofPath,
  suggestedAmount,
  clientRequestedAmount,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<"approve" | "revise" | null>(null);
  const defaultAmount =
    clientRequestedAmount ?? suggestedAmount;
  const [revisedAmount, setRevisedAmount] = useState(
    defaultAmount != null ? String(Math.round(defaultAmount)) : ""
  );
  const [rejectNote, setRejectNote] = useState("");
  const [proposedAmount, setProposedAmount] = useState("");
  const [rejectProof, setRejectProof] = useState<File | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  function approve(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("periodId", periodId);
    formData.set("revisedAmount", revisedAmount);
    startTransition(async () => {
      try {
        await hoApproveClientRevision(formData);
        setChoice(null);
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
    formData.set("hoProposedAmount", proposedAmount);
    if (rejectProof) formData.set("proof", rejectProof);
    startTransition(async () => {
      try {
        await hoRejectClientRevision(formData);
        setChoice(null);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.reconciliation.hoRejectFailed"));
      }
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-elevated/40 p-4">
      <p id="ho-review-choice" className="text-sm font-medium text-text">
        {t("pages.reconciliation.clientRevisionTitle")}
      </p>
      {clientRequestedAmount != null ? (
        <p className="text-sm text-text">
          <span className="text-xs font-medium text-muted">
            {t("pages.reconciliation.revisedRequestedAmount")}
          </span>
          <span className="mt-0.5 block text-base font-semibold tabular-nums">
            {formatContractPrice(clientRequestedAmount)}
          </span>
        </p>
      ) : null}
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

      <ReviewChoiceCards
        labelledBy="ho-review-choice"
        value={choice}
        onChange={setChoice}
        disabled={pending}
        options={[
          {
            value: "approve",
            label: t("pages.reconciliation.chooseApprove"),
            hint: t("pages.reconciliation.hoChooseApproveHint"),
            tone: "emerald",
          },
          {
            value: "revise",
            label: t("pages.reconciliation.chooseRevise"),
            hint: t("pages.reconciliation.hoChooseReviseHint"),
            tone: "danger",
          },
        ]}
      />

      {choice === "approve" ? (
        <form onSubmit={approve} className="space-y-3 border-t border-border pt-3">
          <p className="text-xs text-subtle">
            {t("pages.reconciliation.revisedInvoiceHelp")}
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              {t("pages.reconciliation.revisedAmount")}
            </label>
            <MoneyInput
              value={revisedAmount}
              onValueChange={setRevisedAmount}
              required
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending
              ? t("pages.reconciliation.issuingInvoice")
              : t("pages.reconciliation.confirmHoApprove")}
          </Button>
        </form>
      ) : null}

      {choice === "revise" ? (
        <form onSubmit={reject} className="space-y-4 border-t border-border pt-3">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">
                {t("pages.reconciliation.rejectNoteLabel")}
              </label>
              <textarea
                required
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">
                {t("pages.reconciliation.proposedAmount")}
              </label>
              <MoneyInput
                value={proposedAmount}
                onValueChange={setProposedAmount}
                required
              />
            </div>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/40 p-3">
            <FileDropField
              id="ho-reject-proof"
              label={t("pages.reconciliation.rejectProofLabel")}
              fileName={rejectProof?.name ?? null}
              onPick={setRejectProof}
              accept="image/*,application/pdf"
            />
          </div>
          <Button
            type="submit"
            disabled={pending || !rejectNote.trim() || !proposedAmount.trim()}
          >
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
