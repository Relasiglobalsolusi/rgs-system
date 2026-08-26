"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileText } from "lucide-react";

import {
  clientApproveBillingReview,
  clientReviseBillingReview,
} from "@/app/billing/reconciliation/actions";
import ReviewChoiceCards from "@/components/billing/ReviewChoiceCards";
import ProofLightbox from "@/components/ui/ProofLightbox";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { FileDropField } from "@/components/ui/FileDropField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { cn } from "@/lib/utils";

type Props = {
  periodId: string;
  reviewReportPdfPath: string | null;
  hoReviewNote?: string | null;
  hoReviewProofPath?: string | null;
  /** When HO rejected a prior revision, show their feedback. */
  showHoRejection?: boolean;
  hoProposedAmount?: number | null;
};

export default function ClientBillingReviewActions({
  periodId,
  reviewReportPdfPath,
  hoReviewNote,
  hoReviewProofPath,
  showHoRejection,
  hoProposedAmount,
}: Props) {
  const { t } = useT();
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<"approve" | "revise" | null>(null);
  const [note, setNote] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  async function approve() {
    const confirmed = await confirm({
      title: t("pages.reconciliation.approve"),
      description: t("pages.reconciliation.confirmClientApprove"),
      confirmLabel: t("pages.reconciliation.approve"),
    });
    if (!confirmed) return;
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
    formData.set("clientRequestedAmount", requestedAmount);
    if (proof) formData.set("proof", proof);
    startTransition(async () => {
      try {
        await clientReviseBillingReview(formData);
        setChoice(null);
        setNote("");
        setRequestedAmount("");
        setProof(null);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.reconciliation.reviseFailed"));
      }
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-elevated/40 p-4">
      <p id="client-review-choice" className="text-sm font-medium text-text">
        {t("pages.reconciliation.clientActionTitle")}
      </p>
      <p className="text-xs text-subtle">
        {t("pages.reconciliation.clientActionHelp")}
      </p>

      {showHoRejection ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-200">
            {t("pages.reconciliation.hoRejectionTitle")}
          </p>
          {hoProposedAmount != null ? (
            <p className="mt-2 text-text">
              <span className="text-xs font-medium text-muted">
                {t("pages.reconciliation.proposedAmount")}
              </span>
              <span className="mt-0.5 block text-base font-semibold tabular-nums">
                {formatContractPrice(hoProposedAmount)}
              </span>
            </p>
          ) : null}
          {hoReviewNote ? (
            <p className="mt-2 text-muted whitespace-pre-wrap">{hoReviewNote}</p>
          ) : null}
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

      {reviewReportPdfPath ? (
        <a
          href={reviewReportPdfPath}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "info", size: "sm" }))}
        >
          <FileText className="mr-1.5 h-3.5 w-3.5" />
          {t("pages.reconciliation.viewReport")}
        </a>
      ) : null}

      <ReviewChoiceCards
        labelledBy="client-review-choice"
        value={choice}
        onChange={setChoice}
        disabled={pending}
        options={[
          {
            value: "approve",
            label: t("pages.reconciliation.chooseApprove"),
            hint: t("pages.reconciliation.chooseApproveHint"),
            tone: "emerald",
          },
          {
            value: "revise",
            label: t("pages.reconciliation.chooseRevise"),
            hint: t("pages.reconciliation.chooseReviseHint"),
            tone: "warning",
          },
        ]}
      />

      {choice === "approve" ? (
        <div className="space-y-3 border-t border-border pt-3">
          {hoProposedAmount != null ? (
            <p className="text-sm text-muted">
              {t("pages.reconciliation.approveProposedHelp", {
                amount: formatContractPrice(hoProposedAmount),
              })}
            </p>
          ) : (
            <p className="text-sm text-muted">
              {t("pages.reconciliation.approveCardHelp")}
            </p>
          )}
          <Button type="button" disabled={pending} onClick={approve}>
            {pending
              ? t("pages.reconciliation.approving")
              : t("pages.reconciliation.approve")}
          </Button>
        </div>
      ) : null}

      {choice === "revise" ? (
        <form onSubmit={submitRevise} className="space-y-4 border-t border-border pt-3">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">
                {t("pages.reconciliation.reviseNoteLabel")}
              </label>
              <textarea
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text"
                placeholder={t("pages.reconciliation.reviseNotePlaceholder")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">
                {t("pages.reconciliation.revisedRequestedAmount")}
              </label>
              <MoneyInput
                value={requestedAmount}
                onValueChange={setRequestedAmount}
                required
              />
            </div>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/40 p-3">
            <FileDropField
              id="client-revise-proof"
              label={t("pages.reconciliation.reviseProofLabel")}
              fileName={proof?.name ?? null}
              onPick={setProof}
              accept="image/*,application/pdf"
            />
          </div>
          <Button
            type="submit"
            disabled={pending || !note.trim() || !requestedAmount.trim()}
          >
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
