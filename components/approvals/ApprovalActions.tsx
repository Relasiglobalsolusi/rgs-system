"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { reviewLeaveRequest } from "@/app/leaves/actions";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";
import { Check, X } from "lucide-react";

type Props = {
  id: string;
};

export default function ApprovalActions({ id }: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();

  function handleReview(approved: boolean) {
    startTransition(async () => {
      try {
        await reviewLeaveRequest(id, approved);
      } catch (error) {
        showRejectionFromError(error, t("common.errors.generic"));
      }
    });
  }

  return (
    <div className="flex items-center justify-center gap-2 whitespace-nowrap">
      <Button
        size="badge"
        variant="successBadge"
        disabled={pending}
        onClick={() => handleReview(true)}
        aria-label={t("common.actions.approve")}
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        size="badge"
        variant="destructiveBadge"
        disabled={pending}
        onClick={() => handleReview(false)}
        aria-label={t("common.actions.reject")}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
