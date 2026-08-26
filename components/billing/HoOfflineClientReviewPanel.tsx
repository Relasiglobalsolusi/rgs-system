"use client";

import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { hoRecordOfflineClientReview } from "@/app/billing/reconciliation/actions";
import ReviewChoiceCards from "@/components/billing/ReviewChoiceCards";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

type Props = {
  periodId: string;
  proposedAmount: number | null;
};

export default function HoOfflineClientReviewPanel({
  periodId,
  proposedAmount,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<"approve" | "revise" | null>(null);
  const [note, setNote] = useState("");
  const [revisedAmount, setRevisedAmount] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!choice) return;
    const formData = new FormData();
    formData.set("periodId", periodId);
    formData.set("decision", choice);
    formData.set("note", note);
    formData.set("revisedAmount", revisedAmount);
    startTransition(async () => {
      try {
        await hoRecordOfflineClientReview(formData);
        setChoice(null);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.reconciliation.offlineFailed"));
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-elevated/40 p-4">
      <div>
        <p id="offline-review-choice" className="text-sm font-medium text-text">
          {t("pages.reconciliation.offlineReviewTitle")}
        </p>
        <p className="mt-1 text-xs text-muted">
          {t("pages.reconciliation.offlineReviewHelp")}
        </p>
        {proposedAmount != null ? (
          <p className="mt-2 text-sm tabular-nums text-text">
            {formatContractPrice(proposedAmount)}
          </p>
        ) : null}
      </div>
      <ReviewChoiceCards
        labelledBy="offline-review-choice"
        value={choice}
        onChange={setChoice}
        disabled={pending}
        options={[
          {
            value: "approve",
            label: t("pages.reconciliation.offlineApproved"),
            hint: t("pages.reconciliation.offlineApprovedHint"),
            tone: "emerald",
          },
          {
            value: "revise",
            label: t("pages.reconciliation.offlineRevised"),
            hint: t("pages.reconciliation.offlineRevisedHint"),
            tone: "warning",
          },
        ]}
      />
      {choice === "revise" ? (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-text">
              {t("pages.reconciliation.offlineReason")}
            </span>
            <textarea
              required
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("pages.reconciliation.offlineReasonPlaceholder")}
              className="mt-1 min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-text">
              {t("pages.reconciliation.offlineNewAmount")}
            </span>
            <MoneyInput
              required
              value={revisedAmount}
              onValueChange={setRevisedAmount}
              className="mt-1"
            />
          </label>
        </div>
      ) : null}
      {choice ? (
        <Button type="submit" disabled={pending}>
          {pending
            ? t("pages.reconciliation.offlineSubmitting")
            : t("pages.reconciliation.offlineSubmit")}
        </Button>
      ) : null}
    </form>
  );
}
