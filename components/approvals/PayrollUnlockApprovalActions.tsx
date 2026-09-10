"use client";

import { useState, useTransition } from "react";

import { decideInternalPayrollUnlock } from "@/app/billing/payroll-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";

export default function PayrollUnlockApprovalActions({
  id,
}: {
  id: string;
}) {
  const { t } = useT();
  const [decisionNote, setDecisionNote] = useState("");
  const [pending, startTransition] = useTransition();

  function decide(decision: "APPROVE" | "REJECT") {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", id);
        formData.set("decision", decision);
        formData.set("decisionNote", decisionNote.trim());
        await decideInternalPayrollUnlock(formData);
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.payroll.errors.unlockDecisionFailed")
        );
      }
    });
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={decisionNote}
        onChange={(event) => setDecisionNote(event.target.value)}
        placeholder={t("pages.approvals.payrollUnlockDecisionNote")}
        rows={3}
        disabled={pending}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="successBadge"
          disabled={pending}
          onClick={() => decide("APPROVE")}
        >
          {t("pages.approvals.payrollUnlockApprove")}
        </Button>
        <Button
          type="button"
          variant="destructiveBadge"
          disabled={pending}
          onClick={() => decide("REJECT")}
        >
          {t("pages.approvals.payrollUnlockReject")}
        </Button>
      </div>
    </div>
  );
}
